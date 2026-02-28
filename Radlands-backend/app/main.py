from fastapi import FastAPI
from app.db.database import engine, Base
from app.models import player, game, card, game_state

app = FastAPI(title="Radlands API")

Base.metadata.create_all(bind=engine)

@app.get("/")
def root():
    return {"message": "Radlands Backend Running 🚀"}