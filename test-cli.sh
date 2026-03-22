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
dim='\033[2m'
reset='\033[0m'

rm -f "$TEST_KEY" "$TEST_CONFIG"

show_output() {
  echo "$output" | head -8 | sed 's/^/    /'
  local lines
  lines=$(echo "$output" | wc -l)
  if [ "$lines" -gt 8 ]; then
    echo -e "    ${dim}... ($lines lines total)${reset}"
  fi
}

run() {
  TOTAL=$((TOTAL + 1))
  local desc="$1"
  shift
  echo -e "${yellow}[$TOTAL] ${desc}${reset}"
  echo -e "    ${dim}\$ $CLI $*${reset}"
  if output=$("$CLI" "$@" 2>&1); then
    show_output
    echo -e "${green}  ✅ PASS${reset}"
    PASS=$((PASS + 1))
  else
    show_output
    echo -e "${red}  ❌ FAIL (exit code $?)${reset}"
    FAIL=$((FAIL + 1))
  fi
  echo ""
}

run_expect() {
  TOTAL=$((TOTAL + 1))
  local desc="$1"
  local expect="$2"
  shift 2
  echo -e "${yellow}[$TOTAL] ${desc}${reset}"
  echo -e "    ${dim}\$ $CLI $*${reset}"
  if output=$("$CLI" "$@" 2>&1); then
    show_output
    if echo "$output" | grep -qi -- "$expect"; then
      echo -e "${green}  ✅ PASS — found '${expect}'${reset}"
      PASS=$((PASS + 1))
    else
      echo -e "${red}  ❌ FAIL — expected '${expect}' not found${reset}"
      FAIL=$((FAIL + 1))
    fi
  else
    show_output
    if echo "$output" | grep -qi -- "$expect"; then
      echo -e "${green}  ✅ PASS — expected error: '${expect}'${reset}"
      PASS=$((PASS + 1))
    else
      echo -e "${red}  ❌ FAIL — unexpected error${reset}"
      FAIL=$((FAIL + 1))
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
  echo -e "${yellow}[$TOTAL] ${desc}${reset}"
  echo -e "    ${dim}\$ $CLI $*${reset}"
  if output=$("$CLI" "$@" 2>&1); then
    show_output
    local val
    val=$(echo "$output" | node -e "const d=require('fs').readFileSync(0,'utf8');try{const j=JSON.parse(d);const v=j['$key'];console.log(typeof v==='string'?v:JSON.stringify(v))}catch{console.log('PARSE_ERROR')}")
    if echo "$val" | grep -qiE "$expect"; then
      echo -e "${green}  ✅ PASS — .$key = '$val'${reset}"
      PASS=$((PASS + 1))
    else
      echo -e "${red}  ❌ FAIL — .$key = '$val', expected '${expect}'${reset}"
      FAIL=$((FAIL + 1))
    fi
  else
    show_output
    echo -e "${red}  ❌ FAIL (exit code $?)${reset}"
    FAIL=$((FAIL + 1))
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
run_expect "campaign list" "Available campaigns" campaign list --limit 1
run "campaign list --json" campaign list --limit 1 --json
run "campaign list --status completed" campaign list --status completed --limit 1
run_expect "campaign get" "0x8ec5" campaign get --chain-id 137 --address 0x8ec517d124a7ff4510d5888a0d9cafb380845148
run "campaign get --json" campaign get --chain-id 137 --address 0x8ec517d124a7ff4510d5888a0d9cafb380845148 --json
run "campaign joined" $TEST_FLAGS campaign joined
run "campaign joined --json" $TEST_FLAGS campaign joined --json
run_expect "campaign status" "Status" $TEST_FLAGS campaign status --chain-id 137 --address 0x8ec517d124a7ff4510d5888a0d9cafb380845148
run "campaign status --json" $TEST_FLAGS campaign status --chain-id 137 --address 0x8ec517d124a7ff4510d5888a0d9cafb380845148 --json
run_expect "campaign leaderboard" "Leaderboard" $TEST_FLAGS campaign leaderboard --chain-id 137 --address 0x8ec517d124a7ff4510d5888a0d9cafb380845148

echo "--- Exchange ---"
run "exchange list" $TEST_FLAGS exchange list
run "exchange list --json" $TEST_FLAGS exchange list --json
run_expect "exchange delete --help" "Delete API keys" exchange delete --help
run_expect "exchange revalidate --help" "Revalidate" exchange revalidate --help

echo "--- Staking ---"
run_expect "staking status" "chain 137" staking status --chain-id 137 --address 0x0F5d66E4c8d2aF5a5AcD0e2Dc3526a72a9206cc5
run_json "staking status --json" "stakedTokens" "^[0-9]" staking status --chain-id 137 --address 0x0F5d66E4c8d2aF5a5AcD0e2Dc3526a72a9206cc5 --json
run_json "staking status --json" "lockPeriod" "^[0-9]" staking status --chain-id 137 --address 0x0F5d66E4c8d2aF5a5AcD0e2Dc3526a72a9206cc5 --json
run_expect "staking deposit" "Deposit HMT" staking deposit

echo "--- Dashboard ---"
run_expect "dashboard" "Wallet:" $TEST_FLAGS dashboard
run_json "dashboard --json" "address" "^0x" $TEST_FLAGS dashboard --json
run_json "dashboard --json" "staking" "{" $TEST_FLAGS dashboard --json
run_json "dashboard --export json" "address" "^0x" $TEST_FLAGS dashboard --export json
run_expect "dashboard rejects bad export" "Invalid export format" $TEST_FLAGS dashboard --export yaml

echo "--- Help ---"
run "--help" --help
run "auth --help" auth --help
run "campaign --help" campaign --help
run_expect "campaign progress --help has watch" "--watch" campaign progress --help
run_expect "campaign progress --help has interval" "--interval" campaign progress --help
run "exchange --help" exchange --help
run "staking --help" staking --help
run "dashboard --help" dashboard --help
run_expect "dashboard --help has export" "--export" dashboard --help
run_expect "campaign create --help" "Create a new campaign" campaign create --help
run_expect "campaign create needs volume target" "daily-volume-target is required" campaign create --type market_making --exchange mexc --symbol HMT/USDT --start-date 2026-04-01 --end-date 2026-05-01 --fund-token USDT --fund-amount 100
run_expect "campaign create needs balance target" "daily-balance-target is required" campaign create --type holding --exchange mexc --symbol HMT --start-date 2026-04-01 --end-date 2026-05-01 --fund-token USDT --fund-amount 100
run_expect "campaign create needs min target" "minimum-balance-target is required" campaign create --type threshold --exchange mexc --symbol HMT --start-date 2026-04-01 --end-date 2026-05-01 --fund-token USDT --fund-amount 100
run_expect "campaign create rejects bad type" "Invalid type" campaign create --type bad_type --exchange mexc --symbol HMT --start-date 2026-04-01 --end-date 2026-05-01 --fund-token USDT --fund-amount 100 --daily-volume-target 1000
run_expect "campaign create rejects short duration" "at least 6 hours" campaign create --type market_making --exchange mexc --symbol HMT/USDT --start-date 2026-04-01 --end-date 2026-04-01 --fund-token USDT --fund-amount 100 --daily-volume-target 1000

rm -f "$TEST_KEY" "$TEST_CONFIG"

echo "========================================="
echo -e "  ${green}Results: $PASS/$TOTAL passed${reset}"
if [ $FAIL -gt 0 ]; then
  echo -e "  ${red}$FAIL failed${reset}"
fi
echo "========================================="

if [ $FAIL -gt 0 ]; then
  exit 1
fi
