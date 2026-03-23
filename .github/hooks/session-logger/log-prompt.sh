#!/bin/bash

# Log userPromptSubmitted event

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

# Capture prompt text from first argument (passed by hook caller)
PROMPT="${1:-}"

# Extract timestamp and branch
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")

# Log prompt event as JSON
jq -Rn \
  --arg event "userPromptSubmitted" \
  --arg prompt "$PROMPT" \
  --arg timestamp "$TIMESTAMP" \
  --arg branch "$BRANCH" \
  '{"event":$event,"prompt":$prompt,"timestamp":$timestamp,"branch":$branch}' \
  >> logs/copilot/session.log

exit 0