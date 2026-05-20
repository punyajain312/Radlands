from sqlalchemy import Column, Integer, String, DateTime # type: ignore
from sqlalchemy.sql import func # type: ignore
from app.db.database import Base

class Player(Base):
    __tablename__ = "players"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, nullable=False)
    email = Column(String, unique=True, nullable=False)
    password = Column(String, nullable=True)  # null for OAuth-only accounts
    google_id = Column(String, unique=True, nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())