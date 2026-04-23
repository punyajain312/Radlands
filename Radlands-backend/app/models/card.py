from sqlalchemy import Column, String, Integer # type: ignore
from sqlalchemy.dialects.postgresql import JSONB # type: ignore
from app.db.database import Base


class Card(Base):
    __tablename__ = "cards"

    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)
    type = Column(String, nullable=False)

    cost = Column(JSONB, nullable=True)
    data = Column(JSONB, nullable=False)

    count = Column(Integer, nullable=False, default=1)