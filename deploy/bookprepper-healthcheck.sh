#!/bin/bash
# Health check for BookPrepper API — restarts the service after 3 consecutive failures.
# Intended to be run by bookprepper-healthcheck.timer every 60s.

FAIL_FILE="/tmp/bookprepper-healthcheck-failures"
MAX_FAILURES=3

if curl -sf --max-time 5 http://127.0.0.1:4000/healthz > /dev/null 2>&1; then
  rm -f "$FAIL_FILE"
  exit 0
fi

count=$(cat "$FAIL_FILE" 2>/dev/null || echo 0)
count=$((count + 1))
echo "$count" > "$FAIL_FILE"

if [ "$count" -ge "$MAX_FAILURES" ]; then
  logger -t bookprepper-healthcheck "Restarting bookprepper after $count consecutive failures"
  systemctl restart bookprepper.service
  rm -f "$FAIL_FILE"
fi
