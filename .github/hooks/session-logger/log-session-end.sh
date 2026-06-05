#!/bin/bash

# Log session end event

set -euo pipefail

# .gitignore guard — session logging requires logs/ to be ignored
if ! grep -q '^logs/' .gitignore 2>/dev/null; then
  echo "⚠️  speckit-setup: add 'logs/' to .gitignore before session logging is active"
  exit 0
fi
mkdir -p logs/copilot

# Skip if logging disabled
if [[ "${SKIP_LOGGING:-}" == "true" ]]; then
  exit 0
fi

# Read input from Copilot
INPUT=$(cat)

# Extract timestamp and branch
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")

# Build base log entry
LOG_ENTRY=$(jq -Rn \
  --arg timestamp "$TIMESTAMP" \
  --arg event "sessionEnd" \
  --arg branch "$BRANCH" \
  '{"timestamp":$timestamp,"event":$event,"branch":$branch}')

# Speckit branch detection — check for uncommitted spec artifacts
if [[ "$BRANCH" =~ ^[0-9]{3,}- ]]; then
  UNCOMMITTED=$(git status --short "specs/$BRANCH/" 2>/dev/null | grep -v '^$' || true)
  if [[ -n "$UNCOMMITTED" ]]; then
    WARNING="⚠️  uncommitted spec artifacts detected in specs/$BRANCH/ — consider running phase-end commit"
    LOG_ENTRY=$(echo "$LOG_ENTRY" | jq --arg w "$WARNING" '. + {"warning":$w}')
    echo "$WARNING"
  fi
fi

echo "$LOG_ENTRY" >> logs/copilot/session.log

echo "📝 Session end logged"
exit 0