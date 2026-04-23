from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session # type: ignore
from app.db.dependencies import get_db
from app.models.player import Player
from app.schemas.auth import RegisterRequest, LoginRequest
from app.core.security import hash_password, verify_password

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post("/register")
def register(request: RegisterRequest, db: Session = Depends(get_db)):

    # Check if user exists
    existing_user = db.query(Player).filter(
        (Player.username == request.username) |
        (Player.email == request.email)
    ).first()

    if existing_user:
        raise HTTPException(status_code=400, detail="User already exists")

    # Create user
    new_user = Player(
        username=request.username,
        email=request.email,
        password=hash_password(request.password)
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return {
        "message": "User registered successfully",
        "user_id": new_user.id
    }


@router.post("/login")
def login(request: LoginRequest, db: Session = Depends(get_db)):

    user = db.query(Player).filter(Player.username == request.username).first()

    if not user:
        raise HTTPException(status_code=400, detail="Invalid credentials")

    if not verify_password(request.password, user.password):
        raise HTTPException(status_code=400, detail="Invalid credentials")

    return {
        "message": "Login successful",
        "user_id": user.id
    }