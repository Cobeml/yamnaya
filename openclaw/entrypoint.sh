#!/bin/sh
set -eu
node /opt/yamnaya/init.mjs
node /app/dist/index.js gateway --allow-unconfigured --bind lan --port 18789 &
gateway_pid=$!
node /opt/yamnaya/driver.mjs &
driver_pid=$!
trap 'kill "$gateway_pid" "$driver_pid" 2>/dev/null || true' INT TERM EXIT
wait "$gateway_pid"
