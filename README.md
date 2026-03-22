# hufi-cli

CLI tool for the [hu.fi](https://hu.finance) DeFi platform.

## Install

```bash
bun install -g hufi-cli
```

Or run without installing:

```bash
bunx hufi-cli <command>
```

All examples below assume global install. Otherwise replace `hufi` with `bunx hufi-cli`.

## Quick Start

```bash
# Generate a wallet
hufi auth generate

# Login with saved key
hufi auth login

# Browse campaigns
hufi campaign list
```

## Commands

### auth

| Command | Description |
|---------|-------------|
| `auth generate` | Generate a new EVM wallet (saves to `~/.hufi-cli/key.json`) |
| `auth login` | Authenticate with Recording Oracle (uses saved key by default) |
| `auth status` | Show current auth status |

```bash
hufi auth generate --json
hufi auth login --private-key <key>
hufi auth status
```

### campaign

| Command | Description |
|---------|-------------|
| `campaign list` | Browse available campaigns |
| `campaign get` | Get details for a specific campaign |
| `campaign joined` | List campaigns you've joined |
| `campaign join` | Join a campaign |
| `campaign status` | Check join status |
| `campaign progress` | Check your progress |
| `campaign leaderboard` | View campaign leaderboard |
| `campaign create` | Create a new campaign (launch escrow on-chain) |

```bash
hufi campaign list                                          # list active campaigns
hufi campaign list --status completed --chain-id 1          # completed on Ethereum
hufi campaign get --chain-id 137 --address 0x...            # campaign details
hufi campaign join --address 0x...                          # join (chain-id defaults to 137)
hufi campaign status --address 0x...                        # check status
hufi campaign progress --address 0x...                      # your progress
hufi campaign progress --address 0x... --watch              # live updates (polling)
hufi campaign progress --address 0x... --watch --interval 3000
hufi campaign leaderboard --address 0x...                   # leaderboard
```

#### Campaign Create

Requires staked HMT, gas, and fund tokens (USDT/USDC). Creates an escrow contract on-chain.

```bash
# Market Making
hufi campaign create \
  --type market_making --exchange mexc --symbol HMT/USDT \
  --start-date 2026-04-01 --end-date 2026-05-01 \
  --fund-token USDT --fund-amount 10000 \
  --daily-volume-target 50000

# Holding
hufi campaign create \
  --type holding --exchange mexc --symbol HMT \
  --start-date 2026-04-01 --end-date 2026-05-01 \
  --fund-token USDT --fund-amount 5000 \
  --daily-balance-target 1000

# Threshold
hufi campaign create \
  --type threshold --exchange mexc --symbol HMT \
  --start-date 2026-04-01 --end-date 2026-05-01 \
  --fund-token USDT --fund-amount 5000 \
  --minimum-balance-target 500
```

Running `campaign status/join/progress/leaderboard` without `-a` shows help.

### exchange

| Command | Description |
|---------|-------------|
| `exchange register` | Register a read-only exchange API key |
| `exchange list` | List registered API keys |
| `exchange delete` | Delete API keys for an exchange |
| `exchange revalidate` | Revalidate an exchange API key |

```bash
hufi exchange register --name mexc --api-key <key> --secret-key <secret>
hufi exchange list
hufi exchange revalidate --name mexc
hufi exchange delete --name mexc
```

### staking

| Command | Description |
|---------|-------------|
| `staking status` | Check HMT staking status |
| `staking deposit` | Show deposit address and QR code |
| `staking stake` | Stake HMT tokens |
| `staking unstake` | Initiate unstaking (tokens locked for lock period) |
| `staking withdraw` | Withdraw unlocked tokens after lock period |

```bash
hufi staking deposit                                   # show address QR code
hufi staking status                                    # check your staking
hufi staking status --address 0x...                    # check another address
hufi staking stake -a 1000                             # stake 1000 HMT
hufi staking unstake -a 500                            # unstake 500 HMT
hufi staking withdraw                                  # withdraw unlocked tokens
```

Supports Polygon (chain 137) and Ethereum (chain 1). Staking contract: `0x01D1...07F1D` on Polygon.

### dashboard

Portfolio overview — staking, active campaigns, and progress in one view.

```bash
hufi dashboard              # full overview
hufi dashboard --json       # machine output
hufi dashboard --export csv # export active campaign rows as CSV
hufi dashboard --export json
```

## Global Options

| Option | Description |
|--------|-------------|
| `--config-file <path>` | Custom config file (default: `~/.hufi-cli/config.json`) |
| `--key-file <path>` | Custom key file (default: `~/.hufi-cli/key.json`) |
| `-V, --version` | Show version |
| `-h, --help` | Show help |

All commands support `--json` for machine-readable output.

## Configuration

Stored at `~/.hufi-cli/config.json`:

```json
{
  "recordingApiUrl": "https://ro.hu.finance",
  "launcherApiUrl": "https://cl.hu.finance",
  "defaultChainId": 137,
  "address": "0x...",
  "accessToken": "..."
}
```

## Development

```bash
bun install              # install deps
bun run dev -- --help    # run from source
bun run build            # build to dist/cli.js
bun test                 # unit tests
bun run test:cli         # integration tests
bun run typecheck        # type check
```

## API Endpoints

| Service | URL |
|---------|-----|
| Recording Oracle | https://ro.hu.finance |
| Campaign Launcher | https://cl.hu.finance |
