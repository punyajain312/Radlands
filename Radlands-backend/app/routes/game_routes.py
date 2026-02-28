from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.dependencies import get_db
from app.models.game import Game
from app.models.game_state import GameState
from app.models.card import Card
from pydantic import BaseModel
from app.core.game_initializer import initialize_game_state

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

    state["players"][str(next_player_id)]["water"] = 3

    game_state.state_json = state
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
    db.commit()

    return {
        "message": "Person played successfully",
        "state": state
    }