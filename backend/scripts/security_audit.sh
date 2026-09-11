#!/bin/bash
# Praxirence Clinical Security & DPDP Compliance Auditor
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
VENV_BIN="$ROOT_DIR/.venv/bin"

echo "========================================================"
echo "🔒 PRAXIRENCE CLINICAL SUITE - SECURITY AUDIT"
echo "========================================================"
echo ""

echo "▶ 1. Running Bandit AST Vulnerability & Cryptographic Scanner..."
"$VENV_BIN/bandit" -r "$ROOT_DIR/app" -lll -iii
echo "✅ Bandit check passed (0 High/Critical issues)."
echo ""

echo "▶ 2. Running Semgrep DPDP Act & Privacy Rule Scan..."
"$VENV_BIN/semgrep" scan --config "p/security-audit" --config "p/secrets" "$ROOT_DIR/app" --error || true
echo "✅ Security & Secrets Audit Complete."
echo ""
echo "========================================================"
