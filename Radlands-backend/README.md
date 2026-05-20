# Radlands Backend

FastAPI backend for the Radlands card game, featuring turn-based game logic, JWT authentication, and Google OAuth.

## Tech Stack

- **FastAPI** — REST API framework
- **PostgreSQL** — database
- **SQLAlchemy** — ORM
- **Alembic** — database migrations
- **JWT** (python-jose) — stateless auth tokens
- **Google OAuth** (google-auth) — sign in with Google
- **Passlib + bcrypt** — password hashing

## Project Structure

```
app/
├── core/
│   ├── auth_deps.py        # JWT bearer dependency
│   ├── deck.py             # Deck building logic
│   ├── effect_engine.py    # Card effect execution
│   ├── enums.py            # Shared enums
│   ├── game_initializer.py # Game setup and turn helpers
│   └── security.py         # JWT encode/decode, password hashing
├── db/
│   ├── database.py         # SQLAlchemy engine and Base
│   └── dependencies.py     # DB session dependency
├── models/
│   ├── card.py             # Card model
│   ├── game.py             # Game model
│   ├── game_state.py       # GameState (JSON blob) model
│   └── player.py           # Player model
├── routes/
│   ├── auth_routes.py      # /auth endpoints
│   └── game_routes.py      # /games endpoints
├── schemas/
│   ├── auth.py             # Auth request/response schemas
│   └── game.py             # Game request schemas
└── main.py                 # App entrypoint, CORS, router registration
alembic/                    # Migration scripts
seeds/                      # Seed scripts for card data
```

## Setup

### 1. Install PostgreSQL

**Homebrew:**
```bash
brew install postgresql@16
brew services start postgresql@16
```

**Or Docker:**
```bash
docker run -d --name radlands-pg \
  -e POSTGRES_USER=radlands_user \
  -e POSTGRES_PASSWORD=yourpassword \
  -e POSTGRES_DB=radlands \
  -p 5432:5432 postgres:16
```

### 2. Create the database (Homebrew only)

```bash
psql postgres -c "CREATE USER radlands_user WITH PASSWORD 'yourpassword';"
psql postgres -c "CREATE DATABASE radlands OWNER radlands_user;"
```

### 3. Configure environment

```bash
cp .env.example .env
```

Fill in `.env`:

| Variable | Description |
|---|---|
| `DATABASE_URL` | `postgresql://USER:PASSWORD@localhost:5432/DB_NAME` |
| `JWT_SECRET` | Random secret — generate with `python3 -c "import secrets; print(secrets.token_hex(32))"` |
| `GOOGLE_CLIENT_ID` | From Google Cloud Console → APIs & Services → Credentials |
| `ALLOWED_ORIGINS` | Frontend URL(s), comma-separated (e.g. `http://localhost:3000`) |
| `SQL_ECHO` | `true` to log SQL queries, `false` otherwise |

### 4. Install dependencies

```bash
pip install -r requirements.txt
```

### 5. Run migrations

```bash
alembic upgrade head
```

### 6. Seed card data (optional)

```bash
python seeds/seed_cards.py
```

### 7. Start the server

```bash
uvicorn app.main:app --reload
```

API is available at `http://localhost:8000`. Interactive docs at `http://localhost:8000/docs`.

## API Endpoints

### Auth

| Method | Path | Description |
|---|---|---|
| `POST` | `/auth/register` | Register with username, email, password |
| `POST` | `/auth/login` | Login with username and password |
| `POST` | `/auth/google` | Login or register via Google ID token |
| `POST` | `/auth/delete` | Delete account (password-based accounts only) |

### Games

All game endpoints require a `Bearer <token>` header.

| Method | Path | Description |
|---|---|---|
| `POST` | `/games/create` | Create a new game against an opponent |
| `GET` | `/games/` | List all your games |
| `GET` | `/games/{game_id}` | Get full game state |
| `POST` | `/games/end-turn/{game_id}` | End your turn |
| `POST` | `/games/play-person/{game_id}` | Play a person card from hand |
| `POST` | `/games/activate-ability/{game_id}` | Activate a person's ability |
| `POST` | `/games/activate-camp/{game_id}` | Activate a camp ability |
| `POST` | `/games/junk-card/{game_id}` | Junk a card to trigger its junk effect |
| `POST` | `/games/play-event/{game_id}` | Play an event card into the queue |

## Google OAuth Flow

1. Frontend uses [Google Identity Services](https://developers.google.com/identity/gsi/web) to sign the user in and get an ID token
2. Frontend sends `POST /auth/google` with `{ "id_token": "<google_id_token>" }`
3. Backend verifies the token against Google's public keys
4. If the email matches an existing account, it links the Google ID to it
5. If new, a player account is auto-created
6. Backend returns a JWT — same as regular login

## Environment Variables Reference

See `.env.example` for a full template.
