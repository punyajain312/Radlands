def execute_effect(state, effect, target):

    effect_type = effect["type"]

    if effect_type == "damage":
        apply_damage(state, effect, target)

    elif effect_type == "heal":
        apply_heal(state, effect, target)

    elif effect_type == "destroy":
        apply_destroy(state, effect, target)

    elif effect_type == "gain_water":
        apply_gain_water(state, effect, target)

    elif effect_type == "sequence":
        for step in effect["steps"]:
            execute_effect(state, step, target)

    else:
        raise Exception(f"Unknown effect type: {effect_type}")
    

def apply_damage(state, effect, target):

    amount = effect["amount"]

    if target["type"] == "person":
        person = state["players"][str(target["player_id"])]["columns"][
            target["column"]
        ][target["position"]]

        person["damage"] += amount

    elif target["type"] == "camp":
        camp = state["players"][str(target["player_id"])]["camps"][
            target["camp_index"]
        ]

        camp["damage"] += amount


