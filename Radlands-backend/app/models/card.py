from sqlalchemy import Column, Integer, String
from sqlalchemy.dialects.postgresql import JSONB
from app.db.database import Base


class Card(Base):
    __tablename__ = "cards"

    # Deterministic ID (from JSON)
    id = Column(Integer, primary_key=True, index=True)

    name = Column(String, nullable=False)
    type = Column(String, nullable=False)  # person | event | camp

    cost = Column(Integer, nullable=True)
    health = Column(Integer, nullable=True)

    # Number of copies in deck
    count = Column(Integer, nullable=False, default=0)

    # Structured engine fields
    ability = Column(JSONB, nullable=True)
    junk_ability = Column(JSONB, nullable=True)
    on_play = Column(JSONB, nullable=True)
    passive = Column(JSONB, nullable=True)
    event_effect = Column(JSONB, nullable=True)

    bomb_number = Column(Integer, nullable=True)
    initial_draw = Column(Integer, nullable=True)