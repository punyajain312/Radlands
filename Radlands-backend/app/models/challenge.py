from sqlalchemy import Column, Integer, String, DateTime, ForeignKey  # type: ignore
from sqlalchemy.sql import func  # type: ignore
from app.db.database import Base


class GameChallenge(Base):
    __tablename__ = "game_challenges"

    id            = Column(Integer, primary_key=True, index=True)
    challenger_id = Column(Integer, ForeignKey("players.id"), nullable=False)
    challenged_id = Column(Integer, ForeignKey("players.id"), nullable=False)
    status        = Column(String, default="pending", nullable=False)  # pending, accepted, declined, cancelled
    scheduled_at  = Column(DateTime(timezone=True), nullable=True)
    message       = Column(String(500), nullable=True)
    created_at    = Column(DateTime(timezone=True), server_default=func.now())
