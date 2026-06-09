#!/bin/sh
set -e

echo "Running database migrations..."
node scripts/migrate.mjs

echo "Starting PromptStar..."
exec node dist/server/server.js
