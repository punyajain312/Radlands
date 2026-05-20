# Radlands

A digital implementation of the Radlands card game, featuring a turn-based game engine, REST API, JWT authentication, and Google OAuth.

## Repository Structure

```
Radlands/
├── Radlands-backend/   # FastAPI backend (Python)
├── Events.pdf          # Reference: event card definitions
└── People.pdf          # Reference: people card definitions
```

## Backend

The backend is a FastAPI application with PostgreSQL, handling all game logic, auth, and state management.

### Tech Stack

- **FastAPI** — REST API
- **PostgreSQL** — database
- **SQLAlchemy + Alembic** — ORM and migrations
- **JWT** — stateless auth tokens
- **Google OAuth** — sign in with Google
- **bcrypt** — password hashing

### Quick Start

```bash
cd Radlands-backend

# 1. Copy and fill in environment variables
cp .env.example .env

# 2. Install dependencies
pip install -r requirements.txt

# 3. Run database migrations
alembic upgrade head

# 4. Start the server
uvicorn app.main:app --reload
```

API runs at `http://localhost:8000` — interactive docs at `http://localhost:8000/docs`.

See [`Radlands-backend/README.md`](Radlands-backend/README.md) for full setup instructions, environment variable reference, and API documentation.

### API Overview

| Group | Endpoints |
|---|---|
| Auth | `POST /auth/register`, `/auth/login`, `/auth/google`, `/auth/delete` |
| Games | `POST /games/create`, `GET /games/`, `GET /games/{id}` |
| Turns | `POST /games/end-turn/{id}` |
| Actions | `play-person`, `activate-ability`, `activate-camp`, `junk-card`, `play-event` |

### Environment Variables

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Random secret for signing tokens |
| `GOOGLE_CLIENT_ID` | From Google Cloud Console |
| `ALLOWED_ORIGINS` | Comma-separated list of allowed frontend URLs |
| `SQL_ECHO` | Set to `true` to log SQL queries |
