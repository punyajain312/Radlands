import random
from sqlalchemy.orm import Session # type: ignore
from app.models.card import Card
from app.models.game_state import GameState
from app.core.deck import generate_shuffled_deck


def initialize_game_state(db: Session, game) -> GameState:

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

    # Starting player gets 1 water; opponent gets 3 (they'll take first turn soon)
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
                "discard": [],
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
                "discard": [],
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
    except Exception:
        db.rollback()
        raise

    return game_state


def draw_card(state: dict, player_id: int) -> str | None:

    player = state["players"][str(player_id)]

    if len(state["deck"]) == 0:
        if len(state["discard"]) == 0:
            # Nothing left anywhere — game ends in draw
            return "DRAW"

        if state["deck_cycles"] >= 2:
            # Already on the second deck — exhausting it triggers a draw
            return "DRAW"

        # Reshuffle discard into deck
        state["deck"] = state["discard"]
        state["discard"] = []
        random.shuffle(state["deck"])
        state["deck_cycles"] += 1

    card = state["deck"].pop(0)
    player["hand"].append(card)
    return card


def advance_events(state: dict, player_id: int, db) -> list[dict]:
    """
    Advance all queued events for player_id by one tick.
    Returns a list of events that fired this tick (for the response).
    """
    from app.models.card import Card as CardModel

    player = state["players"][str(player_id)]
    fired = []

    for slot_idx, slot in enumerate(player["events"]):
        if slot is None:
            continue

        slot["turns_remaining"] -= 1

        if slot["turns_remaining"] <= 0:
            card_def = db.query(CardModel).filter(CardModel.id == slot["card_id"]).first()
            fired.append({"slot": slot_idx, "card_id": slot["card_id"]})
            player["events"][slot_idx] = None
            # Caller must execute play_effect from card_def if desired

    return fired


def check_game_end(state: dict, game) -> dict:
    destroyed_players = [
        int(pid)
        for pid, pdata in state["players"].items()
        if all(c.get("destroyed", False) for c in pdata["camps"])
    ]

    if len(destroyed_players) == 1:
        loser = destroyed_players[0]
        winner = game.player2_id if loser == game.player1_id else game.player1_id
        return {"game_over": True, "winner_id": winner, "loser_id": loser}

    if len(destroyed_players) > 1:
        return {"game_over": True, "winner_id": None, "draw": True}

    return {"game_over": False}
