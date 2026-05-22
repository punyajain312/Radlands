from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from sqlalchemy.orm import Session

from app.db.database import SessionLocal
from app.models.game import Game
from app.models.game_state import GameState
from app.core.security import decode_token
from app.core.connection_manager import manager

ws_router = APIRouter()


@ws_router.websocket("/ws/games/{game_id}")
async def game_websocket(game_id: int, websocket: WebSocket, token: str = Query(...)):
    payload = decode_token(token)
    if payload is None:
        await websocket.close(code=4001)
        return

    player_id = payload["user_id"]

    db: Session = SessionLocal()
    try:
        game = db.query(Game).filter(Game.id == game_id).first()
        if not game or player_id not in (game.player1_id, game.player2_id):
            await websocket.close(code=4003)
            return

        game_state = db.query(GameState).filter(GameState.game_id == game_id).first()
        initial_payload = {
            "type": "game_state",
            "game_id": game.id,
            "status": game.status,
            "current_turn_player_id": game.current_turn_player_id,
            "turn_number": game.turn_number,
            "winner_id": game.winner_id,
            "state": game_state.state_json if game_state else None,
        }
    finally:
        db.close()

    await manager.connect(game_id, player_id, websocket)
    await websocket.send_json(initial_payload)

    try:
        while True:
            # Incoming messages are ignored; state is pushed from REST endpoints
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(game_id, player_id)
