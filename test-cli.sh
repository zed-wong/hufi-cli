#!/bin/bash

set -e

CLI="./dist/cli.js"
TEST_KEY="$HOME/.hufi-cli/key.test.json"
TEST_CONFIG="$HOME/.hufi-cli/config.test.json"
PASS=0
FAIL=0
TOTAL=0

green='\033[0;32m'
red='\033[0;31m'
yellow='\033[0;33m'
reset='\033[0m'

rm -f "$TEST_KEY" "$TEST_CONFIG"

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
TEST_FLAGS="--config-file $TEST_CONFIG --key-file $TEST_KEY"
run "auth generate --json" $TEST_FLAGS auth generate --json
run "auth login (saved key)" $TEST_FLAGS auth login
run "auth status" $TEST_FLAGS auth status
run "auth status --json" $TEST_FLAGS auth status --json

echo "--- Campaign ---"
run "campaign list" campaign list --limit 2
run_expect "campaign list has campaigns" "Available campaigns" campaign list --limit 1
run "campaign list --json" campaign list --limit 1 --json
run "campaign list --status completed" campaign list --status completed --limit 1
run "campaign get" campaign get --chain-id 137 --address 0x8ec517d124a7ff4510d5888a0d9cafb380845148
run "campaign get --json" campaign get --chain-id 137 --address 0x8ec517d124a7ff4510d5888a0d9cafb380845148 --json
run "campaign joined" $TEST_FLAGS campaign joined
run "campaign joined --json" $TEST_FLAGS campaign joined --json
run "campaign status" $TEST_FLAGS campaign status --chain-id 137 --address 0x8ec517d124a7ff4510d5888a0d9cafb380845148
run "campaign status --json" $TEST_FLAGS campaign status --chain-id 137 --address 0x8ec517d124a7ff4510d5888a0d9cafb380845148 --json
run "campaign leaderboard" $TEST_FLAGS campaign leaderboard --chain-id 137 --address 0x8ec517d124a7ff4510d5888a0d9cafb380845148

echo "--- Exchange ---"
run "exchange list" $TEST_FLAGS exchange list
run "exchange list --json" $TEST_FLAGS exchange list --json

echo "--- Staking ---"
run_expect "staking status" "Staking status" staking status --chain-id 137 --address 0x0F5d66E4c8d2aF5a5AcD0e2Dc3526a72a9206cc5
run "staking status --json" staking status --chain-id 137 --address 0x0F5d66E4c8d2aF5a5AcD0e2Dc3526a72a9206cc5 --json
run "staking --help" staking --help
run "staking stake --help" staking stake --help
run_expect "staking deposit" "Deposit HMT" staking deposit

echo "--- Help ---"
run "--help" --help
run "auth --help" auth --help
run "exchange --help" exchange --help
run "campaign --help" campaign --help
run "staking --help" staking --help

rm -f "$TEST_KEY" "$TEST_CONFIG"

echo "========================================="
echo "  Results: $PASS/$TOTAL passed, $FAIL failed"
echo "========================================="

if [ $FAIL -gt 0 ]; then
  exit 1
fi
