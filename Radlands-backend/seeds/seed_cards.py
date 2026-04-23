import json
import os
from app.db.database import SessionLocal
from app.models.card import Card

BASE_DIR = os.path.dirname(os.path.abspath(__file__))


def load_json(filename):
    path = os.path.join(BASE_DIR, filename)
    with open(path, "r") as f:
        return json.load(f)


def seed_file(db, filename, card_type):
    cards = load_json(filename)

    for card_data in cards:
        card_id = str(card_data["id"])  # ensure string consistency

        # Check if already exists
        existing = db.query(Card).filter(Card.id == card_id).first()
        if existing:
            continue

        card = Card(
            id=card_id,
            name=card_data["name"],
            type=card_type,  # force type (fixes your error)
            cost=card_data.get("cost", {}),
            data=card_data  # full JSON stored here
        )

        db.add(card)


def seed_all():
    db = SessionLocal()

    try:
        print("Seeding events...")
        seed_file(db, "events.json", "event")

        print("Seeding people...")
        seed_file(db, "people.json", "person")

        print("Seeding camps...")
        seed_file(db, "camps.json", "camp")

        db.commit()
        print("Seeding complete")

    except Exception as e:
        db.rollback()
        print("Error during seeding:", e)

    finally:
        db.close()


if __name__ == "__main__":
    seed_all()