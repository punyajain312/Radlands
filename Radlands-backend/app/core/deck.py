import random
from sqlalchemy.orm import Session # type: ignore
from app.models.card import Card


def generate_shuffled_deck(db):
    cards = db.query(Card).filter(
        Card.type.in_(["person", "event"])
    ).all()

    deck = []
    for card in cards:
        deck.extend([card.id, card.id]) 

    random.shuffle(deck)
    return deck