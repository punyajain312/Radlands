from sqlalchemy import Column, Integer, ForeignKey, String, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.database import Base

class Game(Base):
    __tablename__ = "games"

    id = Column(Integer, primary_key=True, index=True)

    player1_id = Column(Integer, ForeignKey("players.id"), nullable=False)
    player2_id = Column(Integer, ForeignKey("players.id"), nullable=False)

    status = Column(String, default="waiting")  # waiting / active / finished
    current_turn_player_id = Column(Integer, ForeignKey("players.id"), nullable=True)
    winner_id = Column(Integer, ForeignKey("players.id"), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    player1 = relationship("Player", foreign_keys=[player1_id])
    player2 = relationship("Player", foreign_keys=[player2_id])