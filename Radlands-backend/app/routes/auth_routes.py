from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session # type: ignore
from app.db.dependencies import get_db
from app.models.player import Player
from app.models.game import Game
from app.schemas.auth import RegisterRequest, LoginRequest, DeleteRequest, TokenResponse
from app.core.security import hash_password, verify_password, create_access_token

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post("/register", response_model=TokenResponse)
def register(request: RegisterRequest, db: Session = Depends(get_db)):
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

    return TokenResponse(access_token=create_access_token(user.id), user_id=user.id)


@router.post("/login", response_model=TokenResponse)
def login(request: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(Player).filter(Player.username == request.username).first()

    if not user or not verify_password(request.password, user.password):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    return TokenResponse(access_token=create_access_token(user.id), user_id=user.id)


@router.post("/delete")
def delete(request: DeleteRequest, db: Session = Depends(get_db)):
    user = db.query(Player).filter(Player.username == request.username).first()

    if not user or not verify_password(request.password, user.password):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    db.query(Game).filter(
        (Game.player1_id == user.id) | (Game.player2_id == user.id)
    ).delete(synchronize_session=False)

    db.delete(user)
    db.commit()

    return {
        "message": "User deleted",
        "user_id": user.id
    }