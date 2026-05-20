import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.db.database import engine, Base
from app.routes import auth_routes
from app.routes.game_routes import router as game_router

app = FastAPI(title="Radlands API")

_raw_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000")
_origins = [o.strip() for o in _raw_origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

Base.metadata.create_all(bind=engine)

app.include_router(game_router)
app.include_router(auth_routes.router)


@app.get("/")
def root():
    return {"message": "Radlands Backend Running"}
