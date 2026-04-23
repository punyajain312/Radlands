import random
from sqlalchemy.orm import Session # type: ignore
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

    camps = random.sample(camps, 6)

    # Assign camps
    player1_camps = camps[:3]
    player2_camps = camps[3:]

    # Determine initial draw
    player1_draw = sum(c.data.get("initial_draw", 0) for c in player1_camps)
    player2_draw = sum(c.data.get("initial_draw", 0) for c in player2_camps)

    # Draw cards safely
    if len(deck) < (player1_draw + player2_draw):
        raise Exception("Deck does not contain enough cards for initial draw")

    player1_hand = [deck.pop() for _ in range(player1_draw)]
    player2_hand = [deck.pop() for _ in range(player2_draw)]

    # Random starting player
    start_player = random.choice([game.player1_id, game.player2_id])

    # Update game
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
        "deck_cycles": 1,
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

    try:
        db.add(game)
        db.add(game_state)
        db.commit()
        db.refresh(game)
        db.refresh(game_state)
    except:
        db.rollback()
        raise

    return game_state

# Draw Card on Turn Change
def draw_card(player: dict):

    # If deck empty → reshuffle
    if len(player["deck"]) == 0:

        if len(player["discard"]) == 0:
            return None  # nothing to draw

        # Reshuffle discard into deck
        player["deck"] = player["discard"]
        player["discard"] = []
        random.shuffle(player["deck"])

        player["deck_cycles"] += 1

    # Draw card
    card = player["deck"].pop(0)
    player["hand"].append(card)

    return card

# Game Checker
def check_game_end(state, game):

    destroyed_players = []

    for player_id, player_data in state["players"].items():
        if all(camp.get("destroyed", False) for camp in player_data["camps"]):
            destroyed_players.append(int(player_id))

    if len(destroyed_players) == 1:
        loser = destroyed_players[0]
        winner = game.player2_id if loser == game.player1_id else game.player1_id

        return {
            "game_over": True,
            "winner_id": winner,
            "loser_id": loser
        }

    elif len(destroyed_players) > 1:
        return {
            "game_over": True,
            "winner_id": None,  # draw
            "draw": True
        }

    return {"game_over": False}

