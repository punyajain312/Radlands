from typing import Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel  # type: ignore
from sqlalchemy.orm import Session  # type: ignore
from app.db.dependencies import get_db
from app.models.player import Player
from app.models.friend import FriendRequest
from app.models.card import Card
from app.models.challenge import GameChallenge
from app.core.auth_deps import get_current_player_id

router = APIRouter(prefix="/social", tags=["Social"])


# ─── Stats ────────────────────────────────────────────────────────────────────

@router.get("/me/stats")
def get_my_stats(
    current_player_id: int = Depends(get_current_player_id),
    db: Session = Depends(get_db),
):
    player = db.query(Player).filter(Player.id == current_player_id).first()
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")

    games_played = player.games_played or 0
    games_won = player.games_won or 0
    games_lost = player.games_lost or 0
    win_rate = round((games_won / games_played * 100), 1) if games_played > 0 else 0.0

    counts: dict = player.card_play_counts or {}
    favorite_card = None
    least_used_card = None

    if counts:
        fav_id = max(counts, key=lambda k: counts[k])
        fav_card = db.query(Card).filter(Card.id == int(fav_id)).first()
        favorite_card = {
            "id": int(fav_id),
            "name": fav_card.name if fav_card else f"Card #{fav_id}",
            "type": fav_card.type if fav_card else "unknown",
            "count": counts[fav_id],
        }

        if len(counts) > 1:
            least_id = min(counts, key=lambda k: counts[k])
            least_card = db.query(Card).filter(Card.id == int(least_id)).first()
            least_used_card = {
                "id": int(least_id),
                "name": least_card.name if least_card else f"Card #{least_id}",
                "type": least_card.type if least_card else "unknown",
                "count": counts[least_id],
            }

    return {
        "user_id": player.id,
        "username": player.username,
        "games_played": games_played,
        "games_won": games_won,
        "games_lost": games_lost,
        "win_rate": win_rate,
        "rating": player.rating if player.rating is not None else 0,
        "favorite_card": favorite_card,
        "least_used_card": least_used_card,
        "card_play_counts": counts,
    }


# ─── Player search ────────────────────────────────────────────────────────────

@router.get("/players/search")
def search_players(
    q: str,
    current_player_id: int = Depends(get_current_player_id),
    db: Session = Depends(get_db),
):
    if len(q) < 2:
        raise HTTPException(status_code=400, detail="Search query must be at least 2 characters")

    players = (
        db.query(Player)
        .filter(Player.username.ilike(f"%{q}%"), Player.id != current_player_id)
        .limit(10)
        .all()
    )

    return [
        {
            "user_id": p.id,
            "username": p.username,
            "games_played": p.games_played or 0,
            "games_won": p.games_won or 0,
        }
        for p in players
    ]


# ─── Friend requests ──────────────────────────────────────────────────────────

@router.post("/friends/request/{receiver_id}")
def send_friend_request(
    receiver_id: int,
    current_player_id: int = Depends(get_current_player_id),
    db: Session = Depends(get_db),
):
    if receiver_id == current_player_id:
        raise HTTPException(status_code=400, detail="Cannot send friend request to yourself")

    receiver = db.query(Player).filter(Player.id == receiver_id).first()
    if not receiver:
        raise HTTPException(status_code=404, detail="Player not found")

    # Check for existing request in either direction
    existing = db.query(FriendRequest).filter(
        ((FriendRequest.sender_id == current_player_id) & (FriendRequest.receiver_id == receiver_id))
        | ((FriendRequest.sender_id == receiver_id) & (FriendRequest.receiver_id == current_player_id))
    ).first()

    if existing:
        if existing.status == "accepted":
            raise HTTPException(status_code=400, detail="Already friends")
        if existing.status == "pending":
            raise HTTPException(status_code=400, detail="Friend request already pending")
        # If rejected, allow re-sending by updating
        existing.sender_id = current_player_id
        existing.receiver_id = receiver_id
        existing.status = "pending"
        db.commit()
        db.refresh(existing)
        return {"message": "Friend request sent", "request_id": existing.id}

    req = FriendRequest(sender_id=current_player_id, receiver_id=receiver_id)
    db.add(req)
    db.commit()
    db.refresh(req)
    return {"message": "Friend request sent", "request_id": req.id}


@router.get("/friends/requests")
def get_friend_requests(
    current_player_id: int = Depends(get_current_player_id),
    db: Session = Depends(get_db),
):
    incoming = (
        db.query(FriendRequest)
        .filter(FriendRequest.receiver_id == current_player_id, FriendRequest.status == "pending")
        .all()
    )
    outgoing = (
        db.query(FriendRequest)
        .filter(FriendRequest.sender_id == current_player_id, FriendRequest.status == "pending")
        .all()
    )

    def _enrich(req: FriendRequest, other_id: int):
        other = db.query(Player).filter(Player.id == other_id).first()
        return {
            "request_id": req.id,
            "user_id": other_id,
            "username": other.username if other else f"User #{other_id}",
        }

    return {
        "incoming": [_enrich(r, r.sender_id) for r in incoming],
        "outgoing": [_enrich(r, r.receiver_id) for r in outgoing],
    }


@router.post("/friends/accept/{request_id}")
def accept_friend_request(
    request_id: int,
    current_player_id: int = Depends(get_current_player_id),
    db: Session = Depends(get_db),
):
    req = db.query(FriendRequest).filter(
        FriendRequest.id == request_id,
        FriendRequest.receiver_id == current_player_id,
        FriendRequest.status == "pending",
    ).first()

    if not req:
        raise HTTPException(status_code=404, detail="Friend request not found")

    req.status = "accepted"
    db.commit()
    return {"message": "Friend request accepted"}


@router.post("/friends/reject/{request_id}")
def reject_friend_request(
    request_id: int,
    current_player_id: int = Depends(get_current_player_id),
    db: Session = Depends(get_db),
):
    req = db.query(FriendRequest).filter(
        FriendRequest.id == request_id,
        FriendRequest.receiver_id == current_player_id,
        FriendRequest.status == "pending",
    ).first()

    if not req:
        raise HTTPException(status_code=404, detail="Friend request not found")

    req.status = "rejected"
    db.commit()
    return {"message": "Friend request rejected"}


# ─── Rank definitions (static) ───────────────────────────────────────────────

RANK_TIERS = [
    {"tier": 1,  "name": "SURVIVOR",        "min": 0,    "max": 299,  "color": "#808080"},
    {"tier": 2,  "name": "SCAVENGER",       "min": 300,  "max": 549,  "color": "#a08060"},
    {"tier": 3,  "name": "WANDERER",        "min": 550,  "max": 799,  "color": "#00e5ff"},
    {"tier": 4,  "name": "RAIDER",          "min": 800,  "max": 1049, "color": "#d4ff00"},
    {"tier": 5,  "name": "MARAUDER",        "min": 1050, "max": 1299, "color": "#ff6600"},
    {"tier": 6,  "name": "ENFORCER",        "min": 1300, "max": 1549, "color": "#ff0080"},
    {"tier": 7,  "name": "WARLORD",         "min": 1550, "max": 1799, "color": "#b700ff"},
    {"tier": 8,  "name": "OVERLORD",        "min": 1800, "max": 2099, "color": "#ff2200"},
    {"tier": 9,  "name": "DUNE MASTER",     "min": 2100, "max": 2399, "color": "#ffd700"},
    {"tier": 10, "name": "APOCALYPSE LORD", "min": 2400, "max": None, "color": "#ff0000"},
]


@router.get("/ranks")
def get_ranks():
    return RANK_TIERS


# ─── Leaderboard ─────────────────────────────────────────────────────────────

@router.get("/leaderboard")
def get_leaderboard(db: Session = Depends(get_db)):
    top = (
        db.query(Player)
        .order_by(Player.games_won.desc())
        .limit(5)
        .all()
    )
    return [
        {
            "rank": i + 1,
            "username": p.username,
            "games_won": p.games_won or 0,
            "games_played": p.games_played or 0,
            "rating": p.rating if p.rating is not None else 0,
        }
        for i, p in enumerate(top)
    ]


# ─── Friends ──────────────────────────────────────────────────────────────────

@router.get("/friends")
def get_friends(
    current_player_id: int = Depends(get_current_player_id),
    db: Session = Depends(get_db),
):
    accepted = db.query(FriendRequest).filter(
        ((FriendRequest.sender_id == current_player_id) | (FriendRequest.receiver_id == current_player_id)),
        FriendRequest.status == "accepted",
    ).all()

    friends = []
    for req in accepted:
        friend_id = req.receiver_id if req.sender_id == current_player_id else req.sender_id
        friend = db.query(Player).filter(Player.id == friend_id).first()
        if friend:
            friends.append({
                "user_id": friend.id,
                "username": friend.username,
                "games_played": friend.games_played or 0,
                "games_won": friend.games_won or 0,
            })

    return friends


# ─── Game Challenges ──────────────────────────────────────────────────────────

class ChallengeCreate(BaseModel):
    challenged_id: int
    scheduled_at: Optional[datetime] = None
    message: Optional[str] = None


@router.post("/challenges")
def send_challenge(
    body: ChallengeCreate,
    current_player_id: int = Depends(get_current_player_id),
    db: Session = Depends(get_db),
):
    if body.challenged_id == current_player_id:
        raise HTTPException(status_code=400, detail="Cannot challenge yourself")

    challenged = db.query(Player).filter(Player.id == body.challenged_id).first()
    if not challenged:
        raise HTTPException(status_code=404, detail="Player not found")

    # Must be friends
    friendship = db.query(FriendRequest).filter(
        (
            ((FriendRequest.sender_id == current_player_id) & (FriendRequest.receiver_id == body.challenged_id))
            | ((FriendRequest.sender_id == body.challenged_id) & (FriendRequest.receiver_id == current_player_id))
        ),
        FriendRequest.status == "accepted",
    ).first()
    if not friendship:
        raise HTTPException(status_code=403, detail="You can only challenge your allies")

    # Check no pending challenge already exists in either direction
    existing = db.query(GameChallenge).filter(
        (
            ((GameChallenge.challenger_id == current_player_id) & (GameChallenge.challenged_id == body.challenged_id))
            | ((GameChallenge.challenger_id == body.challenged_id) & (GameChallenge.challenged_id == current_player_id))
        ),
        GameChallenge.status == "pending",
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="A pending challenge already exists with this player")

    challenge = GameChallenge(
        challenger_id=current_player_id,
        challenged_id=body.challenged_id,
        scheduled_at=body.scheduled_at,
        message=body.message,
    )
    db.add(challenge)
    db.commit()
    db.refresh(challenge)
    return {"message": "Challenge sent", "challenge_id": challenge.id}


@router.get("/challenges")
def get_challenges(
    current_player_id: int = Depends(get_current_player_id),
    db: Session = Depends(get_db),
):
    incoming_rows = db.query(GameChallenge).filter(
        GameChallenge.challenged_id == current_player_id,
        GameChallenge.status == "pending",
    ).all()
    outgoing_rows = db.query(GameChallenge).filter(
        GameChallenge.challenger_id == current_player_id,
        GameChallenge.status == "pending",
    ).all()

    def _enrich(c: GameChallenge, other_id: int):
        other = db.query(Player).filter(Player.id == other_id).first()
        return {
            "challenge_id": c.id,
            "user_id": other_id,
            "username": other.username if other else f"Player #{other_id}",
            "scheduled_at": c.scheduled_at.isoformat() if c.scheduled_at else None,
            "message": c.message,
            "created_at": c.created_at.isoformat() if c.created_at else None,
        }

    return {
        "incoming": [_enrich(c, c.challenger_id) for c in incoming_rows],
        "outgoing": [_enrich(c, c.challenged_id) for c in outgoing_rows],
    }


@router.post("/challenges/{challenge_id}/accept")
def accept_challenge(
    challenge_id: int,
    current_player_id: int = Depends(get_current_player_id),
    db: Session = Depends(get_db),
):
    challenge = db.query(GameChallenge).filter(
        GameChallenge.id == challenge_id,
        GameChallenge.challenged_id == current_player_id,
        GameChallenge.status == "pending",
    ).first()
    if not challenge:
        raise HTTPException(status_code=404, detail="Challenge not found")
    challenge.status = "accepted"
    db.commit()
    return {"message": "Challenge accepted"}


@router.post("/challenges/{challenge_id}/decline")
def decline_challenge(
    challenge_id: int,
    current_player_id: int = Depends(get_current_player_id),
    db: Session = Depends(get_db),
):
    challenge = db.query(GameChallenge).filter(
        GameChallenge.id == challenge_id,
        GameChallenge.challenged_id == current_player_id,
        GameChallenge.status == "pending",
    ).first()
    if not challenge:
        raise HTTPException(status_code=404, detail="Challenge not found")
    challenge.status = "declined"
    db.commit()
    return {"message": "Challenge declined"}


@router.delete("/challenges/{challenge_id}")
def cancel_challenge(
    challenge_id: int,
    current_player_id: int = Depends(get_current_player_id),
    db: Session = Depends(get_db),
):
    challenge = db.query(GameChallenge).filter(
        GameChallenge.id == challenge_id,
        GameChallenge.challenger_id == current_player_id,
        GameChallenge.status == "pending",
    ).first()
    if not challenge:
        raise HTTPException(status_code=404, detail="Challenge not found or not yours")
    challenge.status = "cancelled"
    db.commit()
    return {"message": "Challenge cancelled"}
