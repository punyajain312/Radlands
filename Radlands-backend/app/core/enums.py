from enum import StrEnum

class GameStatus(StrEnum):
    WAITING = "waiting"
    INITIALIZING = "initializing"
    ACTIVE = "active"
    FINISHED = "finished"

class CardType(StrEnum):
    PERSON = "person"
    EVENT = "event"
    CAMP = "camp"
