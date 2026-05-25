import os
import re
from datetime import datetime, timezone, timedelta
from pydantic import BaseModel, field_validator
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
        access_token=create_access_token(user.id, user.token_version or 0),
        user_id=user.id,
        username=user.username,
    )


@router.post("/login", response_model=TokenResponse)
def login(request: LoginRequest, db: Session = Depends(get_db), _: None = Depends(auth_rate_limit)):
    user = db.query(Player).filter(Player.username == request.username).first()

    if not user or not verify_password(request.password, user.password):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    user.token_version = (user.token_version or 0) + 1
    db.commit()

    return TokenResponse(
        access_token=create_access_token(user.id, user.token_version),
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


class ChangeUsernameRequest(BaseModel):
    new_username: str

    @field_validator("new_username")
    @classmethod
    def validate(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 3:
            raise ValueError("Username must be at least 3 characters")
        return v

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def validate(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        if not any(c.isupper() for c in v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not any(c.isdigit() for c in v):
            raise ValueError("Password must contain at least one number")
        return v


@router.patch("/me/username")
def change_username(
    body: ChangeUsernameRequest,
    current_player_id: int = Depends(get_current_player_id),
    db: Session = Depends(get_db),
):
    player = db.query(Player).filter(Player.id == current_player_id).first()
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")

    if player.username_changed_at:
        age = datetime.now(timezone.utc) - player.username_changed_at.replace(tzinfo=timezone.utc)
        if age < timedelta(days=7):
            days_left = 7 - age.days
            raise HTTPException(
                status_code=400,
                detail=f"Username can only be changed once a week. Try again in {days_left} day(s).",
            )

    conflict = db.query(Player).filter(
        Player.username == body.new_username,
        Player.id != current_player_id,
    ).first()
    if conflict:
        raise HTTPException(status_code=400, detail="Username already taken")

    player.username = body.new_username
    player.username_changed_at = datetime.now(timezone.utc)
    db.commit()
    return {"message": "Username updated", "username": player.username}


@router.patch("/me/password")
def change_password(
    body: ChangePasswordRequest,
    current_player_id: int = Depends(get_current_player_id),
    db: Session = Depends(get_db),
):
    player = db.query(Player).filter(Player.id == current_player_id).first()
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")
    if not player.password:
        raise HTTPException(status_code=400, detail="Account uses Google sign-in — no password to change")
    if not verify_password(body.current_password, player.password):
        raise HTTPException(status_code=401, detail="Current password is incorrect")

    player.password = hash_password(body.new_password)
    db.commit()
    return {"message": "Password updated"}


@router.get("/me/username-change-status")
def username_change_status(
    current_player_id: int = Depends(get_current_player_id),
    db: Session = Depends(get_db),
):
    player = db.query(Player).filter(Player.id == current_player_id).first()
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")

    if not player.username_changed_at:
        return {"can_change": True, "days_until_change": 0, "last_changed": None}

    age = datetime.now(timezone.utc) - player.username_changed_at.replace(tzinfo=timezone.utc)
    can_change = age >= timedelta(days=7)
    days_left = max(0, 7 - age.days)
    return {
        "can_change": can_change,
        "days_until_change": days_left,
        "last_changed": player.username_changed_at.isoformat(),
    }


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

    user.token_version = (user.token_version or 0) + 1
    db.commit()
    db.refresh(user)

    return TokenResponse(
        access_token=create_access_token(user.id, user.token_version),
        user_id=user.id,
        username=user.username,
    )
