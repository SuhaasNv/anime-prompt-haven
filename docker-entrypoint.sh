#!/bin/sh
set -e

echo "Running database migrations..."
node scripts/migrate.mjs

echo "Starting PromptStar..."
exec node .output/server/index.mjs
