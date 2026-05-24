"""
Effect execution engine.

Two ability schemas exist in the seed data:

  Person cards  →  ability["effects"] is a list, amounts use "value" key,
                   targets use {"scope": "...", "side": "..."}.

  Camp cards    →  ability["effect"] is a single object, amounts use "amount"
                   key, targets use string shortcuts like "unprotected".

This engine normalizes both and dispatches to per-effect handlers.
"""

import random
from fastapi import HTTPException

# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

def execute_effect(
    state: dict,
    effect: dict,
    caller_target: dict | None,
    acting_player_id: int,
    opponent_player_id: int,
) -> None:
    """Execute one effect node from a card ability definition."""
    etype = effect.get("type")

    if etype == "damage":
        _exec_damage(state, effect, caller_target, acting_player_id, opponent_player_id)

    elif etype == "destroy":
        _exec_destroy(state, effect, caller_target, acting_player_id, opponent_player_id)

    elif etype == "restore":
        _exec_restore(state, caller_target)

    elif etype == "gain_water" or etype == "water":
        _exec_gain_water(state, effect, acting_player_id)

    elif etype == "draw":
        _exec_draw(state, effect, acting_player_id)

    elif etype == "injure":
        _exec_injure(state, effect, acting_player_id, opponent_player_id)

    elif etype == "discard":
        _exec_discard(state, effect, caller_target, acting_player_id, opponent_player_id)

    elif etype == "return":
        _exec_return(state, effect, caller_target, acting_player_id, opponent_player_id)

    elif etype == "sequence":
        for step in effect.get("steps", []):
            execute_effect(state, step, caller_target, acting_player_id, opponent_player_id)

    elif etype == "ready":
        _exec_ready(state, caller_target)

    elif etype == "raid":
        _exec_raid(state, acting_player_id, opponent_player_id)

    elif etype == "gain_punk":
        _exec_gain_punk(state, caller_target, acting_player_id)

    elif etype == "flip_punk":
        _exec_flip_punk(state, caller_target, acting_player_id)

    elif etype in (
        "conditional_effect", "choice", "peek", "copy_ability",
        "modify_state", "rearrange", "draw_select",
        "move", "conditional_play_for_free", "optional_reorder",
        "draw_per_destroyed", "destroy_all_but_one",
    ):
        raise HTTPException(
            status_code=501,
            detail=f"Effect '{etype}' is not yet implemented.",
        )

    else:
        raise HTTPException(status_code=400, detail=f"Unknown effect type: '{etype}'")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _amount(effect: dict) -> int:
    """Normalize 'amount' (camps schema) vs 'value' (people schema)."""
    return effect.get("amount", effect.get("value", 1))


def is_camp_protected(state: dict, player_id: int, camp_index: int) -> bool:
    """A camp is protected when at least one person stands in its column."""
    return len(state["players"][str(player_id)]["columns"][camp_index]) > 0


def cleanup_dead_people(state: dict) -> None:
    """
    Sweep all columns. Punks die at 1 damage; regular people die at 2.
    Removed cards go to the player's personal discard pile.
    """
    for player_id, player in state["players"].items():
        for col_idx in range(len(player["columns"])):
            alive = []
            for person in player["columns"][col_idx]:
                threshold = 1 if person.get("is_punk") else 2
                if person.get("damage", 0) >= threshold:
                    player["discard"].append(person["card_id"])
                else:
                    alive.append(person)
            player["columns"][col_idx] = alive


def _resolve_targets(
    state: dict,
    effect: dict,
    caller_target: dict | None,
    acting_player_id: int,
    opponent_player_id: int,
) -> list[dict]:
    """
    Turn the effect's target spec into a flat list of resolved target dicts.

    Resolved target dict shape:
      { "type": "person"|"camp",
        "player_id": int,
        "column": int,       # only for persons
        "position": int,     # only for persons
        "camp_index": int }  # only for camps
    """
    target_spec = effect.get("target")

    # ---- string shortcuts (camp ability schema) ----
    if isinstance(target_spec, str):
        if target_spec in ("unprotected",):
            # All unprotected enemy entities (people + exposed camps)
            targets: list[dict] = []
            opp = state["players"][str(opponent_player_id)]
            for col_idx, col in enumerate(opp["columns"]):
                for pos_idx in range(len(col)):
                    targets.append({
                        "type": "person",
                        "player_id": opponent_player_id,
                        "column": col_idx,
                        "position": pos_idx,
                    })
            for camp_idx, camp in enumerate(opp["camps"]):
                if not camp.get("destroyed") and not is_camp_protected(
                    state, opponent_player_id, camp_idx
                ):
                    targets.append({
                        "type": "camp",
                        "player_id": opponent_player_id,
                        "camp_index": camp_idx,
                    })
            return targets

        if target_spec == "one_of_your_people":
            # Caller must supply a friendly person target
            if not caller_target or caller_target.get("type") != "person":
                raise HTTPException(
                    status_code=400,
                    detail="You must select one of your own people as the target.",
                )
            if caller_target["player_id"] != acting_player_id:
                raise HTTPException(
                    status_code=400,
                    detail="Target must be one of your own people.",
                )
            return [caller_target]

        if target_spec == "all_people":
            targets = []
            for pid in [acting_player_id, opponent_player_id]:
                player = state["players"][str(pid)]
                for col_idx, col in enumerate(player["columns"]):
                    for pos_idx in range(len(col)):
                        targets.append({
                            "type": "person",
                            "player_id": pid,
                            "column": col_idx,
                            "position": pos_idx,
                        })
            return targets

        # "self" as a camp target is handled by the activate-camp endpoint
        # which passes the activating camp as caller_target
        if target_spec == "self":
            if caller_target is None:
                raise HTTPException(status_code=400, detail="Self-target requires context.")
            return [caller_target]

        raise HTTPException(
            status_code=501,
            detail=f"String target '{target_spec}' is not implemented.",
        )

    # ---- dict target spec (person ability schema) ----
    if isinstance(target_spec, dict):
        scope = target_spec.get("scope", "one")
        side = target_spec.get("side", "enemy")
        filters = target_spec.get("filters", {})

        if side == "enemy":
            pids = [opponent_player_id]
        elif side == "self":
            pids = [acting_player_id]
        else:
            pids = [acting_player_id, opponent_player_id]

        if scope == "one":
            if caller_target is None:
                raise HTTPException(
                    status_code=400,
                    detail="This ability requires a target.",
                )
            return [caller_target]

        if scope == "all":
            targets = []
            target_types = filters.get("type", ["people", "camp"])
            normalised = {
                t.replace("people", "person") for t in target_types
            }
            for pid in pids:
                player = state["players"][str(pid)]
                if "person" in normalised:
                    for col_idx, col in enumerate(player["columns"]):
                        for pos_idx in range(len(col)):
                            targets.append({
                                "type": "person",
                                "player_id": pid,
                                "column": col_idx,
                                "position": pos_idx,
                            })
                if "camp" in normalised:
                    for camp_idx, camp in enumerate(player["camps"]):
                        if not camp.get("destroyed"):
                            targets.append({
                                "type": "camp",
                                "player_id": pid,
                                "camp_index": camp_idx,
                            })
            return targets

        if scope == "column":
            if caller_target is None:
                raise HTTPException(
                    status_code=400,
                    detail="column-scope ability requires a target column.",
                )
            col_idx = caller_target.get("column", 0)
            pid = pids[0]
            player = state["players"][str(pid)]
            targets = []
            for pos_idx in range(len(player["columns"][col_idx])):
                targets.append({
                    "type": "person",
                    "player_id": pid,
                    "column": col_idx,
                    "position": pos_idx,
                })
            camp = player["camps"][col_idx]
            if not camp.get("destroyed"):
                targets.append({
                    "type": "camp",
                    "player_id": pid,
                    "camp_index": col_idx,
                })
            return targets

        raise HTTPException(
            status_code=501,
            detail=f"Target scope '{scope}' is not implemented.",
        )

    # No target spec — use whatever the caller provided
    return [caller_target] if caller_target else []


# ---------------------------------------------------------------------------
# Per-effect handlers
# ---------------------------------------------------------------------------

def _exec_damage(state, effect, caller_target, acting_player_id, opponent_player_id):
    amount = _amount(effect)
    targets = _resolve_targets(state, effect, caller_target, acting_player_id, opponent_player_id)

    for t in targets:
        if t["type"] == "person":
            player = state["players"][str(t["player_id"])]
            col = player["columns"][t["column"]]
            if t["position"] < len(col):
                col[t["position"]]["damage"] = col[t["position"]].get("damage", 0) + amount

        elif t["type"] == "camp":
            player = state["players"][str(t["player_id"])]
            camp = player["camps"][t["camp_index"]]
            if not camp.get("destroyed"):
                camp["damage"] = camp.get("damage", 0) + amount
                if camp["damage"] >= 2:
                    camp["destroyed"] = True

    cleanup_dead_people(state)


def _exec_destroy(state, effect, caller_target, acting_player_id, opponent_player_id):
    targets = _resolve_targets(state, effect, caller_target, acting_player_id, opponent_player_id)

    # Collect persons to destroy (don't mutate while iterating)
    persons_to_destroy: list[tuple[dict, int, int]] = []  # (player_dict, col_idx, pos_idx)
    for t in targets:
        if t["type"] == "person":
            player = state["players"][str(t["player_id"])]
            col = player["columns"][t["column"]]
            if t["position"] < len(col):
                persons_to_destroy.append((player, t["column"], t["position"]))
        elif t["type"] == "camp":
            player = state["players"][str(t["player_id"])]
            player["camps"][t["camp_index"]]["destroyed"] = True

    # Remove persons in reverse-position order to keep indices stable
    for player, col_idx, pos_idx in sorted(
        persons_to_destroy, key=lambda x: (id(x[0]), x[1], x[2]), reverse=True
    ):
        col = player["columns"][col_idx]
        if pos_idx < len(col):
            removed = col.pop(pos_idx)
            player["discard"].append(removed["card_id"])


def _exec_restore(state, caller_target):
    """Heal 1 damage from a person or camp."""
    if caller_target is None:
        raise HTTPException(status_code=400, detail="restore requires a target.")

    if caller_target["type"] == "person":
        player = state["players"][str(caller_target["player_id"])]
        col = player["columns"][caller_target["column"]]
        if caller_target["position"] < len(col):
            person = col[caller_target["position"]]
            person["damage"] = max(0, person.get("damage", 0) - 1)

    elif caller_target["type"] == "camp":
        player = state["players"][str(caller_target["player_id"])]
        camp = player["camps"][caller_target["camp_index"]]
        if not camp.get("destroyed"):
            camp["damage"] = max(0, camp.get("damage", 0) - 1)


def _exec_gain_water(state, effect, acting_player_id):
    amount = _amount(effect)
    state["players"][str(acting_player_id)]["water"] += amount


def _exec_draw(state, effect, acting_player_id):
    amount = _amount(effect)
    player = state["players"][str(acting_player_id)]

    for _ in range(amount):
        if len(state["deck"]) == 0:
            if len(state["discard"]) == 0:
                break
            if state["deck_cycles"] >= 2:
                break
            state["deck"] = state["discard"]
            state["discard"] = []
            random.shuffle(state["deck"])
            state["deck_cycles"] += 1
        if state["deck"]:
            player["hand"].append(state["deck"].pop(0))


def _exec_injure(state, effect, acting_player_id, opponent_player_id):
    """Deal 1 damage to all people on the specified side(s)."""
    target_spec = effect.get("target", {})
    side = target_spec.get("side", "enemy") if isinstance(target_spec, dict) else "enemy"

    if side == "enemy":
        pids = [opponent_player_id]
    elif side == "self":
        pids = [acting_player_id]
    else:
        pids = [acting_player_id, opponent_player_id]

    for pid in pids:
        player = state["players"][str(pid)]
        for col in player["columns"]:
            for person in col:
                person["damage"] = person.get("damage", 0) + 1

    cleanup_dead_people(state)


def _exec_discard(state, effect, caller_target, acting_player_id, opponent_player_id):
    """
    Discard N cards.
    target scope "self" → acting player chooses (caller_target carries card_id).
    target scope "enemy_hand" → opponent discards randomly (server chooses for now).
    """
    amount = _amount(effect)
    target_spec = effect.get("target", {})
    side = target_spec.get("side", "self") if isinstance(target_spec, dict) else "self"
    scope = target_spec.get("scope", "self") if isinstance(target_spec, dict) else "self"

    if scope == "enemy_hand":
        opp = state["players"][str(opponent_player_id)]
        for _ in range(min(amount, len(opp["hand"]))):
            card = random.choice(opp["hand"])
            opp["hand"].remove(card)
            opp["discard"].append(card)
    else:
        # Self discard: caller must supply the card(s) via target; for now discard randomly
        actor = state["players"][str(acting_player_id)]
        for _ in range(min(amount, len(actor["hand"]))):
            card = random.choice(actor["hand"])
            actor["hand"].remove(card)
            actor["discard"].append(card)


def _exec_return(state, effect, caller_target, acting_player_id, opponent_player_id):
    """Return people from the field back to their owner's hand."""
    targets = _resolve_targets(state, effect, caller_target, acting_player_id, opponent_player_id)

    persons_to_return: list[tuple[dict, int, int]] = []
    for t in targets:
        if t["type"] != "person":
            continue
        player = state["players"][str(t["player_id"])]
        if t["position"] < len(player["columns"][t["column"]]):
            persons_to_return.append((player, t["column"], t["position"]))

    for player, col_idx, pos_idx in sorted(
        persons_to_return, key=lambda x: (id(x[0]), x[1], x[2]), reverse=True
    ):
        col = player["columns"][col_idx]
        if pos_idx < len(col):
            removed = col.pop(pos_idx)
            player["hand"].append(removed["card_id"])


def _exec_gain_punk(state, caller_target, acting_player_id):
    """Draw the top card of the deck and place it face-down as a punk in a column."""
    player = state["players"][str(acting_player_id)]

    if not state["deck"]:
        return  # Nothing to draw

    card_id = state["deck"].pop(0)

    # Try to use the caller's column hint, else first column with room
    target_col = None
    if caller_target and caller_target.get("type") == "person":
        target_col = caller_target.get("column")

    placed = False
    if target_col is not None and len(player["columns"][target_col]) < 2:
        player["columns"][target_col].append(
            {"card_id": card_id, "damage": 0, "ready": False, "is_punk": True}
        )
        placed = True

    if not placed:
        for col in player["columns"]:
            if len(col) < 2:
                col.append({"card_id": card_id, "damage": 0, "ready": False, "is_punk": True})
                placed = True
                break

    if not placed:
        state["discard"].append(card_id)


def _exec_flip_punk(state, caller_target, acting_player_id):
    """Flip a face-down punk face-up, making it a regular person."""
    player = state["players"][str(acting_player_id)]

    if caller_target and caller_target.get("type") == "person":
        col_idx = caller_target.get("column", 0)
        pos_idx = caller_target.get("position", 0)
        col = player["columns"][col_idx]
        if pos_idx < len(col) and col[pos_idx].get("is_punk"):
            col[pos_idx]["is_punk"] = False
            return

    # Fall back to first punk found
    for col in player["columns"]:
        for person in col:
            if person.get("is_punk"):
                person["is_punk"] = False
                return


def _exec_raid(state, acting_player_id, opponent_player_id):
    """Place or advance the Raiders event. When it resolves, damage one opponent camp."""
    player = state["players"][str(acting_player_id)]
    raiders_turns = player.get("raiders_turns")

    if raiders_turns is None:
        # Raiders not in queue — place at ②★ (2 turns away)
        player["raiders_in_play"] = False
        player["raiders_turns"] = 2
    elif raiders_turns <= 1:
        # Already at ①★ — resolve immediately
        player["raiders_in_play"] = True
        player["raiders_turns"] = None
        opp = state["players"][str(opponent_player_id)]
        for camp in opp["camps"]:
            if not camp.get("destroyed"):
                camp["damage"] = camp.get("damage", 0) + 1
                if camp["damage"] >= 2:
                    camp["destroyed"] = True
                break
    else:
        # Advance from ②★ to ①★
        player["raiders_turns"] = 1


def _exec_ready(state, caller_target):
    """Mark the target person as ready (used by Rescue Team's enter effect)."""
    if caller_target is None or caller_target.get("type") != "person":
        return
    player = state["players"][str(caller_target["player_id"])]
    col = player["columns"][caller_target["column"]]
    if caller_target["position"] < len(col):
        col[caller_target["position"]]["ready"] = True


# ---------------------------------------------------------------------------
# Condition checking (camp abilities)
# ---------------------------------------------------------------------------

def check_condition(state: dict, condition: dict, acting_player_id: int) -> bool:
    """
    Return True if the ability condition is satisfied.
    Unknown conditions are treated as passing so they don't silently block.
    """
    if not condition:
        return True

    cond_type = condition.get("type")
    operator = condition.get("operator", ">=")
    value = condition.get("value", 0)

    if cond_type == "people_played_this_turn":
        actual = state["turn_context"].get("people_played_this_turn", 0)
        return _compare(actual, operator, value)

    # Unknown condition — don't block
    return True


def _compare(actual, operator: str, value) -> bool:
    if operator == ">=":
        return actual >= value
    if operator == ">":
        return actual > value
    if operator == "==":
        return actual == value
    if operator == "<=":
        return actual <= value
    if operator == "<":
        return actual < value
    return True
