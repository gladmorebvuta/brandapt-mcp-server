#!/usr/bin/env bash
# install-gitleaks-hook.sh — install a gitleaks pre-commit hook in this repo.
# Blocks commits that would leak secrets (API keys, tokens, private keys).
#
# Requires gitleaks installed on your machine. Install with:
#   macOS:   brew install gitleaks
#   Windows: winget install gitleaks   OR   scoop install gitleaks
#   Linux:   https://github.com/gitleaks/gitleaks/releases
#
# Usage: ./scripts/install-gitleaks-hook.sh

set -euo pipefail

if ! git rev-parse --git-dir >/dev/null 2>&1; then
  echo "❌ Not a git repo." >&2
  exit 1
fi

if ! command -v gitleaks >/dev/null 2>&1; then
  echo "❌ gitleaks not installed." >&2
  echo "   Install from https://github.com/gitleaks/gitleaks#installing" >&2
  echo "   On Windows: winget install gitleaks   OR   scoop install gitleaks" >&2
  echo "   On macOS:   brew install gitleaks" >&2
  exit 1
fi

HOOK_DIR=$(git rev-parse --git-path hooks)
HOOK_FILE="$HOOK_DIR/pre-commit"

if [ -f "$HOOK_FILE" ]; then
  if grep -q "gitleaks" "$HOOK_FILE" 2>/dev/null; then
    echo "✓ gitleaks hook already installed at $HOOK_FILE"
    exit 0
  fi
  echo "⚠  A pre-commit hook already exists at $HOOK_FILE and does NOT mention gitleaks."
  echo "   Back it up and merge manually — refusing to overwrite." >&2
  exit 1
fi

cat > "$HOOK_FILE" <<'EOF'
#!/usr/bin/env bash
# Pre-commit: scan staged changes for secrets with gitleaks.
# Installed by scripts/install-gitleaks-hook.sh
#
# To bypass in a genuine emergency: git commit --no-verify
# (but first ask yourself why — bypasses mean secrets in history)

set -e

if ! command -v gitleaks >/dev/null 2>&1; then
  echo "⚠  gitleaks not found on PATH — skipping secret scan."
  echo "   Install from https://github.com/gitleaks/gitleaks to enable."
  exit 0
fi

gitleaks protect --staged --redact --verbose
EOF

chmod +x "$HOOK_FILE"

echo "✅ Installed gitleaks pre-commit hook at $HOOK_FILE"
echo ""
echo "   It will scan STAGED changes before each commit and block if secrets are found."
echo "   To bypass in an emergency: git commit --no-verify"
echo "   (but fix the leak instead whenever possible)"
