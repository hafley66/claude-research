#!/usr/bin/env bash
set -euo pipefail

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command')

# Only intercept git commit
if ! echo "$COMMAND" | grep -q "git commit"; then
  exit 0
fi

REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || echo ".")
PATTERNS_FILE="$REPO_ROOT/.secret-patterns"

if [ ! -f "$PATTERNS_FILE" ]; then
  exit 0
fi

# Scan staged files with rg
FILES=$(git diff --cached --diff-filter=ACMR --name-only 2>/dev/null)
if [ -z "$FILES" ]; then
  exit 0
fi

REGEXES=$(grep -v '^\s*#' "$PATTERNS_FILE" | grep -v '^\s*$')
FOUND=0
REPORT=""

while IFS= read -r file; do
  MATCHES=$(git show ":$file" 2>/dev/null | rg -n -f <(echo "$REGEXES") 2>/dev/null || true)
  if [ -n "$MATCHES" ]; then
    REPORT="$REPORT  $file:\n$(echo "$MATCHES" | sed 's/^/    /')\n"
    FOUND=1
  fi
done <<< "$FILES"

if [ "$FOUND" -eq 1 ]; then
  REASON="Secret detected in staged files:\n$REPORT"
  jq -n --arg reason "$REASON" '{
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: $reason
    }
  }'
  exit 0
fi
