import random
from sqlalchemy.orm import Session
from app.models.card import Card


def generate_shuffled_deck(db: Session):
    """
    Builds the full shared Radlands deck using
    card.count for each person/event card.
    Returns a shuffled list of card IDs.
    """

    deck = []

    cards = db.query(Card).filter(Card.type.in_(["person", "event"])).all()

    for card in cards:
        if card.count > 0:
            deck.extend([card.id] * card.count)

    random.shuffle(deck)

    return deck