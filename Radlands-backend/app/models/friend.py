from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, UniqueConstraint # type: ignore
from sqlalchemy.sql import func # type: ignore
from app.db.database import Base

class FriendRequest(Base):
    __tablename__ = "friend_requests"

    id = Column(Integer, primary_key=True, index=True)
    sender_id = Column(Integer, ForeignKey("players.id"), nullable=False)
    receiver_id = Column(Integer, ForeignKey("players.id"), nullable=False)
    status = Column(String, default="pending", nullable=False)  # pending / accepted / rejected
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        UniqueConstraint("sender_id", "receiver_id", name="uq_friend_request"),
    )
