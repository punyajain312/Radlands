from pydantic import BaseModel
from enum import Enum

class CreateGameRequest(BaseModel):
    player1_id: int
    player2_id: int

class EndTurnRequest(BaseModel):
    player_id: int

class PlayPersonRequest(BaseModel):
    player_id: int
    card_id: int
    column_index: int

class TargetType(str, Enum):
    person = "person"
    camp = "camp"

class TargetSide(str, Enum):
    self = "self"
    opponent = "opponent"


class ActivateAbilityRequest(BaseModel):
    player_id: int
    column_index: int
    position_index: int

    target_type: TargetType
    target_side: TargetSide

    target_column: int | None = None
    target_position: int | None = None
    target_camp_index: int | None = None