from fastapi import APIRouter, Depends, HTTPException
from enum import Enum
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified
from app.db.dependencies import get_db
from app.models.game import Game
from app.models.game_state import GameState
from app.models.card import Card
from pydantic import BaseModel
from app.core.game_initializer import initialize_game_state
from app.core.effect_engine import execute_effect

router = APIRouter()

# Create game
class CreateGameRequest(BaseModel):
    player1_id: int
    player2_id: int


@router.post("/games/create")
def create_game(request: CreateGameRequest, db: Session = Depends(get_db)):
    game = Game(
        player1_id=request.player1_id,
        player2_id=request.player2_id,
        status="initializing"
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
        "state": game_state.state_json
    }

#Get Game Details
@router.get("/games/{game_id}")
def get_game(game_id: int, db: Session = Depends(get_db)):
    game = db.query(Game).filter(Game.id == game_id).first()
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")

    game_state = db.query(GameState).filter(GameState.game_id == game_id).first()
    if not game_state:
        raise HTTPException(status_code=404, detail="Game state not found")

    return {
        "game_id": game.id,
        "status": game.status,
        "current_turn_player_id": game.current_turn_player_id,
        "start_player_id": game.start_player_id,
        "turn_number": game.turn_number,
        "state": game_state.state_json
    }


# End Turn
class EndTurnRequest(BaseModel):
    player_id: int


@router.post("/games/{game_id}/end-turn")
def end_turn(
    game_id: int,
    request: EndTurnRequest,
    db: Session = Depends(get_db)
):
    game = db.query(Game).filter(Game.id == game_id).first()
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")

    if game.status != "active":
        raise HTTPException(status_code=400, detail="Game not active")

    if game.current_turn_player_id != request.player_id:
        raise HTTPException(status_code=403, detail="Not your turn")

    game_state = db.query(GameState).filter(GameState.game_id == game_id).first()
    if not game_state:
        raise HTTPException(status_code=404, detail="Game state not found")

    state = game_state.state_json
    current_player_id = request.player_id

    state["players"][str(current_player_id)]["water"] = 0
    state["turn_context"]["people_played_this_turn"] = 0

    next_player_id = (
        game.player2_id
        if current_player_id == game.player1_id
        else game.player1_id
    )

    game.current_turn_player_id = next_player_id
    game.turn_number += 1

    # Replenish Water
    state["players"][str(next_player_id)]["water"] = 3

    # Ready all people of next player
    for column in state["players"][str(next_player_id)]["columns"]:
        for person in column:
            person["ready"] = True

    game_state.state_json = state
    flag_modified(game_state, "state_json")
    db.commit()

    return {
        "message": "Turn ended successfully",
        "current_turn_player_id": game.current_turn_player_id,
        "turn_number": game.turn_number,
        "state": state
    }

# Play a Card
class PlayPersonRequest(BaseModel):
    player_id: int
    card_id: int
    column_index: int


@router.post("/games/{game_id}/play-person")
def play_person(
    game_id: int,
    request: PlayPersonRequest,
    db: Session = Depends(get_db)
):
    game = db.query(Game).filter(Game.id == game_id).first()
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")

    if game.current_turn_player_id != request.player_id:
        raise HTTPException(status_code=403, detail="Not your turn")

    game_state = db.query(GameState).filter(GameState.game_id == game_id).first()
    if not game_state:
        raise HTTPException(status_code=404, detail="Game state not found")

    state = game_state.state_json
    player = state["players"][str(request.player_id)]

    if request.card_id not in player["hand"]:
        raise HTTPException(status_code=400, detail="Card not in hand")

    card = db.query(Card).filter(Card.id == request.card_id).first()
    if not card or card.type != "person":
        raise HTTPException(status_code=400, detail="Invalid card type")

    if player["water"] < card.cost:
        raise HTTPException(status_code=400, detail="Not enough water")

    if request.column_index not in [0, 1, 2]:
        raise HTTPException(status_code=400, detail="Invalid column")

    if len(player["columns"][request.column_index]) >= 2:
        raise HTTPException(status_code=400, detail="Column already has 2 people")

    player["water"] -= card.cost
    player["hand"].remove(request.card_id)

    player["columns"][request.column_index].append({
        "card_id": card.id,
        "damage": 0,
        "ready": False
    })

    state["turn_context"]["people_played_this_turn"] += 1

    game_state.state_json = state
    flag_modified(game_state, "state_json")
    db.commit()

    return {
        "message": "Person played successfully",
        "state": state
    }

class TargetType(str, Enum):
    person = "person"
    camp = "camp"

class TargetSide(str, Enum):
    self = "self"
    opponent = "opponent"


class ActivateAbilityRequest(BaseModel):
    player_id: int
    column_index: int
    position_index: int

    target_type: TargetType
    target_side: TargetSide

    target_column: int | None = None
    target_position: int | None = None
    target_camp_index: int | None = None


@router.post("/games/{game_id}/activate-ability")
def activate_ability(
    game_id: int,
    request: ActivateAbilityRequest,
    db: Session = Depends(get_db)
):
    # Fetch game
    game = db.query(Game).filter(Game.id == game_id).first()
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")

    # Validate turn ownership
    if game.current_turn_player_id != request.player_id:
        raise HTTPException(status_code=403, detail="Not your turn")

    # Fetch game state
    game_state = db.query(GameState).filter(GameState.game_id == game_id).first()
    if not game_state:
        raise HTTPException(status_code=404, detail="Game state not found")

    state = game_state.state_json
    player = state["players"][str(request.player_id)]

    # Validate column
    if request.column_index not in [0, 1, 2]:
        raise HTTPException(status_code=400, detail="Invalid column index")

    column = player["columns"][request.column_index]

    # Validate position
    if request.position_index >= len(column):
        raise HTTPException(status_code=400, detail="Invalid position")

    person = column[request.position_index]

    # Validate readiness
    if not person["ready"]:
        raise HTTPException(status_code=400, detail="Card not ready")

    # Fetch card definition
    card = db.query(Card).filter(Card.id == person["card_id"]).first()
    if not card or not card.ability:
        raise HTTPException(status_code=400, detail="No ability to activate")

    ability = card.ability[0]

    # Validate water
    ability_cost = ability.get("cost", 0)
    if player["water"] < ability_cost:
        raise HTTPException(status_code=400, detail="Not enough water")

    player["water"] -= ability_cost

    # Validate effect
    effect = ability.get("effect")
    if not effect:
        raise HTTPException(status_code=400, detail="Ability has no effect")

    # Validate target type
    if request.target_type not in ["person", "camp"]:
        raise HTTPException(status_code=400, detail="Invalid target_type")

    # Target validation
    if request.target_type == "camp":
        if request.target_camp_index is None:
            raise HTTPException(status_code=400, detail="target_camp_index required")

    if request.target_type == "person":
        if request.target_column is None or request.target_position is None:
            raise HTTPException(
                status_code=400,
                detail="target_column and target_position required"
            )

    # Determine target player
    if request.target_side == "self":
        target_player_id = request.player_id
    elif request.target_side == "opponent":
        target_player_id = (
            game.player2_id if request.player_id == game.player1_id else game.player1_id
        )
    else:
        raise HTTPException(status_code=400, detail="Invalid target_side")

    # Construct target
    target = {
        "type": request.target_type,
        "player_id": target_player_id,
        "column": request.target_column,
        "position": request.target_position,
        "camp_index": request.target_camp_index
    }

    # Execute effect
    execute_effect(state, effect, target)

    # Exhaust card
    person["ready"] = False

    # Persist state
    game_state.state_json = state
    flag_modified(game_state, "state_json")
    db.commit()

    return {
        "message": "Ability activated",
        "state": state
    }