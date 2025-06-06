#!/bin/bash

echo "🧪 Starting PostgreSQL test DB..."
docker compose -f docker-compose.test.yml up -d

echo "⌛ Waiting for DB to be ready..."
sleep 5  # or use pg_isready

echo "🚀 Running Adonis tests..."
NODE_ENV=test node ace test

echo "🧹 Tearing down DB container..."
docker compose -f docker-compose.test.yml down -v
