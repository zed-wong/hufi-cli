#!/bin/bash

set -e

CLI="./dist/cli.js"
TEST_KEY="$HOME/.hufi-cli/key.test.json"
PASS=0
FAIL=0
TOTAL=0

green='\033[0;32m'
red='\033[0;31m'
yellow='\033[0;33m'
reset='\033[0m'

rm -f "$TEST_KEY"

run() {
  TOTAL=$((TOTAL + 1))
  local desc="$1"
  shift
  echo -e "${yellow}[$TOTAL] Testing: ${desc}${reset}"
  if output=$("$CLI" "$@" 2>&1); then
    echo -e "${green}  ✅ PASS${reset}"
    PASS=$((PASS + 1))
    if [ -t 1 ]; then
      echo "$output" | head -5
    fi
  else
    echo -e "${red}  ❌ FAIL (exit code $?)${reset}"
    FAIL=$((FAIL + 1))
    echo "$output"
  fi
  echo ""
}

run_expect() {
  TOTAL=$((TOTAL + 1))
  local desc="$1"
  local expect="$2"
  shift 2
  echo -e "${yellow}[$TOTAL] Testing: ${desc}${reset}"
  if output=$("$CLI" "$@" 2>&1); then
    if echo "$output" | grep -qi "$expect"; then
      echo -e "${green}  ✅ PASS (found: ${expect})${reset}"
      PASS=$((PASS + 1))
    else
      echo -e "${red}  ❌ FAIL (expected: ${expect})${reset}"
      FAIL=$((FAIL + 1))
    fi
  else
    if echo "$output" | grep -qi "$expect"; then
      echo -e "${green}  ✅ PASS (expected error: ${expect})${reset}"
      PASS=$((PASS + 1))
    else
      echo -e "${red}  ❌ FAIL (unexpected error)${reset}"
      FAIL=$((FAIL + 1))
      echo "$output"
    fi
  fi
  echo ""
}

echo "========================================="
echo "  hufi-cli Integration Tests"
echo "========================================="
echo ""

echo "--- Auth ---"
run "auth generate --json" --key-file "$TEST_KEY" auth generate --json
run "auth login (saved key)" --key-file "$TEST_KEY" auth login
run "auth status" --key-file "$TEST_KEY" auth status
run "auth status --json" --key-file "$TEST_KEY" auth status --json

echo "--- Campaign ---"
run "campaign list" campaign list --limit 2
run_expect "campaign list has campaigns" "Available campaigns" campaign list --limit 1
run "campaign list --json" campaign list --limit 1 --json
run "campaign list --status completed" campaign list --status completed --limit 1
run "campaign get" campaign get --chain-id 137 --address 0x8ec517d124a7ff4510d5888a0d9cafb380845148
run "campaign get --json" campaign get --chain-id 137 --address 0x8ec517d124a7ff4510d5888a0d9cafb380845148 --json
run "campaign joined" --key-file "$TEST_KEY" campaign joined
run "campaign joined --json" --key-file "$TEST_KEY" campaign joined --json
run "campaign status" --key-file "$TEST_KEY" campaign status --chain-id 137 --address 0x8ec517d124a7ff4510d5888a0d9cafb380845148
run "campaign status --json" --key-file "$TEST_KEY" campaign status --chain-id 137 --address 0x8ec517d124a7ff4510d5888a0d9cafb380845148 --json
run "campaign leaderboard" --key-file "$TEST_KEY" campaign leaderboard --chain-id 137 --address 0x8ec517d124a7ff4510d5888a0d9cafb380845148

echo "--- Exchange ---"
run "exchange list" --key-file "$TEST_KEY" exchange list
run "exchange list --json" --key-file "$TEST_KEY" exchange list --json

echo "--- Help ---"
run "--help" --help
run "auth --help" auth --help
run "exchange --help" exchange --help
run "campaign --help" campaign --help

rm -f "$TEST_KEY"

echo "========================================="
echo "  Results: $PASS/$TOTAL passed, $FAIL failed"
echo "========================================="

if [ $FAIL -gt 0 ]; then
  exit 1
fi
