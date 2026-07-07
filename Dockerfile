# ─── Stage 1: Build Vite app ─────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Supabase public keys are safe to bake into the build
RUN printf "VITE_SUPABASE_URL=https://sjpvyxdyleebhqlmqscy.supabase.co\nVITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNqcHZ5eGR5bGVlYmhxbG1xc2N5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxNzgxODksImV4cCI6MjA4ODc1NDE4OX0.ZvzbBm-L8Jt3FzhmmX3qd7_inwrupjQrfh9JWIlX1ng\n" > .env

RUN npm run build

# ─── Stage 2: Production runtime ─────────────────────────────────────────────
# Use Debian slim — grpcio (required by google-ads) needs glibc and build tools
# that are unreliable on Alpine musl.
FROM node:20-slim
WORKDIR /app

# Python 3 + build tools for grpcio native compilation
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-pip python3-venv \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Node production dependencies
COPY package*.json ./
RUN npm install --omit=dev

# Python dependencies in an isolated venv (avoids system-packages conflicts)
COPY requirements.txt ./
RUN python3 -m venv /app/venv && \
    /app/venv/bin/pip install --no-cache-dir -r requirements.txt

# Make venv python available as python3 for server.js child_process calls
ENV PATH="/app/venv/bin:$PATH"

# App files
COPY --from=builder /app/dist ./dist
COPY server.js ./
COPY server/ ./server/
COPY tools/ ./tools/

# credentials.json and token.json are bind-mounted at runtime (see docker-compose.yml)

EXPOSE 3000

CMD ["node", "server.js"]
