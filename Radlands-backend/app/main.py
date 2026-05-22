import os
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from app.db.database import engine, Base
from app.models import challenge as _challenge_model  # noqa: F401 — registers GameChallenge with Base
from app.routes import auth_routes
from app.routes.game_routes import router as game_router
from app.routes.ws_routes import ws_router
from app.routes.social_routes import router as social_router

app = FastAPI(title="Radlands API")

# ── CORS ──────────────────────────────────────────────────────────────────────
_raw_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000,http://localhost:5173")
_origins = [o.strip() for o in _raw_origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Security headers ──────────────────────────────────────────────────────────
@app.middleware("http")
async def security_headers(request: Request, call_next) -> Response:
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "geolocation=(), camera=(), microphone=()"
    return response

# ── DB (dev convenience — migrations handle prod) ─────────────────────────────
if os.getenv("ENV", "development") != "production":
    Base.metadata.create_all(bind=engine)

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(game_router)
app.include_router(auth_routes.router)
app.include_router(ws_router)
app.include_router(social_router)


@app.get("/")
def root():
    return {"message": "Radlands Backend Running"}
