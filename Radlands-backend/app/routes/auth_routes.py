import os
import re
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session # type: ignore
from google.oauth2 import id_token as google_id_token # type: ignore
from google.auth.transport import requests as google_requests # type: ignore
from app.db.dependencies import get_db
from app.models.player import Player
from app.models.game import Game
from app.schemas.auth import RegisterRequest, LoginRequest, DeleteRequest, GoogleLoginRequest, TokenResponse
from app.core.security import hash_password, verify_password, create_access_token
from app.core.auth_deps import get_current_player_id
from app.core.rate_limiter import auth_rate_limit

router = APIRouter(prefix="/auth", tags=["Auth"])

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")

def _slugify(name: str) -> str:
    return re.sub(r"[^a-zA-Z0-9_]", "", name.replace(" ", "_")) or "user"

def _unique_username(base: str, db: Session) -> str:
    candidate = base[:20]
    if not db.query(Player.id).filter(Player.username == candidate).scalar():
        return candidate
    i = 1
    while True:
        candidate = f"{base[:18]}_{i}"
        if not db.query(Player.id).filter(Player.username == candidate).scalar():
            return candidate
        i += 1

@router.post("/register", response_model=TokenResponse)
def register(request: RegisterRequest, db: Session = Depends(get_db), _: None = Depends(auth_rate_limit)):
    existing = db.query(Player).filter(
        (Player.username == request.username) | (Player.email == request.email)
    ).first()

    if existing:
        raise HTTPException(status_code=400, detail="Username or email already taken")

    user = Player(
        username=request.username,
        email=request.email,
        password=hash_password(request.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    return TokenResponse(
        access_token=create_access_token(user.id),
        user_id=user.id,
        username=user.username,
    )


@router.post("/login", response_model=TokenResponse)
def login(request: LoginRequest, db: Session = Depends(get_db), _: None = Depends(auth_rate_limit)):
    user = db.query(Player).filter(Player.username == request.username).first()

    if not user or not verify_password(request.password, user.password):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    return TokenResponse(
        access_token=create_access_token(user.id),
        user_id=user.id,
        username=user.username,
    )


@router.get("/me")
def get_me(
    current_player_id: int = Depends(get_current_player_id),
    db: Session = Depends(get_db),
):
    player = db.query(Player).filter(Player.id == current_player_id).first()
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")
    return {
        "user_id": player.id,
        "username": player.username,
        "email": player.email,
        "games_played": player.games_played or 0,
        "games_won": player.games_won or 0,
        "games_lost": player.games_lost or 0,
        "card_play_counts": player.card_play_counts or {},
    }


@router.post("/delete")
def delete(request: DeleteRequest, db: Session = Depends(get_db)):
    user = db.query(Player).filter(Player.username == request.username).first()

    if not user or not user.password or not verify_password(request.password, user.password):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    db.query(Game).filter(
        (Game.player1_id == user.id) | (Game.player2_id == user.id)
    ).delete(synchronize_session=False)

    db.delete(user)
    db.commit()

    return {"message": "User deleted", "user_id": user.id}


@router.post("/google", response_model=TokenResponse)
def google_login(request: GoogleLoginRequest, db: Session = Depends(get_db)):
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=503, detail="Google login not configured")

    try:
        info = google_id_token.verify_oauth2_token(
            request.id_token,
            google_requests.Request(),
            GOOGLE_CLIENT_ID,
        )
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid Google token")

    google_id = info["sub"]
    email = info.get("email", "")
    name = info.get("name", "")

    user = db.query(Player).filter(Player.google_id == google_id).first()

    if not user:
        user = db.query(Player).filter(Player.email == email).first()
        if user:
            user.google_id = google_id
        else:
            username = _unique_username(_slugify(name) or "user", db)
            user = Player(
                username=username,
                email=email,
                google_id=google_id,
                password=None,
            )
            db.add(user)

    db.commit()
    db.refresh(user)

    return TokenResponse(
        access_token=create_access_token(user.id),
        user_id=user.id,
        username=user.username,
    )
