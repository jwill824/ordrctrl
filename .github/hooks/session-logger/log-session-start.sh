#!/bin/bash

# Log session start event

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

# Extract timestamp and session info
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
CWD=$(pwd)

# Speckit branch detection — check if we're on a NNN-* feature branch
BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
SPECKIT_CONTEXT=null

if [[ "$BRANCH" =~ ^[0-9]{3,}- ]]; then
  SPEC_FILE="specs/$BRANCH/spec.md"
  if [[ -f "$SPEC_FILE" ]]; then
    # Extract Status line from spec.md
    SPEC_STATUS=$(grep -E '^\*\*Status\*\*:' "$SPEC_FILE" 2>/dev/null | sed 's/\*\*Status\*\*:[[:space:]]*//' | tr -d '\r' | head -1 || echo "unknown")
    SPEC_NAME=$(grep -E '^# ' "$SPEC_FILE" 2>/dev/null | sed 's/^# //' | head -1 || echo "unknown")
    SPECKIT_CONTEXT=$(jq -Rn \
      --arg spec "$SPEC_NAME" \
      --arg status "$SPEC_STATUS" \
      --arg last_phase "$(echo "$SPEC_STATUS" | tr '[:upper:]' '[:lower:]')" \
      '{"spec":$spec,"status":$status,"last_phase":$last_phase}')
  fi
fi

# Log session start (use jq for proper JSON encoding)
jq -Rn \
  --arg timestamp "$TIMESTAMP" \
  --arg cwd "$CWD" \
  --arg branch "$BRANCH" \
  --argjson speckit_context "$SPECKIT_CONTEXT" \
  '{"timestamp":$timestamp,"event":"sessionStart","cwd":$cwd,"branch":$branch,"speckit_context":$speckit_context}' \
  >> logs/copilot/session.log

echo "📝 Session logged"
exit 0