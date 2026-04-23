from fastapi import FastAPI
from app.db.database import engine, Base
from app.routes import auth_routes
from app.routes.game_routes import router as game_router

app = FastAPI(title="Radlands API")

Base.metadata.create_all(bind=engine)

app.include_router(game_router)
app.include_router(auth_routes.router)


@app.get("/")
def root():
    return {"message": "Radlands Backend Running 🚀"}