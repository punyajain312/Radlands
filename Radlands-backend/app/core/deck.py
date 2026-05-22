import random
from sqlalchemy.orm import Session # type: ignore
from app.models.card import Card


def generate_shuffled_deck(db):
    cards = db.query(Card).filter(
        Card.type.in_(["person", "event"])
    ).all()

    deck = []
    for card in cards:
        if card.data.get("special"):
            continue
        copies = card.count if card.count and card.count > 0 else 1
        deck.extend([card.id] * copies)

    random.shuffle(deck)
    return deck