# Stage 1: Build Vite app
FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

ARG VITE_SUPABASE_URL=https://sjpvyxdyleebhqlmqscy.supabase.co
ARG VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNqcHZ5eGR5bGVlYmhxbG1xc2N5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxNzgxODksImV4cCI6MjA4ODc1NDE4OX0.ZvzbBm-L8Jt3FzhmmX3qd7_inwrupjQrfh9JWIlX1ng

ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY

# Write .env so Vite picks up VITE_* vars even if build-arg injection varies by platform
RUN printf "VITE_SUPABASE_URL=%s\nVITE_SUPABASE_ANON_KEY=%s\n" \
    "$VITE_SUPABASE_URL" "$VITE_SUPABASE_ANON_KEY" > .env

RUN npm run build

# Stage 2: Run Express server
FROM node:20-alpine
WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY --from=builder /app/dist ./dist
COPY server.js ./

EXPOSE 3000
CMD ["node", "server.js"]
