# hufi-cli Development Plan

## Current State (v0.6.1)

| Module | Commands | Status |
|--------|----------|--------|
| auth | generate, login, status | Complete |
| campaign | list, get, joined, join, status, progress, leaderboard | Partial — no creation |
| exchange | register, list | Partial — no delete/revalidate |
| staking | status, stake, unstake, withdraw, deposit | Complete |

## Priority 1: Campaign Create

**Why:** Users currently must use the web UI to launch campaigns. CLI users who already manage everything from terminal are forced to switch context.

### Requirements

Campaign creation involves three on-chain transactions:
1. Create escrow contract
2. Fund escrow with reward token
3. Setup campaign details (exchange, symbol, dates, targets)

The web UI calls the Launcher API (`cl.hu.finance`) then sends transactions via MetaMask. CLI needs to:
- Call Launcher API to get campaign parameters
- Send transactions directly using stored private key

### Campaign Types to Support

| Type | Required Fields |
|------|-----------------|
| Market Making | exchange, symbol, start_date, end_date, fund_token, fund_amount, daily_volume_target |
| Holding | exchange, symbol, start_date, end_date, fund_token, fund_amount, daily_balance_target |
| Threshold | exchange, symbol, start_date, end_date, fund_token, fund_amount, minimum_balance_target |

### Implementation

```
hufi campaign create \
  --type market_making \
  --chain-id 137 \
  --exchange mexc \
  --symbol HMT/USDT \
  --start-date 2026-04-01 \
  --end-date 2026-05-01 \
  --fund-token USDT \
  --fund-amount 10000 \
  --daily-volume-target 50000
```

**Steps:**
1. Add Launcher API `POST /campaigns/create` service call (need to verify API exists)
2. If no server-side API: interact with EscrowFactory contract directly via ethers.js
   - EscrowFactory address: `0x8D50dA7abe354a628a63ADfE23C19a2944612b83` (Polygon)
   - Requires staking as prerequisite (already implemented)
3. Add campaign type definitions for all three types
4. Add interactive prompts for missing required fields (inquirer or simple readline)
5. Validate dates (min 6 hours, max 100 days per docs)

**Files:**
- `src/services/launcher/campaign.ts` — add `createCampaign()`
- `src/types/launcher.ts` — add creation DTOs
- `src/commands/campaign.ts` — add `create` subcommand

**Risk:** Need to verify Launcher API supports campaign creation, or implement direct contract calls.

---

## Priority 2: Portfolio / Dashboard

**Why:** Users need a single command to see their full picture — active campaigns, earnings, staking — instead of running 4-5 separate commands.

### Implementation

```
hufi dashboard
```

Output:
```
Wallet: 0x0F5d...cc5  Chain: Polygon

Staking
  Staked:    5,000 HMT
  Available: 2,500 HMT
  Balance:   1,200 HMT

Active Campaigns (3)
  Mexc HMT/USDT (Market Making)     progress: 85%  earned: 120 USDT
  Mexc HMT (Holding)                 progress: 92%  earned: 45 USDT
  Bybit HMT/USDT (Market Making)     progress: 30%  earned: 12 USDT

Total Earned: 177 USDT
```

**Steps:**
1. Fetch staking info (reuse `getStakingInfo`)
2. Fetch joined campaigns (reuse `listJoinedCampaigns`)
3. For each active campaign, fetch progress (reuse `getMyProgress`)
4. Aggregate and display summary table
5. Support `--json` for machine output
6. Support `--chain-id` to filter by chain

**Files:**
- `src/commands/dashboard.ts` — new command
- `src/cli.ts` — register command

**Data sources:** All existing API calls, no new endpoints needed.

---

## Priority 3: Exchange Management

**Why:** Current exchange commands can only register and list. Users can't remove invalid keys or recheck validity.

### Missing Endpoints (confirmed from Swagger)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/exchange-api-keys/{exchange_name}` | DELETE | Delete API keys for exchange |
| `/exchange-api-keys/{exchange_name}/revalidate` | POST | Revalidate API key |

### Implementation

```
hufi exchange delete --name mexc           # delete key
hufi exchange revalidate --name mexc       # re-check validity
hufi exchange revalidate --all             # recheck all keys
```

**Steps:**
1. Add `deleteExchangeApiKey()` to `src/services/recording/exchange.ts`
2. Add `revalidateExchangeApiKey()` to `src/services/recording/exchange.ts`
3. Add `delete` subcommand to exchange
4. Add `revalidate` subcommand to exchange
5. Update exchange `list` to show validity status more clearly

**Files:**
- `src/services/recording/exchange.ts` — add 2 functions
- `src/types/exchange.ts` — add `RevalidateResult` type
- `src/commands/exchange.ts` — add delete + revalidate subcommands

---

## Suggested Execution Order

| Phase | Features | Estimated Scope |
|-------|----------|-----------------|
| Phase 1 | Exchange delete + revalidate | Small — 2 new API calls + 2 subcommands |
| Phase 2 | Portfolio dashboard | Medium — aggregate existing data, new command |
| Phase 3 | Campaign create | Large — contract interaction or new API, validation, multiple campaign types |

**Rationale:**
- Phase 1 is quick win — API endpoints already exist, just wire them up
- Phase 2 builds confidence with read-only aggregation before tackling writes
- Phase 3 is hardest — needs contract interaction or Launcher API research

---

## Out of Scope (Not Now)

- Reputation oracle integration — no clear user-facing API, runs as GitHub Action
- Notification / watch mode — better suited for a daemon, not CLI
- Custom RPC URLs — current defaults work fine
- Multi-wallet support — single wallet is sufficient for now
