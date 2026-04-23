from sqlalchemy import Column, Integer, ForeignKey, DateTime # type: ignore
from sqlalchemy.dialects.postgresql import JSONB # type: ignore
from sqlalchemy.sql import func # type: ignore
from app.db.database import Base


class GameState(Base):
    __tablename__ = "game_states"

    id = Column(Integer, primary_key=True, index=True)

    # One-to-one with Game
    game_id = Column(Integer, ForeignKey("games.id", ondelete="CASCADE"), nullable=False, unique=True)

    # Full board snapshot
    state_json = Column(JSONB, nullable=False)

    # Optimistic locking / versioning (important later)
    version = Column(Integer, nullable=False, default=1)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())