from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session # type: ignore
from sqlalchemy.orm.attributes import flag_modified # type: ignore

from app.db.dependencies import get_db
from app.models.game import Game
from app.models.player import Player
from app.models.game_state import GameState
from app.models.card import Card
from app.core.auth_deps import get_current_player_id
from app.core.game_initializer import (
    initialize_game_state,
    draw_card,
    advance_events,
    check_game_end,
)
from app.core.effect_engine import execute_effect, check_condition, is_camp_protected
from app.core.connection_manager import manager
from app.schemas.game import (
    CreateGameRequest,
    PlayPersonRequest,
    ActivateAbilityRequest,
    ActivateCampRequest,
    JunkCardRequest,
    PlayEventRequest,
)

router = APIRouter()

DEFAULT_EVENT_FUSE = 2  # turns before an event fires if card has no fuse field


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_active_game(game_id: int, db: Session) -> tuple[Game, GameState]:
    game = db.query(Game).filter(Game.id == game_id).first()
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    if game.status == "finished":
        raise HTTPException(status_code=400, detail="Game already finished")
    if game.status != "active":
        raise HTTPException(status_code=400, detail="Game not active")
    game_state = db.query(GameState).filter(GameState.game_id == game_id).first()
    if not game_state:
        raise HTTPException(status_code=404, detail="Game state not found")
    return game, game_state


def _require_turn(game: Game, player_id: int) -> None:
    if game.current_turn_player_id != player_id:
        raise HTTPException(status_code=403, detail="Not your turn")


def _opponent_id(game: Game, player_id: int) -> int:
    return game.player2_id if player_id == game.player1_id else game.player1_id


def _resolve_caller_target(request, game: Game, player_id: int, state: dict) -> dict | None:
    """Build a resolved target dict from request fields, or return None."""
    if request.target_type is None:
        return None

    if request.target_side == "self":
        target_player_id = player_id
    elif request.target_side == "opponent":
        target_player_id = _opponent_id(game, player_id)
    else:
        target_player_id = _opponent_id(game, player_id)

    target_player = state["players"][str(target_player_id)]

    if request.target_type == "person":
        col_idx = request.target_column
        pos_idx = request.target_position
        if col_idx is None or pos_idx is None:
            raise HTTPException(
                status_code=400,
                detail="target_column and target_position required for person targets",
            )
        if col_idx not in (0, 1, 2):
            raise HTTPException(status_code=400, detail="target_column must be 0–2")
        if pos_idx >= len(target_player["columns"][col_idx]):
            raise HTTPException(status_code=400, detail="No person at target position")
        return {
            "type": "person",
            "player_id": target_player_id,
            "column": col_idx,
            "position": pos_idx,
        }

    if request.target_type == "camp":
        camp_idx = request.target_camp_index
        if camp_idx is None:
            raise HTTPException(
                status_code=400, detail="target_camp_index required for camp targets"
            )
        if camp_idx not in (0, 1, 2):
            raise HTTPException(status_code=400, detail="target_camp_index must be 0–2")
        camp = target_player["camps"][camp_idx]
        if camp.get("destroyed"):
            raise HTTPException(status_code=400, detail="That camp is already destroyed")
        return {
            "type": "camp",
            "player_id": target_player_id,
            "camp_index": camp_idx,
        }

    return None


def _save_state(db: Session, game: Game, game_state: GameState, state: dict) -> None:
    game_state.state_json = state
    game_state.version += 1
    flag_modified(game_state, "state_json")
    db.commit()


def _finish_game(game: Game, result: dict) -> None:
    game.status = "finished"
    game.winner_id = result.get("winner_id")


def _update_player_stats(db: Session, game: Game) -> None:
    winner_id = game.winner_id
    p1 = db.query(Player).filter(Player.id == game.player1_id).first()
    p2 = db.query(Player).filter(Player.id == game.player2_id).first()
    for player in (p1, p2):
        if not player:
            continue
        player.games_played = (player.games_played or 0) + 1
        if winner_id and player.id == winner_id:
            player.games_won = (player.games_won or 0) + 1
        elif winner_id:
            player.games_lost = (player.games_lost or 0) + 1
    db.flush()


def _record_card_play(db: Session, player_id: int, card_id: int) -> None:
    player = db.query(Player).filter(Player.id == player_id).first()
    if not player:
        return
    counts: dict = player.card_play_counts or {}
    key = str(card_id)
    counts[key] = counts.get(key, 0) + 1
    player.card_play_counts = counts
    flag_modified(player, "card_play_counts")
    db.flush()


async def _broadcast(game: Game, state: dict) -> None:
    await manager.broadcast(game.id, {
        "type": "game_state",
        "game_id": game.id,
        "status": game.status,
        "current_turn_player_id": game.current_turn_player_id,
        "turn_number": game.turn_number,
        "winner_id": game.winner_id,
        "state": state,
    })


# ---------------------------------------------------------------------------
# Root
# ---------------------------------------------------------------------------

@router.get("/")
def root():
    return {"message": "Radlands Backend Running"}


# ---------------------------------------------------------------------------
# Games
# ---------------------------------------------------------------------------

@router.post("/games/create")
async def create_game(
    request: CreateGameRequest,
    current_player_id: int = Depends(get_current_player_id),
    db: Session = Depends(get_db),
):
    if current_player_id == request.opponent_id:
        raise HTTPException(status_code=400, detail="Cannot play against yourself")

    player1 = db.query(Player).filter(Player.id == current_player_id).first()
    player2 = db.query(Player).filter(Player.id == request.opponent_id).first()
    if not player1 or not player2:
        raise HTTPException(status_code=404, detail="Player not found")

    game = Game(
        player1_id=current_player_id,
        player2_id=request.opponent_id,
        status="initializing",
    )
    db.add(game)
    db.commit()
    db.refresh(game)

    game_state = initialize_game_state(db, game)

    return {
        "game_id": game.id,
        "status": game.status,
        "current_turn_player_id": game.current_turn_player_id,
        "start_player_id": game.start_player_id,
        "turn_number": game.turn_number,
        "state": game_state.state_json,
    }


@router.get("/games/")
async def list_games(
    current_player_id: int = Depends(get_current_player_id),
    db: Session = Depends(get_db),
):
    games = db.query(Game).filter(
        (Game.player1_id == current_player_id) | (Game.player2_id == current_player_id)
    ).all()

    return [
        {
            "game_id": g.id,
            "status": g.status,
            "opponent_id": (
                g.player2_id if g.player1_id == current_player_id else g.player1_id
            ),
            "current_turn_player_id": g.current_turn_player_id,
            "turn_number": g.turn_number,
            "winner_id": g.winner_id,
        }
        for g in games
    ]


@router.get("/games/{game_id}")
async def get_game(
    game_id: int,
    current_player_id: int = Depends(get_current_player_id),
    db: Session = Depends(get_db),
):
    game = db.query(Game).filter(Game.id == game_id).first()
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")

    if current_player_id not in (game.player1_id, game.player2_id):
        raise HTTPException(status_code=403, detail="You are not in this game")

    game_state = db.query(GameState).filter(GameState.game_id == game_id).first()
    if not game_state:
        raise HTTPException(status_code=404, detail="Game state not found")

    return {
        "game_id": game.id,
        "status": game.status,
        "current_turn_player_id": game.current_turn_player_id,
        "start_player_id": game.start_player_id,
        "turn_number": game.turn_number,
        "winner_id": game.winner_id,
        "state": game_state.state_json,
    }


# ---------------------------------------------------------------------------
# Turn management
# ---------------------------------------------------------------------------

@router.post("/games/end-turn/{game_id}")
async def end_turn(
    game_id: int,
    current_player_id: int = Depends(get_current_player_id),
    db: Session = Depends(get_db),
):
    game, game_state = _get_active_game(game_id, db)
    _require_turn(game, current_player_id)

    state = game_state.state_json
    current_pid = current_player_id

    # Reset current player's turn resources
    state["players"][str(current_pid)]["water"] = 0
    state["turn_context"]["people_played_this_turn"] = 0

    next_pid = _opponent_id(game, current_pid)
    game.current_turn_player_id = next_pid
    game.turn_number += 1

    # Advance next player's events before they draw
    advance_events(state, next_pid, db)

    # Draw for next player
    draw_result = draw_card(state, next_pid)
    if draw_result == "DRAW":
        game.status = "finished"
        game.winner_id = None
        _save_state(db, game, game_state, state)
        await _broadcast(game, state)
        return {"message": "Game ended in a draw (deck exhausted)", "game_over": True, "draw": True, "state": state}

    # Set next player's water and ready all their people
    state["players"][str(next_pid)]["water"] = 3
    for col in state["players"][str(next_pid)]["columns"]:
        for person in col:
            person["ready"] = True

    _save_state(db, game, game_state, state)
    await _broadcast(game, state)

    return {
        "message": "Turn ended",
        "current_turn_player_id": game.current_turn_player_id,
        "turn_number": game.turn_number,
        "state": state,
    }


# ---------------------------------------------------------------------------
# Play a person
# ---------------------------------------------------------------------------

@router.post("/games/play-person/{game_id}")
async def play_person(
    game_id: int,
    request: PlayPersonRequest,
    current_player_id: int = Depends(get_current_player_id),
    db: Session = Depends(get_db),
):
    game, game_state = _get_active_game(game_id, db)
    _require_turn(game, current_player_id)

    state = game_state.state_json
    player = state["players"][str(current_player_id)]

    if request.card_id not in player["hand"]:
        raise HTTPException(status_code=400, detail="Card not in your hand")

    card = db.query(Card).filter(Card.id == request.card_id).first()
    if not card or card.type != "person":
        raise HTTPException(status_code=400, detail="Card is not a person")

    water_cost = (card.cost or {}).get("water", 0)
    if player["water"] < water_cost:
        raise HTTPException(status_code=400, detail="Not enough water")

    col_idx = request.column_index
    if len(player["columns"][col_idx]) >= 2:
        raise HTTPException(status_code=400, detail="Column already has 2 people")

    # Deduct cost and place
    player["water"] -= water_cost
    player["hand"].remove(request.card_id)
    _record_card_play(db, current_player_id, request.card_id)

    person_state = {"card_id": card.id, "damage": 0, "ready": False}
    player["columns"][col_idx].append(person_state)
    state["turn_context"]["people_played_this_turn"] += 1

    # Fire enter_effect if any (non-optional only)
    enter = card.data.get("enter_effect")
    if enter and not enter.get("optional", False):
        position_idx = len(player["columns"][col_idx]) - 1
        self_target = {
            "type": "person",
            "player_id": current_player_id,
            "column": col_idx,
            "position": position_idx,
        }
        opponent_id = _opponent_id(game, current_player_id)
        for eff in enter.get("effects", []):
            try:
                execute_effect(state, eff, self_target, current_player_id, opponent_id)
            except HTTPException:
                pass  # don't crash the whole play if enter effect isn't implemented yet

    _save_state(db, game, game_state, state)
    await _broadcast(game, state)
    return {"message": "Person played", "state": state}


# ---------------------------------------------------------------------------
# Activate a person ability
# ---------------------------------------------------------------------------

@router.post("/games/activate-ability/{game_id}")
async def activate_ability(
    game_id: int,
    request: ActivateAbilityRequest,
    current_player_id: int = Depends(get_current_player_id),
    db: Session = Depends(get_db),
):
    game, game_state = _get_active_game(game_id, db)
    _require_turn(game, current_player_id)

    state = game_state.state_json
    player = state["players"][str(current_player_id)]

    col_idx = request.column_index
    if col_idx not in (0, 1, 2):
        raise HTTPException(status_code=400, detail="column_index must be 0–2")

    col = player["columns"][col_idx]
    if request.position_index >= len(col):
        raise HTTPException(status_code=400, detail="No person at that position")

    person = col[request.position_index]
    if not person["ready"]:
        raise HTTPException(status_code=400, detail="Person is not ready (already used this turn)")

    card = db.query(Card).filter(Card.id == person["card_id"]).first()
    if not card:
        raise HTTPException(status_code=404, detail="Card definition not found")

    abilities = card.data.get("activated_abilities", [])
    if not abilities:
        raise HTTPException(status_code=400, detail="This person has no activated ability")

    if request.ability_index >= len(abilities):
        raise HTTPException(status_code=400, detail="Invalid ability_index")

    ability = abilities[request.ability_index]
    cost_obj = ability.get("cost", {})
    water_cost = cost_obj.get("water", 0) if isinstance(cost_obj, dict) else int(cost_obj)

    if player["water"] < water_cost:
        raise HTTPException(status_code=400, detail="Not enough water")

    caller_target = _resolve_caller_target(request, game, current_player_id, state)
    opponent_id = _opponent_id(game, current_player_id)

    # Deduct cost and exhaust AFTER successful effect execution
    player["water"] -= water_cost
    person["ready"] = False

    for eff in ability.get("effects", []):
        execute_effect(state, eff, caller_target, current_player_id, opponent_id)

    result = check_game_end(state, game)
    if result["game_over"]:
        _finish_game(game, result)
        _update_player_stats(db, game)

    _save_state(db, game, game_state, state)
    await _broadcast(game, state)

    return {
        "message": "Ability activated",
        "state": state,
        "game_over": result["game_over"],
        "winner_id": result.get("winner_id"),
    }


# ---------------------------------------------------------------------------
# Activate a camp ability
# ---------------------------------------------------------------------------

@router.post("/games/activate-camp/{game_id}")
async def activate_camp(
    game_id: int,
    request: ActivateCampRequest,
    current_player_id: int = Depends(get_current_player_id),
    db: Session = Depends(get_db),
):
    game, game_state = _get_active_game(game_id, db)
    _require_turn(game, current_player_id)

    state = game_state.state_json
    player = state["players"][str(current_player_id)]

    camp_idx = request.camp_index
    if camp_idx not in (0, 1, 2):
        raise HTTPException(status_code=400, detail="camp_index must be 0–2")

    camp = player["camps"][camp_idx]
    if camp.get("destroyed"):
        raise HTTPException(status_code=400, detail="That camp is destroyed")

    card = db.query(Card).filter(Card.id == camp["card_id"]).first()
    if not card:
        raise HTTPException(status_code=404, detail="Camp card definition not found")

    abilities = card.data.get("ability", [])
    if not abilities:
        raise HTTPException(status_code=400, detail="This camp has no ability")

    if request.ability_index >= len(abilities):
        raise HTTPException(status_code=400, detail="Invalid ability_index")

    ability = abilities[request.ability_index]

    if ability.get("type") != "activated":
        raise HTTPException(status_code=400, detail="This camp ability is not activated")

    # Compute effective cost (handle cost_modifier)
    base_cost = ability.get("cost", 0)
    modifier = ability.get("cost_modifier", {})
    if modifier.get("type") == "per_destroyed_camp_you_have":
        destroyed_count = sum(1 for c in player["camps"] if c.get("destroyed"))
        base_cost = max(0, base_cost - destroyed_count * modifier.get("reduction", 0))

    if player["water"] < base_cost:
        raise HTTPException(status_code=400, detail="Not enough water")

    # Check condition
    condition = ability.get("condition")
    if condition and not check_condition(state, condition, current_player_id):
        raise HTTPException(status_code=400, detail="Ability condition not met")

    opponent_id = _opponent_id(game, current_player_id)
    caller_target = _resolve_caller_target(request, game, current_player_id, state)

    player["water"] -= base_cost

    effect = ability.get("effect")
    if not effect:
        raise HTTPException(status_code=400, detail="Camp ability has no effect")

    execute_effect(state, effect, caller_target, current_player_id, opponent_id)

    result = check_game_end(state, game)
    if result["game_over"]:
        _finish_game(game, result)
        _update_player_stats(db, game)

    _save_state(db, game, game_state, state)
    await _broadcast(game, state)

    return {
        "message": "Camp ability activated",
        "state": state,
        "game_over": result["game_over"],
        "winner_id": result.get("winner_id"),
    }


# ---------------------------------------------------------------------------
# Junk a card
# ---------------------------------------------------------------------------

@router.post("/games/junk-card/{game_id}")
async def junk_card(
    game_id: int,
    request: JunkCardRequest,
    current_player_id: int = Depends(get_current_player_id),
    db: Session = Depends(get_db),
):
    game, game_state = _get_active_game(game_id, db)
    _require_turn(game, current_player_id)

    state = game_state.state_json
    player = state["players"][str(current_player_id)]

    if request.card_id not in player["hand"]:
        raise HTTPException(status_code=400, detail="Card not in your hand")

    card = db.query(Card).filter(Card.id == request.card_id).first()
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")

    junk_effect_wrapper = card.data.get("junk_effect") or card.data.get("junk_ability")
    if not junk_effect_wrapper:
        raise HTTPException(status_code=400, detail="This card has no junk effect")

    # Remove from hand and add to discard first
    player["hand"].remove(request.card_id)
    player["discard"].append(request.card_id)
    _record_card_play(db, current_player_id, request.card_id)

    opponent_id = _opponent_id(game, current_player_id)

    effects = junk_effect_wrapper.get("effects", [])
    for eff in effects:
        execute_effect(state, eff, None, current_player_id, opponent_id)

    result = check_game_end(state, game)
    if result["game_over"]:
        _finish_game(game, result)
        _update_player_stats(db, game)

    _save_state(db, game, game_state, state)
    await _broadcast(game, state)

    return {
        "message": "Card junked",
        "state": state,
        "game_over": result["game_over"],
        "winner_id": result.get("winner_id"),
    }


# ---------------------------------------------------------------------------
# Play an event
# ---------------------------------------------------------------------------

@router.post("/games/play-event/{game_id}")
async def play_event(
    game_id: int,
    request: PlayEventRequest,
    current_player_id: int = Depends(get_current_player_id),
    db: Session = Depends(get_db),
):
    game, game_state = _get_active_game(game_id, db)
    _require_turn(game, current_player_id)

    state = game_state.state_json
    player = state["players"][str(current_player_id)]

    if request.card_id not in player["hand"]:
        raise HTTPException(status_code=400, detail="Card not in your hand")

    card = db.query(Card).filter(Card.id == request.card_id).first()
    if not card or card.type != "event":
        raise HTTPException(status_code=400, detail="Card is not an event")

    water_cost = (card.cost or {}).get("water", 0)
    if player["water"] < water_cost:
        raise HTTPException(status_code=400, detail="Not enough water")

    slot = request.queue_slot
    if player["events"][slot] is not None:
        raise HTTPException(status_code=400, detail="Event slot already occupied")

    fuse = card.data.get("fuse", DEFAULT_EVENT_FUSE)

    player["water"] -= water_cost
    player["hand"].remove(request.card_id)
    player["events"][slot] = {"card_id": request.card_id, "turns_remaining": fuse}
    _record_card_play(db, current_player_id, request.card_id)

    _save_state(db, game, game_state, state)
    await _broadcast(game, state)

    return {"message": "Event queued", "state": state}
