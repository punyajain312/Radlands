from fastapi import HTTPException
def execute_effect(state, effect, target):

    effect_type = effect["type"]

    if effect_type == "damage":
        apply_damage(state, effect, target)

    # elif effect_type == "heal":
    #     apply_heal(state, effect, target)

    # elif effect_type == "destroy":
    #     apply_destroy(state, effect, target)

    # elif effect_type == "gain_water":
    #     apply_gain_water(state, effect, target)

    elif effect_type == "sequence":
        for step in effect["steps"]:
            execute_effect(state, step, target)

    else:
        raise Exception(f"Unknown effect type: {effect_type}")
    

def apply_damage(state, effect, target):

    amount = effect["amount"]

    if target["type"] == "person":
        player = state["players"][str(target["player_id"])]
        column = player["columns"][target["column"]]

        # Validate position
        if target["position"] >= len(column):
            raise HTTPException(status_code=400, detail="Camp already destroyed")

        person = column[target["position"]]

        if person.get("destroyed"):
            raise HTTPException(status_code=400, detail="Camp already destroyed")

        person["damage"] = person.get("damage", 0) + amount

        if person["damage"] >= 2:
            destroyed = column.pop(target["position"])
            player["discard"].append(destroyed["card_id"])

    elif target["type"] == "camp":
        player = state["players"][str(target["player_id"])]
        camp = player["camps"][target["camp_index"]]

        if camp.get("destroyed"):
            raise HTTPException(status_code=400, detail="Camp already destroyed")

        # Apply damage
        camp["damage"] = camp.get("damage", 0) + amount

        # Destroy camp
        if camp["damage"] >= 2:
            camp["destroyed"] = True

