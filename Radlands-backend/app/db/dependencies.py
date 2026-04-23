from app.db.database import SessionLocal
from sqlalchemy.orm import Session # type: ignore

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()