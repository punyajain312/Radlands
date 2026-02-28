import json
import os
from app.db.database import SessionLocal
from app.models.card import Card


BASE_DIR = os.path.dirname(os.path.abspath(__file__))


def load_json(filename):
    path = os.path.join(BASE_DIR, filename)
    with open(path, "r") as f:
        return json.load(f)


def seed_file(filename):
    db = SessionLocal()
    cards_data = load_json(filename)

    for card_data in cards_data:
        existing = db.query(Card).filter(Card.id == card_data["id"]).first()
        if not existing:
            card = Card(**card_data)
            db.add(card)

    db.commit()
    db.close()


if __name__ == "__main__":
    seed_file("people.json")
    seed_file("events.json")
    seed_file("camps.json")

    print("Seeding complete")