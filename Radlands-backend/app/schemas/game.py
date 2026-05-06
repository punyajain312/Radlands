from pydantic import BaseModel, field_validator
from enum import Enum
from typing import Optional


class CreateGameRequest(BaseModel):
    opponent_id: int


class PlayPersonRequest(BaseModel):
    card_id: str
    column_index: int

    @field_validator("column_index")
    @classmethod
    def valid_column(cls, v: int) -> int:
        if v not in (0, 1, 2):
            raise ValueError("column_index must be 0, 1, or 2")
        return v


class TargetType(str, Enum):
    person = "person"
    camp = "camp"


class TargetSide(str, Enum):
    self = "self"
    opponent = "opponent"


class ActivateAbilityRequest(BaseModel):
    """Activate an ability on a person card sitting in one of your columns."""
    column_index: int
    position_index: int
    ability_index: int = 0

    target_type: Optional[TargetType] = None
    target_side: Optional[TargetSide] = None
    target_column: Optional[int] = None
    target_position: Optional[int] = None
    target_camp_index: Optional[int] = None


class ActivateCampRequest(BaseModel):
    """Activate the ability of one of your (non-destroyed) camps."""
    camp_index: int
    ability_index: int = 0

    target_type: Optional[TargetType] = None
    target_side: Optional[TargetSide] = None
    target_column: Optional[int] = None
    target_position: Optional[int] = None
    target_camp_index: Optional[int] = None


class JunkCardRequest(BaseModel):
    """Discard a card from hand to trigger its junk effect."""
    card_id: str


class PlayEventRequest(BaseModel):
    """Play an event card from hand into the event queue."""
    card_id: str
    queue_slot: int

    @field_validator("queue_slot")
    @classmethod
    def valid_slot(cls, v: int) -> int:
        if v not in (0, 1, 2):
            raise ValueError("queue_slot must be 0, 1, or 2")
        return v
