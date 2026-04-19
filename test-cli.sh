#!/bin/bash

set -e

CLI="./dist/cli.js"
TEST_KEY="$HOME/.hufi-cli/key.test.json"
TEST_PROFILE_KEY="$HOME/.hufi-cli/key.alpha-test.json"
TEST_CONFIG="$HOME/.hufi-cli/config.test.json"
BAD_AUTH_CONFIG="$HOME/.hufi-cli/config.bad-auth.test.json"
MOCK_RPC_INFO="$(mktemp)"
PASS=0
FAIL=0
TOTAL=0

green='\033[0;32m'
red='\033[0;31m'
yellow='\033[0;33m'
dim='\033[2m'
reset='\033[0m'

rm -f "$TEST_KEY" "$TEST_PROFILE_KEY" "$TEST_CONFIG" "$BAD_AUTH_CONFIG" "$MOCK_RPC_INFO"

bun tests/fixtures/mock-rpc-server.ts > "$MOCK_RPC_INFO" 2>/dev/null &
MOCK_RPC_PID=$!

cleanup() {
  if [ -n "$MOCK_RPC_PID" ] && kill -0 "$MOCK_RPC_PID" 2>/dev/null; then
    kill "$MOCK_RPC_PID" 2>/dev/null || true
    wait "$MOCK_RPC_PID" 2>/dev/null || true
  fi
  rm -f "$TEST_KEY" "$TEST_PROFILE_KEY" "$TEST_CONFIG" "$BAD_AUTH_CONFIG" "$MOCK_RPC_INFO"
}

trap cleanup EXIT

for _ in $(seq 1 50); do
  if [ -s "$MOCK_RPC_INFO" ]; then
    break
  fi
  sleep 0.1
done

if [ ! -s "$MOCK_RPC_INFO" ]; then
  echo "Failed to start mock RPC server" >&2
  exit 1
fi

export HUFI_RPC_137
HUFI_RPC_137=$(cat "$MOCK_RPC_INFO")

cat > "$TEST_CONFIG" <<EOF
{
  "recordingApiUrl": "https://ro.hu.finance",
  "launcherApiUrl": "https://cl.hu.finance",
  "defaultChainId": 137,
  "rpcUrls": {
    "137": "$HUFI_RPC_137"
  }
}
EOF

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
    if echo "$output" | grep -qiE -- "$expect"; then
      echo -e "${green}  ✅ PASS — found '${expect}'${reset}"
      PASS=$((PASS + 1))
    else
      echo -e "${red}  ❌ FAIL — expected '${expect}' not found${reset}"
      FAIL=$((FAIL + 1))
    fi
  else
    show_output
    if echo "$output" | grep -qiE -- "$expect"; then
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
    val=$(echo "$output" | bun -e "const d=await Bun.stdin.text();try{const j=JSON.parse(d);const v=j['$key'];console.log(typeof v==='string'?v:JSON.stringify(v))}catch{console.log('PARSE_ERROR')}")
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
run_expect "exchange register --help mentions CCXT" "CCXT exchange name" exchange register --help
cat > "$BAD_AUTH_CONFIG" <<EOF
{
  "recordingApiUrl": "https://ro.hu.finance",
  "accessToken": "invalid-test-token"
}
EOF
run_expect "exchange list with invalid token suggests auth login" "before listing exchange API keys" --config-file "$BAD_AUTH_CONFIG" exchange list

run "auth generate --json" $TEST_FLAGS auth generate --json
run_json "auth generate has address" "address" "^0x[0-9a-fA-F]{40}$" $TEST_FLAGS auth generate --json
run "auth login (saved key)" $TEST_FLAGS auth login
run_expect "auth status shows address" "0x" $TEST_FLAGS auth status
run_json "auth status --json has authenticated" "authenticated" "true" $TEST_FLAGS auth status --json
run_expect "auth list shows profiles section" "Profiles" $TEST_FLAGS auth list
run_expect "-p without value prints profiles section" "Profiles" --config-file "$TEST_CONFIG" -p
run_expect "-p without value prints local keys section" "Local keys" --config-file "$TEST_CONFIG" -p
run_expect "auth list shows local keys section" "Local keys" $TEST_FLAGS auth list
run_expect "auth list shows default profile" "default" $TEST_FLAGS auth list
run "auth login with profile alpha-test persists profile key" --config-file "$TEST_CONFIG" -p alpha-test auth login --private-key 0x59c6995e998f97a5a0044966f0945382f9b37fd0f9f4b5c9d6c1a1f3c7a2d8f1
run_expect "auth list shows alpha-test profile" "alpha-test" --config-file "$TEST_CONFIG" auth list
run_json "auth status --json with profile alpha-test is authenticated" "authenticated" "true" --config-file "$TEST_CONFIG" -p alpha-test auth status --json
run_expect "profile alpha-test reuses persisted key path" "$TEST_PROFILE_KEY" --config-file "$TEST_CONFIG" -p alpha-test auth login
run_json "unconfigured profile beta is not implicitly authenticated" "authenticated" "false" --config-file "$TEST_CONFIG" -p beta auth status --json

echo "--- Campaign ---"
run_expect "campaign list" "Available campaigns" campaign list --limit 1
run_expect "campaign list shows timestamps" "duration:   [0-9]{4}-[0-9]{2}-[0-9]{2} [0-9]{2}:[0-9]{2}:[0-9]{2} ~ [0-9]{4}-[0-9]{2}-[0-9]{2} [0-9]{2}:[0-9]{2}:[0-9]{2}" campaign list --limit 1
run "campaign list --json" campaign list --limit 1 --json
run "campaign list --status completed" campaign list --status completed --limit 1
run_expect "campaign get" "0x8ec5" campaign get --chain-id 137 --address 0x8ec517d124a7ff4510d5888a0d9cafb380845148
run "campaign get --json" campaign get --chain-id 137 --address 0x8ec517d124a7ff4510d5888a0d9cafb380845148 --json
run "campaign joined" $TEST_FLAGS campaign joined
run "campaign joined --all" $TEST_FLAGS campaign joined --all
run "campaign joined --json" $TEST_FLAGS campaign joined --json
run_expect "campaign status shows active profile" "Profile: alpha-test" $TEST_FLAGS campaign status --chain-id 137 --address 0x8ec517d124a7ff4510d5888a0d9cafb380845148
run_expect "campaign status" "Status" $TEST_FLAGS campaign status --chain-id 137 --address 0x8ec517d124a7ff4510d5888a0d9cafb380845148
run "campaign status --json" $TEST_FLAGS campaign status --chain-id 137 --address 0x8ec517d124a7ff4510d5888a0d9cafb380845148 --json
run_expect "campaign leaderboard" "Leaderboard" $TEST_FLAGS campaign leaderboard --chain-id 137 --address 0x8ec517d124a7ff4510d5888a0d9cafb380845148

echo "--- Exchange ---"
run_expect "exchange list shows active profile" "Profile: alpha-test" $TEST_FLAGS exchange list
run "exchange list --json" $TEST_FLAGS exchange list --json
run_expect "exchange delete --help shows positional name" "exchange delete \[name\]" exchange delete --help
run_expect "exchange revalidate --help shows positional name" "exchange revalidate \[name\]" exchange revalidate --help
run_expect "exchange delete --help" "Delete API keys" exchange delete --help
run_expect "exchange revalidate --help" "Revalidate" exchange revalidate --help

echo "--- Staking ---"
run_expect "staking stake --help shows positional amount" "staking stake \[amount\]" staking stake --help
run_expect "staking unstake --help shows positional amount" "staking unstake \[amount\]" staking unstake --help
run_expect "staking status shows active profile" "Profile: alpha-test" $TEST_FLAGS staking status --chain-id 137
run_expect "staking status" "chain 137" staking status --chain-id 137 --address 0x0F5d66E4c8d2aF5a5AcD0e2Dc3526a72a9206cc5
run_json "staking status --json" "stakedTokens" "^[0-9]" staking status --chain-id 137 --address 0x0F5d66E4c8d2aF5a5AcD0e2Dc3526a72a9206cc5 --json
run_json "staking status --json" "lockPeriod" "^[0-9]" staking status --chain-id 137 --address 0x0F5d66E4c8d2aF5a5AcD0e2Dc3526a72a9206cc5 --json
run_expect "staking deposit" "Deposit HMT" staking deposit

echo "--- Dashboard ---"
run_expect "dashboard shows active profile" "Profile: alpha-test" $TEST_FLAGS dashboard
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
run_expect "campaign leaderboard --help has watch" "--watch" campaign leaderboard --help
run_expect "campaign leaderboard --help has interval" "--interval" campaign leaderboard --help
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

echo "========================================="
echo -e "  ${green}Results: $PASS/$TOTAL passed${reset}"
if [ $FAIL -gt 0 ]; then
  echo -e "  ${red}$FAIL failed${reset}"
fi
echo "========================================="

if [ $FAIL -gt 0 ]; then
  exit 1
fi
