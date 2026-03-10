import random
from sqlalchemy.orm import Session
from app.models.card import Card
from app.models.game_state import GameState
from app.core.deck import generate_shuffled_deck


def initialize_game_state(db: Session, game):

    # Generate shuffled deck
    deck = generate_shuffled_deck(db)

    # Fetch all camp cards
    camps = db.query(Card).filter(Card.type == "camp").all()

    if len(camps) < 6:
        raise Exception("Not enough camp cards seeded.")

    random.shuffle(camps)

    # Assign camps
    player1_camps = camps[:3]
    player2_camps = camps[3:6]

    # Determine initial draw
    player1_draw = sum(c.initial_draw or 0 for c in player1_camps)
    player2_draw = sum(c.initial_draw or 0 for c in player2_camps)

    # Draw cards safely
    if len(deck) < (player1_draw + player2_draw):
        raise Exception("Deck does not contain enough cards for initial draw")

    player1_hand = [deck.pop() for _ in range(player1_draw)]
    player2_hand = [deck.pop() for _ in range(player2_draw)]

    # Random starting player
    start_player = random.choice([game.player1_id, game.player2_id])

    game.start_player_id = start_player
    game.current_turn_player_id = start_player
    game.turn_number = 1
    game.status = "active"

    # Assign starting water
    player1_water = 1 if start_player == game.player1_id else 3
    player2_water = 1 if start_player == game.player2_id else 3

    state = {
        "deck": deck,
        "discard": [],
        "turn_context": {
            "people_played_this_turn": 0
        },
        "players": {
            str(game.player1_id): {
                "hand": player1_hand,
                "water": player1_water,
                "camps": [
                    {"card_id": c.id, "damage": 0, "destroyed": False}
                    for c in player1_camps
                ],
                "columns": [[], [], []],
                "events": [None, None, None]
            },
            str(game.player2_id): {
                "hand": player2_hand,
                "water": player2_water,
                "camps": [
                    {"card_id": c.id, "damage": 0, "destroyed": False}
                    for c in player2_camps
                ],
                "columns": [[], [], []],
                "events": [None, None, None]
            }
        }
    }

    game_state = GameState(
        game_id=game.id,
        state_json=state
    )

    db.add(game_state)
    db.commit()
    db.refresh(game_state)

    return game_state