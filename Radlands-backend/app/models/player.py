from sqlalchemy import Column, Integer, String, DateTime, JSON # type: ignore
from sqlalchemy.sql import func # type: ignore
from app.db.database import Base

class Player(Base):
    __tablename__ = "players"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, nullable=False)
    email = Column(String, unique=True, nullable=False)
    password = Column(String, nullable=True)
    google_id = Column(String, unique=True, nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    username_changed_at = Column(DateTime(timezone=True), nullable=True)

    # Stats
    games_played = Column(Integer, default=0, nullable=False, server_default="0")
    games_won = Column(Integer, default=0, nullable=False, server_default="0")
    games_lost = Column(Integer, default=0, nullable=False, server_default="0")
    card_play_counts = Column(JSON, nullable=True)

    # Rating — starts at 0 (SURVIVOR tier), ELO-style deltas, floor 0
    rating = Column(Integer, default=0, nullable=False, server_default="0")

    # Incremented on each new login — invalidates all prior tokens
    token_version = Column(Integer, default=0, nullable=False, server_default="0")
