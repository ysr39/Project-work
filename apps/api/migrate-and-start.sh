#!/bin/sh
set -e

echo "[startup] Running TypeORM migrations…"
node dist/database/data-source.js || true
npx typeorm migration:run -d dist/database/data-source.js

echo "[startup] Starting TaxiPool API…"
exec node dist/main
