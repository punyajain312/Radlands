# Radlands — Production Deployment & WebSocket Deep-Dive

This document covers how to take Radlands from a local dev setup to a production multiplayer game. It also explains the WebSocket protocol from first principles so you understand every line of the live-game code.

---

## Part 1 — WebSockets: From Zero to Radlands

### 1.1 Why Not Just HTTP?

Normal HTTP is **request → response**: the browser asks, the server answers, connection closes. For a card game this creates a problem — how does Player 2 know when Player 1 just played a card?

Options before WebSockets:
| Technique | How | Problem |
|-----------|-----|---------|
| **Short polling** | Client asks every 1s: "anything new?" | Wastes bandwidth, adds latency |
| **Long polling** | Client asks, server holds connection until there is news | Tricky to scale, half-duplex |
| **Server-Sent Events** | Server can push, client cannot reply | One-direction only |
| **WebSocket** | Persistent full-duplex channel | ✅ Perfect for games |

### 1.2 The WebSocket Handshake

WebSockets start as a regular HTTP request then *upgrade*:

```
Browser → Server:
  GET /ws/games/42?token=eyJ... HTTP/1.1
  Host: radlands.example.com
  Upgrade: websocket
  Connection: Upgrade
  Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==
  Sec-WebSocket-Version: 13

Server → Browser:
  HTTP/1.1 101 Switching Protocols
  Upgrade: websocket
  Connection: Upgrade
  Sec-WebSocket-Accept: s3pPLMBiTxaQ9kYGzzhZRbK+xOo=
```

After `101 Switching Protocols`, the TCP connection stays open and both sides can send **frames** at any time — no more request/response cycle. The connection lives until one side closes it or the network drops.

### 1.3 WebSocket Frames

Data travels in **frames**. Each frame has:
- **opcode**: text (0x1), binary (0x2), ping (0x9), pong (0xA), close (0x8)
- **payload length**: variable-length encoding
- **masking key**: clients must mask frames; servers don't
- **payload**: your data

For Radlands we only use text frames (JSON strings). You never see frames directly — FastAPI/Starlette handles framing, you just call `await ws.send_json({...})`.

### 1.4 How Radlands Uses WebSockets

Radlands uses a **server-push only** pattern. The client never sends game actions over WebSocket — it sends them via normal REST POST requests. The WebSocket is purely a notification channel.

```
                 ┌──────────────────────────┐
                 │         Backend           │
   Player 1      │                          │      Player 2
   ─────────     │   REST  ──►  game_routes │      ─────────
   POST /games/  │   action    ──► update   │
   play-person   │             ──► _broadcast│
                 │                    │     │
                 │                    ▼     │
                 │            connection_   │
                 │            manager       │
                 │            .broadcast()  │
                 │                ╱    ╲    │
                 │         ws.send  ws.send │
                 └──────────────────────────┘
                       │                │
                   WebSocket        WebSocket
                   push to P1       push to P2
```

**ws_routes.py** — `GET /ws/games/{game_id}?token=xxx`
- Validates the JWT from the query string
- Checks that the player is actually in this game
- Calls `manager.connect()` — registers the WebSocket
- Sends the current game state as the first message
- Enters a `while True` loop listening for incoming messages (which it ignores — the client only sends pings to keep the connection alive)

**connection_manager.py** — in-memory registry
- `active: dict[game_id → dict[player_id → WebSocket]]`
- `connect()` — stores the WebSocket reference
- `disconnect()` — removes it on error or close
- `broadcast()` — loops over all players in a game and pushes the updated state

When a REST endpoint (play-person, end-turn, etc.) modifies game state, it calls `await _broadcast(game, state)` which calls `manager.broadcast(game.id, {...})` which pushes to every connected player simultaneously. Both players see the move instantly.

### 1.5 Token in Query String

The WebSocket token is passed as `?token=xxx` because the **WebSocket API in browsers cannot set custom headers**. This is a well-known limitation. The token appears in server access logs, so:

- Use short-lived tokens in production (1h, not 7d)
- Ensure HTTPS so the query string is encrypted in transit
- Alternatively, authenticate via first message after connect (more complex)

---

## Part 2 — Production Architecture

### 2.1 What You Need

```
Internet
    │
    ▼
[nginx]  ← terminates TLS, serves static frontend, proxies to backend
    │
    ├─► /api/*  →  [uvicorn + FastAPI]  ←→  [PostgreSQL]
    │
    └─► /ws/*   →  [uvicorn + FastAPI]  (WebSocket upgrade)
```

For a small game (< 1000 concurrent players) a single server running:
- nginx (reverse proxy + static files)
- uvicorn with 2–4 workers
- PostgreSQL 15+

is sufficient.

### 2.2 The WebSocket Scaling Problem

**Critical**: When uvicorn runs with `--workers 4`, each worker is a separate process with its own `ConnectionManager`. Player 1 might be connected to worker A, Player 2 to worker B. When Player 1's REST action calls `manager.broadcast()`, it only pushes to Player 2 if Player 2 is on the **same worker**.

**Solutions:**

#### Option A — Sticky Sessions (Simple)
nginx routes all connections from the same IP to the same worker. Most players in a game share a local network, so this often works. Fragile — breaks if the worker restarts.

```nginx
upstream radlands_backend {
    ip_hash;  # same IP → same worker
    server 127.0.0.1:8001;
    server 127.0.0.1:8002;
    server 127.0.0.1:8003;
    server 127.0.0.1:8004;
}
```

#### Option B — Redis Pub/Sub (Production-Grade)
Replace the in-memory `ConnectionManager` with a Redis-backed broadcaster. Any worker can publish a game update to Redis; all workers subscribed to that game's channel push to their local WebSocket connections.

```python
# Pseudocode — replace connection_manager.py for multi-worker
import redis.asyncio as aioredis

class RedisConnectionManager:
    def __init__(self, redis_url: str):
        self.redis = aioredis.from_url(redis_url)
        self.local: dict[int, dict[int, WebSocket]] = {}

    async def connect(self, game_id, player_id, ws):
        await ws.accept()
        self.local.setdefault(game_id, {})[player_id] = ws
        # Subscribe to this game's Redis channel
        pubsub = self.redis.pubsub()
        await pubsub.subscribe(f"game:{game_id}")
        asyncio.create_task(self._listen(game_id, pubsub))

    async def broadcast(self, game_id, data):
        # Publish to Redis → all workers receive it
        await self.redis.publish(f"game:{game_id}", json.dumps(data))

    async def _listen(self, game_id, pubsub):
        async for msg in pubsub.listen():
            if msg["type"] == "message":
                data = json.loads(msg["data"])
                for ws in self.local.get(game_id, {}).values():
                    await ws.send_json(data)
```

For early production, use **Option A** to start. Switch to **Option B** when you add the second server.

---

## Part 3 — Step-by-Step Deployment

### 3.1 Server Requirements

- Ubuntu 22.04 LTS (or Debian 12)
- 2 vCPU, 2 GB RAM minimum
- 20 GB SSD

### 3.2 Install System Packages

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y python3.11 python3.11-venv python3-pip \
  postgresql postgresql-contrib nginx certbot python3-certbot-nginx
```

### 3.3 PostgreSQL Setup

```bash
sudo -u postgres psql
```
```sql
CREATE USER radlands WITH PASSWORD 'STRONG_RANDOM_PASSWORD_HERE';
CREATE DATABASE radlands OWNER radlands;
GRANT ALL PRIVILEGES ON DATABASE radlands TO radlands;
\q
```

### 3.4 Backend Setup

```bash
git clone https://github.com/punyajain312/Radlands.git /opt/radlands
cd /opt/radlands/Radlands-backend

python3.11 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

**Create `/opt/radlands/Radlands-backend/.env`:**
```env
DATABASE_URL=postgresql://radlands:STRONG_PASSWORD@localhost/radlands
JWT_SECRET=<generate with: python3 -c "import secrets; print(secrets.token_hex(64))">
ALLOWED_ORIGINS=https://yourdomain.com
GOOGLE_CLIENT_ID=<your-google-client-id>
ENV=production
```

**Run migrations:**
```bash
cd /opt/radlands/Radlands-backend
source .venv/bin/activate
alembic upgrade head
```

**Seed card data (first time only):**
```bash
python seeds/seed_cards.py
```

### 3.5 Systemd Service for uvicorn

Create `/etc/systemd/system/radlands.service`:
```ini
[Unit]
Description=Radlands Game Backend
After=network.target postgresql.service

[Service]
User=www-data
WorkingDirectory=/opt/radlands/Radlands-backend
EnvironmentFile=/opt/radlands/Radlands-backend/.env
ExecStart=/opt/radlands/Radlands-backend/.venv/bin/uvicorn app.main:app \
    --host 127.0.0.1 \
    --port 8000 \
    --workers 2 \
    --loop uvloop \
    --http httptools
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable radlands
sudo systemctl start radlands
sudo systemctl status radlands
```

### 3.6 Frontend Build

```bash
cd /opt/radlands/Radlands-frontend
npm ci
npm run build
```

This produces `/opt/radlands/Radlands-frontend/dist/` — a static folder nginx will serve.

### 3.7 nginx Configuration

Create `/etc/nginx/sites-available/radlands`:
```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    # TLS (certbot fills these in)
    ssl_certificate     /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         HIGH:!aNULL:!MD5;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self'; connect-src 'self' wss://yourdomain.com" always;

    # Serve frontend static files
    root /opt/radlands/Radlands-frontend/dist;
    index index.html;

    # SPA fallback (React handles routing)
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Proxy REST API
    location /auth/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /games/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /social/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # WebSocket proxy (CRITICAL — must set Upgrade headers)
    location /ws/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 86400s;   # keep alive 24h
        proxy_send_timeout 86400s;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/radlands /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 3.8 SSL Certificate (Let's Encrypt)

```bash
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
# Auto-renew is set up by certbot — verify with:
sudo certbot renew --dry-run
```

---

## Part 4 — Security Hardening Checklist

### Already Implemented
- [x] JWT authentication with secret from environment variable
- [x] bcrypt password hashing
- [x] Rate limiting on `/auth/login` and `/auth/register` (10 req/min/IP)
- [x] CORS restricted to allowed origins via `ALLOWED_ORIGINS` env var
- [x] Security headers: `X-Content-Type-Options`, `X-Frame-Options`, `X-XSS-Protection`, `Referrer-Policy`
- [x] WebSocket authentication via JWT validation before `accept()`
- [x] Player authorization check: you can only join games you're in
- [x] `create_all` disabled in production (`ENV=production`)
- [x] Input validation via Pydantic on all request bodies
- [x] Password strength: 8+ chars, uppercase, digit required

### Still To Do Before Launch

| Item | Why | How |
|------|-----|-----|
| **Shorter JWT expiry** | 7 days is too long if a token leaks | Change `ACCESS_TOKEN_EXPIRE_DAYS = 1` in `security.py` |
| **HTTPS everywhere** | Query string tokens readable in plaintext | Set up TLS via certbot (see §3.8) |
| **Content-Security-Policy** | Prevents XSS escalation | Add in nginx config (see §3.7) |
| **HSTS** | Forces HTTPS on all future visits | `Strict-Transport-Security` header in nginx |
| **Rate limit on WebSocket** | Prevent connection flood | Add connection count check in `ws_routes.py` |
| **Redis-backed broadcast** | Multi-worker correctness | See §2.2 Option B |
| **Database connection pooling** | SQLAlchemy default pool is small | Set `pool_size=10, max_overflow=20` in `database.py` |
| **Structured logging** | Track cheating/abuse | Replace `print` with Python `logging` module |
| **Input length caps** | Prevent oversized payloads | Add `max_length` to Pydantic string fields |
| **Token revocation** | Can't log out a stolen JWT | Add a Redis blocklist checked in `decode_token()` |

### WebSocket-Specific Security

1. **Never trust client messages** — Radlands ignores all client WebSocket messages (correct). Game state changes only come via authenticated REST endpoints.

2. **Close on auth failure before accepting** — Radlands does this: `decode_token` runs, if it fails we call `websocket.close(code=4001)` **before** `manager.connect()`. This is correct. Calling `accept()` first would expose the connection.

3. **Heartbeat / ping-pong** — Long-idle WebSocket connections get dropped by load balancers. Add a periodic ping from the server:
   ```python
   # In ws_routes.py, inside the while True loop:
   try:
       data = await asyncio.wait_for(websocket.receive_text(), timeout=30)
   except asyncio.TimeoutError:
       await websocket.send_json({"type": "ping"})
   except WebSocketDisconnect:
       manager.disconnect(game_id, player_id)
       break
   ```

---

## Part 5 — Monitoring & Operations

### Logs

```bash
sudo journalctl -u radlands -f          # backend logs
sudo tail -f /var/log/nginx/access.log  # nginx access
sudo tail -f /var/log/nginx/error.log   # nginx errors
```

### Deploy a New Version

```bash
cd /opt/radlands
git pull origin master
cd Radlands-backend && source .venv/bin/activate
pip install -r requirements.txt      # if deps changed
alembic upgrade head                 # if schema changed
sudo systemctl restart radlands

cd ../Radlands-frontend
npm ci && npm run build
# nginx picks up the new dist/ immediately — no restart needed
```

### Database Backup

```bash
# Daily backup via cron
pg_dump -U radlands radlands | gzip > /backups/radlands-$(date +%Y%m%d).sql.gz
```

Add this to `/etc/cron.d/radlands`:
```
0 3 * * * postgres pg_dump radlands | gzip > /backups/radlands-$(date +\%Y\%m\%d).sql.gz
```

---

## Part 6 — WebSocket Client Code Reference

How the frontend should connect once the game UI is built:

```typescript
// Connect to a game's WebSocket
function connectToGame(gameId: number, token: string) {
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
  const host = window.location.host;
  const ws = new WebSocket(`${protocol}://${host}/ws/games/${gameId}?token=${token}`);

  ws.onopen = () => {
    console.log('Connected to game', gameId);
  };

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.type === 'game_state') {
      // Update your React state with msg.state
      setGameState(msg);
    } else if (msg.type === 'ping') {
      // Server keepalive — ignore
    }
  };

  ws.onclose = (event) => {
    console.log('WebSocket closed', event.code, event.reason);
    if (event.code === 4001) alert('Authentication failed');
    if (event.code === 4003) alert('You are not in this game');
    // Reconnect after 3s for normal closes
    if (event.code === 1006) setTimeout(() => connectToGame(gameId, token), 3000);
  };

  ws.onerror = (err) => {
    console.error('WebSocket error', err);
  };

  return ws;
}
```

WebSocket close codes used in Radlands:
| Code | Meaning |
|------|---------|
| `4001` | JWT invalid or expired — re-login required |
| `4003` | Player not in this game — forbidden |
| `1000` | Normal close (game over) |
| `1006` | Abnormal close / network drop — reconnect |
