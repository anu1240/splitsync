#!/bin/bash
# ─────────────────────────────────────────────────────────
# SplitSync Quick Start Script
# Run this once to get the app running locally
# ─────────────────────────────────────────────────────────

set -e

echo ""
echo "⚡ SplitSync — Quick Start"
echo "──────────────────────────"

# Check Docker
if ! command -v docker &> /dev/null; then
  echo "❌ Docker not found. Install Docker first: https://docs.docker.com/get-docker/"
  exit 1
fi

if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null 2>&1; then
  echo "❌ Docker Compose not found."
  exit 1
fi

echo "✅ Docker found"

# Build and start
echo ""
echo "🔨 Building containers (first time takes ~2 min)..."
docker-compose up --build -d

# Wait for health
echo ""
echo "⏳ Waiting for services to start..."
sleep 10

# Health check
for i in {1..12}; do
  if curl -s http://localhost:5000/health > /dev/null 2>&1; then
    echo "✅ Backend is up!"
    break
  fi
  echo "   Waiting... ($i/12)"
  sleep 5
done

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║  ✅ SplitSync is running!                ║"
echo "║                                          ║"
echo "║  🌐 App:     http://localhost            ║"
echo "║  🔌 API:     http://localhost:5000       ║"
echo "║  💚 Health:  http://localhost:5000/health║"
echo "╚══════════════════════════════════════════╝"
echo ""
echo "To stop:  docker-compose down"
echo "Logs:     docker-compose logs -f"
echo ""
