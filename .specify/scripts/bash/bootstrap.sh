#!/bin/bash
# bootstrap.sh — Initialize speckit workflow structure in a target repository
#
# Usage: bash .specify/scripts/bash/bootstrap.sh [TARGET_DIR]
#   TARGET_DIR: optional path to target repo (defaults to current directory)
#
# This script creates the full speckit directory structure, copies generic
# speckit files, adds logs/ to .gitignore, and prints next-steps instructions.

set -euo pipefail

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SOURCE_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
TARGET_DIR="${1:-$(pwd)}"

# Directories to create
DIRS=(
  ".github/agents"
  ".github/skills/conventional-commit"
  ".github/skills/context-map"
  ".github/skills/github-issues"
  ".github/hooks/session-logger"
  ".specify/memory"
  ".specify/templates"
  ".specify/scripts/bash"
  "specs"
)

# Generic files to copy (source → destination relative to repo root)
GENERIC_FILES=(
  ".github/agents/speckit.specify.agent.md"
  ".github/agents/speckit.clarify.agent.md"
  ".github/agents/speckit.plan.agent.md"
  ".github/agents/speckit.tasks.agent.md"
  ".github/agents/speckit.checklist.agent.md"
  ".github/agents/speckit.analyze.agent.md"
  ".github/agents/speckit.implement.agent.md"
  ".github/agents/speckit.constitution.agent.md"
  ".github/agents/speckit.taskstoissues.agent.md"
  ".github/agents/issue-triage.agent.md"
  ".github/hooks/session-logger/log-session-start.sh"
  ".github/hooks/session-logger/log-session-end.sh"
  ".github/hooks/session-logger/log-prompt.sh"
  ".specify/templates/spec-template.md"
  ".specify/templates/plan-template.md"
  ".specify/templates/tasks-template.md"
  ".specify/templates/checklist-template.md"
  ".specify/templates/stack-template.md"
  ".specify/scripts/bash/check-prerequisites.sh"
  ".specify/scripts/bash/create-new-feature.sh"
  ".specify/scripts/bash/setup-plan.sh"
  ".specify/scripts/bash/update-agent-context.sh"
  ".specify/scripts/bash/common.sh"
  ".specify/scripts/bash/bootstrap.sh"
)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

log()  { echo "  ✓ $*"; }
warn() { echo "  ⚠️  $*"; }
info() { echo "$*"; }

# ---------------------------------------------------------------------------
# Validate source
# ---------------------------------------------------------------------------

if [[ ! -d "$SOURCE_ROOT/.github/agents" ]]; then
  echo "❌ Cannot locate speckit source at: $SOURCE_ROOT"
  echo "   Run this script from a repo that already has speckit installed."
  exit 1
fi

if [[ "$SOURCE_ROOT" == "$TARGET_DIR" ]]; then
  echo "❌ Source and target are the same directory: $TARGET_DIR"
  echo "   Run this script in a different (target) repo."
  exit 1
fi

# ---------------------------------------------------------------------------
# Banner
# ---------------------------------------------------------------------------

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║           speckit bootstrap — initializing repo          ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
echo "Source : $SOURCE_ROOT"
echo "Target : $TARGET_DIR"
echo ""

# ---------------------------------------------------------------------------
# Step 1: Create directory structure
# ---------------------------------------------------------------------------

info "📁 Creating directory structure..."
for dir in "${DIRS[@]}"; do
  mkdir -p "$TARGET_DIR/$dir"
  log "$dir/"
done
echo ""

# ---------------------------------------------------------------------------
# Step 2: Copy generic files
# ---------------------------------------------------------------------------

info "📄 Copying generic speckit files..."
COPIED=0
SKIPPED=0

for file in "${GENERIC_FILES[@]}"; do
  src="$SOURCE_ROOT/$file"
  dst="$TARGET_DIR/$file"

  if [[ ! -f "$src" ]]; then
    warn "Source not found, skipping: $file"
    SKIPPED=$((SKIPPED + 1))
    continue
  fi

  # Don't overwrite project-specific files that may already exist
  if [[ -f "$dst" ]]; then
    warn "Already exists, skipping: $file"
    SKIPPED=$((SKIPPED + 1))
    continue
  fi

  cp "$src" "$dst"
  log "$file"
  COPIED=$((COPIED + 1))
done

# Make hook scripts executable
for hook in log-session-start.sh log-session-end.sh log-prompt.sh; do
  hook_path="$TARGET_DIR/.github/hooks/session-logger/$hook"
  [[ -f "$hook_path" ]] && chmod +x "$hook_path"
done
# Make scripts executable
for script in check-prerequisites.sh create-new-feature.sh setup-plan.sh update-agent-context.sh common.sh bootstrap.sh; do
  script_path="$TARGET_DIR/.specify/scripts/bash/$script"
  [[ -f "$script_path" ]] && chmod +x "$script_path"
done

echo ""
echo "  Copied: $COPIED files | Skipped: $SKIPPED files"
echo ""

# ---------------------------------------------------------------------------
# Step 3: Add logs/ to .gitignore
# ---------------------------------------------------------------------------

info "🔒 Updating .gitignore..."
GITIGNORE="$TARGET_DIR/.gitignore"

if [[ ! -f "$GITIGNORE" ]]; then
  echo "# Session logs (speckit)" > "$GITIGNORE"
  echo "logs/" >> "$GITIGNORE"
  log "Created .gitignore with logs/ entry"
elif grep -q '^logs/' "$GITIGNORE"; then
  warn "logs/ already present in .gitignore — no change"
else
  echo "" >> "$GITIGNORE"
  echo "# Session logs (speckit)" >> "$GITIGNORE"
  echo "logs/" >> "$GITIGNORE"
  log "Added logs/ to existing .gitignore"
fi
echo ""

# ---------------------------------------------------------------------------
# Step 4: Next steps
# ---------------------------------------------------------------------------

echo "╔══════════════════════════════════════════════════════════╗"
echo "║                   bootstrap complete!                    ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
echo "📋 Next steps:"
echo ""
echo "  1. Create your project constitution:"
echo "     → Open GitHub Copilot CLI and run: /speckit.constitution"
echo "     → This creates .specify/memory/constitution.md"
echo ""
echo "  2. Create your Copilot instructions:"
echo "     → Create .github/copilot-instructions.md with your project context"
echo "     → Reference: .specify/memory/constitution.md"
echo ""
echo "  3. Start your first feature spec:"
echo "     → Run: /speckit.specify <feature description>"
echo "     → This will auto-create .specify/memory/stack.md"
echo ""
echo "  4. Set up session logging (optional):"
echo "     → Configure .github/hooks/hooks.json in your Copilot CLI settings"
echo "     → See .github/hooks/session-logger/README.md for instructions"
echo ""
echo "  📖 Full portability guide: docs/speckit-portability.md"
echo "  📖 Constitution: .specify/memory/constitution.md (after step 1)"
echo ""
