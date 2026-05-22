from fastapi import WebSocket
from typing import Dict


class ConnectionManager:
    def __init__(self):
        # game_id -> {player_id -> WebSocket}
        self.active: Dict[int, Dict[int, WebSocket]] = {}

    async def connect(self, game_id: int, player_id: int, websocket: WebSocket):
        await websocket.accept()
        if game_id not in self.active:
            self.active[game_id] = {}
        self.active[game_id][player_id] = websocket

    def disconnect(self, game_id: int, player_id: int):
        if game_id in self.active:
            self.active[game_id].pop(player_id, None)
            if not self.active[game_id]:
                del self.active[game_id]

    async def broadcast(self, game_id: int, data: dict):
        if game_id not in self.active:
            return
        dead = []
        for player_id, ws in self.active[game_id].items():
            try:
                await ws.send_json(data)
            except Exception:
                dead.append(player_id)
        for pid in dead:
            self.disconnect(game_id, pid)


manager = ConnectionManager()
