# Campaign Create Implementation Plan

**Date:** 2026-03-22
**Branch:** master
**Target:** `hufi campaign create`

## Source Analysis

From `../hufi/campaign-launcher/client/src/hooks/useCreateEscrow.ts` and `@human-protocol/sdk`:

Web UI calls `EscrowClient.createFundAndSetupEscrow()` which wraps a single on-chain transaction:

```
EscrowFactory.createFundAndSetupEscrow(
  tokenAddress,       // ERC20 (USDT/USDC)
  amount,             // reward amount in wei
  jobRequesterId,     // "hufi-campaign-launcher"
  reputationOracle,   // 0x1519964f5cd2d9ef162b2b1b66f33669cca065c8
  recordingOracle,    // 0x3a2292c684e289fe5f07737b598fe0027ead5a0e
  exchangeOracle,     // 0x5b74d007ea08217bcde942a2132df43d568a6dca
  manifest,           // JSON string
  manifestHash        // SHA-1 of manifest
)
```

Emit: `LaunchedV2(address,address,string)` → returns escrow address

Before calling: need `ERC20.approve(EscrowFactory, amount)`.

## Command Design

```bash
hufi campaign create \
  --type market_making \
  --exchange mexc \
  --symbol HMT/USDT \
  --start-date 2026-04-01 \
  --end-date 2026-05-01 \
  --fund-token USDT \
  --fund-amount 10000 \
  --daily-volume-target 50000 \
  --chain-id 137
```

### Campaign Types

| Type | Required Target Field |
|------|----------------------|
| `market_making` | `--daily-volume-target` |
| `holding` | `--daily-balance-target` |
| `threshold` | `--minimum-balance-target` |

### Manifest Format (from source code)

```json
// Market Making
{"type":"MARKET_MAKING","exchange":"mexc","pair":"HMT/USDT","start_date":"...","end_date":"...","daily_volume_target":50000}

// Holding
{"type":"HOLDING","exchange":"mexc","symbol":"HMT","start_date":"...","end_date":"...","daily_balance_target":1000}

// Threshold
{"type":"THRESHOLD","exchange":"mexc","symbol":"HMT","start_date":"...","end_date":"...","minimum_balance_target":500}
```

## Files to Create/Modify

### 1. `src/lib/contracts.ts` — Add oracle addresses + fund token addresses

```ts
export const ORACLES = {
  exchangeOracle:  "0x5b74d007ea08217bcde942a2132df43d568a6dca",
  recordingOracle: "0x3a2292c684e289fe5f07737b598fe0027ead5a0e",
  reputationOracle: "0x1519964f5cd2d9ef162b2b1b66f33669cca065c8",
};

export const FUND_TOKENS: Record<number, Record<string, string>> = {
  137: {
    USDT: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
    USDC: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
  },
  1: {
    // Ethereum token addresses if needed
  },
};
```

### 2. `src/services/campaign-create.ts` — New service

```ts
export async function createCampaign(
  privateKey: string,
  chainId: number,
  params: {
    type: "MARKET_MAKING" | "HOLDING" | "THRESHOLD";
    exchange: string;
    pair?: string;        // MARKET_MAKING only
    symbol?: string;      // HOLDING/THRESHOLD only
    startDate: string;    // ISO string
    endDate: string;
    fundToken: string;    // "USDT" or "USDC"
    fundAmount: string;   // human-readable, e.g. "10000"
    dailyVolumeTarget?: number;
    dailyBalanceTarget?: number;
    minimumBalanceTarget?: number;
  }
): Promise<{ escrowAddress: string; txHash: string }>
```

**Logic:**
1. Build manifest JSON from params
2. Compute SHA-1 hash of manifest string
3. Look up fund token address from `FUND_TOKENS[chainId]`
4. Parse fund amount with token decimals (read `decimals()` from ERC20)
5. Approve token spend for EscrowFactory
6. Call `EscrowFactory.createFundAndSetupEscrow()`
7. Parse `LaunchedV2` event to get escrow address
8. Return `{ escrowAddress, txHash }`

### 3. `src/types/campaign-create.ts` — New types

```ts
export interface CampaignCreateParams {
  type: "MARKET_MAKING" | "HOLDING" | "THRESHOLD";
  exchange: string;
  pair?: string;
  symbol?: string;
  startDate: string;
  endDate: string;
  fundToken: string;
  fundAmount: string;
  dailyVolumeTarget?: number;
  dailyBalanceTarget?: number;
  minimumBalanceTarget?: number;
}
```

### 4. `src/commands/campaign.ts` — Add `create` subcommand

```ts
campaign
  .command("create")
  .description("Create a new campaign")
  .requiredOption("--type <type>", "Campaign type (market_making, holding, threshold)")
  .requiredOption("--exchange <name>", "Exchange name (e.g. mexc, bybit)")
  .requiredOption("--symbol <symbol>", "Token symbol or pair (e.g. HMT/USDT or HMT)")
  .requiredOption("--start-date <date>", "Start date (ISO or YYYY-MM-DD)")
  .requiredOption("--end-date <date>", "End date (ISO or YYYY-MM-DD)")
  .requiredOption("--fund-token <token>", "Fund token (USDT or USDC)")
  .requiredOption("--fund-amount <amount>", "Fund amount")
  .option("--daily-volume-target <n>", "Daily volume target (market_making)", Number)
  .option("--daily-balance-target <n>", "Daily balance target (holding)", Number)
  .option("--minimum-balance-target <n>", "Minimum balance target (threshold)", Number)
  .option("-c, --chain-id <id>", "Chain ID", Number, getDefaultChainId())
  .option("--json", "Output as JSON")
  .action(...)
```

**Validation:**
- `--type` must be one of: `market_making`, `holding`, `threshold`
- Duration: at least 6 hours, at most 100 days
- `--daily-volume-target` required for market_making
- `--daily-balance-target` required for holding
- `--minimum-balance-target` required for threshold
- `--fund-token` must be `USDT` or `USDC`
- Check staking > 0 (campaign creation requires staked HMT)

### 5. `src/lib/contracts.ts` — EscrowFactory ABI

```ts
export const ESCROW_FACTORY_ABI = [
  "function createFundAndSetupEscrow(address token, uint256 amount, string jobRequesterId, address reputationOracle, address recordingOracle, address exchangeOracle, string manifest, string manifestHash) returns (address)",
  "event LaunchedV2(address indexed escrow, address indexed launcher, string jobRequesterId)",
];
```

### 6. Manifest hash

From `../hufi/campaign-launcher/client/src/utils/index.ts:255`:
- Uses `crypto.subtle.digest('SHA-1', ...)` — Web Crypto API
- Node.js equivalent: `crypto.createHash('sha1').update(manifest).digest('hex')`

## Execution Order

1. Add oracle addresses + fund tokens to `contracts.ts`
2. Add EscrowFactory ABI to `contracts.ts`
3. Create `src/types/campaign-create.ts`
4. Create `src/services/campaign-create.ts`
5. Add `create` subcommand to `src/commands/campaign.ts`
6. Update tests + README
7. Bump version

## Risks

- **Token approval**: Need to handle case where allowance already exists (skip approve)
- **Gas estimation**: `createFundAndSetupEscrow` is complex, gas estimation may fail on some RPCs
- **SHA-1 vs keccak256**: Web UI uses SHA-1, need to verify this matches the contract's expectation
- **EscrowFactory on Ethereum**: Need to verify the Ethereum factory address works the same way
