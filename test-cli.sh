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
      echo "$output"
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

run_json() {
  TOTAL=$((TOTAL + 1))
  local desc="$1"
  local key="$2"
  local expect="$3"
  shift 3
  echo -e "${yellow}[$TOTAL] Testing: ${desc}${reset}"
  if output=$("$CLI" "$@" 2>&1); then
    local val
    val=$(echo "$output" | node -e "const d=require('fs').readFileSync(0,'utf8');try{const j=JSON.parse(d);const v=j['$key'];console.log(typeof v==='string'?v:JSON.stringify(v))}catch{console.log('PARSE_ERROR')}")
    if echo "$val" | grep -qiE "$expect"; then
      echo -e "${green}  ✅ PASS ($key matches: $expect)${reset}"
      PASS=$((PASS + 1))
    else
      echo -e "${red}  ❌ FAIL ($key='$val' expected: $expect)${reset}"
      FAIL=$((FAIL + 1))
    fi
  else
    echo -e "${red}  ❌ FAIL (exit code $?)${reset}"
    FAIL=$((FAIL + 1))
    echo "$output"
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
run_json "auth generate has address" "address" "^0x[0-9a-fA-F]{40}$" $TEST_FLAGS auth generate --json
run "auth login (saved key)" $TEST_FLAGS auth login
run_expect "auth status shows address" "0x" $TEST_FLAGS auth status
run_json "auth status --json has authenticated" "authenticated" "true" $TEST_FLAGS auth status --json

echo "--- Campaign ---"
run_expect "campaign list has header" "Available campaigns" campaign list --limit 1
run_expect "campaign list shows campaigns" "status" campaign list --limit 1
run "campaign list --json" campaign list --limit 1 --json
run "campaign list --status completed" campaign list --status completed --limit 1
run_expect "campaign get shows details" "0x8ec5" campaign get --chain-id 137 --address 0x8ec517d124a7ff4510d5888a0d9cafb380845148
run "campaign get --json" campaign get --chain-id 137 --address 0x8ec517d124a7ff4510d5888a0d9cafb380845148 --json
run "campaign joined" $TEST_FLAGS campaign joined
run "campaign joined --json" $TEST_FLAGS campaign joined --json
run_expect "campaign status shows status" "Status" $TEST_FLAGS campaign status --chain-id 137 --address 0x8ec517d124a7ff4510d5888a0d9cafb380845148
run "campaign status --json" $TEST_FLAGS campaign status --chain-id 137 --address 0x8ec517d124a7ff4510d5888a0d9cafb380845148 --json
run_expect "campaign leaderboard shows data" "Leaderboard" $TEST_FLAGS campaign leaderboard --chain-id 137 --address 0x8ec517d124a7ff4510d5888a0d9cafb380845148

echo "--- Exchange ---"
run "exchange list" $TEST_FLAGS exchange list
run "exchange list --json" $TEST_FLAGS exchange list --json
run_expect "exchange delete --help" "Delete API keys" exchange delete --help
run_expect "exchange revalidate --help" "Revalidate" exchange revalidate --help

echo "--- Staking ---"
run_expect "staking status shows chain" "chain 137" staking status --chain-id 137 --address 0x0F5d66E4c8d2aF5a5AcD0e2Dc3526a72a9206cc5
run_json "staking status --json has stakedTokens" "stakedTokens" "^[0-9]" staking status --chain-id 137 --address 0x0F5d66E4c8d2aF5a5AcD0e2Dc3526a72a9206cc5 --json
run_json "staking status --json has lockPeriod" "lockPeriod" "^[0-9]" staking status --chain-id 137 --address 0x0F5d66E4c8d2aF5a5AcD0e2Dc3526a72a9206cc5 --json
run_expect "staking deposit shows QR" "Deposit HMT" staking deposit
run_expect "staking deposit shows address" "0x" staking deposit

echo "--- Dashboard ---"
run_expect "dashboard shows wallet" "Wallet:" $TEST_FLAGS dashboard
run_expect "dashboard shows staking" "Staking" $TEST_FLAGS dashboard
run_json "dashboard --json has address" "address" "^0x" $TEST_FLAGS dashboard --json
run_json "dashboard --json has staking" "staking" "{" $TEST_FLAGS dashboard --json

echo "--- Help ---"
run_expect "--help shows auth" "auth" --help
run_expect "--help shows campaign" "campaign" --help
run_expect "--help shows exchange" "exchange" --help
run_expect "--help shows staking" "staking" --help
run_expect "--help shows dashboard" "dashboard" --help

rm -f "$TEST_KEY" "$TEST_CONFIG"

echo "========================================="
echo "  Results: $PASS/$TOTAL passed, $FAIL failed"
echo "========================================="

if [ $FAIL -gt 0 ]; then
  exit 1
fi
