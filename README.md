# hufi-cli

[![License: WTFPL](https://img.shields.io/badge/License-WTFPL-brightgreen.svg)](http://www.wtfpl.net/about/)

CLI tool for the [hu.fi](https://hu.finance) platform.

## Install

```bash
bun install -g hufi-cli
```

Or run without installing:

```bash
bunx hufi-cli <command>
```

All examples below assume global install. Otherwise replace `hufi-cli` with `bunx hufi-cli`.

## Quick Start

```bash
# Generate a wallet
hufi-cli auth generate

# Login with saved key
hufi-cli auth login

# List configured profiles and local key files
hufi-cli auth list

# Browse campaigns
hufi-cli campaign list
```

## Commands

### auth

| Command | Description |
|---------|-------------|
| `auth generate` | Generate a new EVM wallet for the active profile |
| `auth login` | Authenticate with Recording Oracle (uses saved key by default) |
| `auth list` | List configured profiles and local key files |
| `auth status` | Show current auth status |

```bash
hufi-cli auth generate --json
hufi-cli auth login --private-key <key>
hufi-cli auth list
hufi-cli auth status
```

Profile-aware auth and key storage:

- default profile key: `~/.hufi-cli/key.json`
- named profile key: `~/.hufi-cli/key.<profile>.json`
- use `-p, --profile <name>` to switch profile context
- selecting a profile uses only that profile's auth state; it does not silently fall back to `default`
- run `hufi-cli -p` to print the same profile/key inventory as `auth list`

```bash
hufi-cli -p alpha auth login --private-key <key>
hufi-cli -p alpha exchange list
hufi-cli -p beta auth status
hufi-cli -p
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
hufi-cli campaign list                                          # list active campaigns
hufi-cli campaign list --status completed --chain-id 1          # completed on Ethereum
hufi-cli campaign get --chain-id 137 --address 0x...            # campaign details
hufi-cli campaign join --address 0x...                          # join (chain-id defaults to 137)
hufi-cli campaign status --address 0x...                        # check status
hufi-cli campaign progress --address 0x...                      # your progress
hufi-cli campaign progress --address 0x... --watch              # live updates (polling)
hufi-cli campaign progress --address 0x... --watch --interval 3000
hufi-cli campaign leaderboard --address 0x...                   # leaderboard
```

`campaign list` and `campaign get` print exact campaign timestamps and round token balances for human-readable text output.

#### Campaign Create

Requires staked HMT, gas, and fund tokens (USDT/USDC). Creates an escrow contract on-chain.

Before broadcasting, the CLI validates the campaign type-specific target, checks the 6-hour to 100-day duration window, verifies your minimum HMT stake when possible, inspects fund token balance, and estimates gas for approval plus creation.

```bash
# Market Making
hufi-cli campaign create \
  --type market_making --exchange mexc --symbol HMT/USDT \
  --start-date 2026-04-01 --end-date 2026-05-01 \
  --fund-token USDT --fund-amount 10000 \
  --daily-volume-target 50000

# Holding
hufi-cli campaign create \
  --type holding --exchange mexc --symbol HMT \
  --start-date 2026-04-01 --end-date 2026-05-01 \
  --fund-token USDT --fund-amount 5000 \
  --daily-balance-target 1000

# Threshold
hufi-cli campaign create \
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
hufi-cli exchange register --name mexc --api-key <key> --secret-key <secret>
hufi-cli exchange register --name bitmart --api-key <key> --secret-key <secret> --bitmart-memo <memo>
hufi-cli exchange list
hufi-cli exchange revalidate mexc
hufi-cli exchange delete mexc
```

`exchange register` expects the CCXT exchange name in `--name` and accepts `--bitmart-memo` for Bitmart accounts that require an extra memo value.

You must run `hufi-cli auth login` before `exchange register`, `exchange list`, `exchange delete`, or `exchange revalidate`.

Exchange text output includes the active profile and address so it is obvious which authenticated wallet is being used.

### staking

| Command | Description |
|---------|-------------|
| `staking status` | Check HMT staking status |
| `staking deposit` | Show deposit address and QR code |
| `staking stake` | Stake HMT tokens |
| `staking unstake` | Initiate unstaking (tokens locked for lock period) |
| `staking withdraw` | Withdraw unlocked tokens after lock period |

```bash
hufi-cli staking deposit                                   # show address QR code
hufi-cli staking status                                    # check your staking
hufi-cli staking status --address 0x...                    # check another address
hufi-cli staking stake 1000                                # stake 1000 HMT
hufi-cli staking unstake 500                               # unstake 500 HMT
hufi-cli staking withdraw                                  # withdraw unlocked tokens
```

Supports Polygon (chain 137) and Ethereum (chain 1). Staking contract: `0x01D1...07F1D` on Polygon.

Profile-scoped staking commands print the active profile and resolved address in text output.

### dashboard

Portfolio overview — staking, active campaigns, and progress in one view.

```bash
hufi-cli dashboard              # full overview
hufi-cli dashboard --json       # machine output
hufi-cli dashboard --export csv # export active campaign rows as CSV
hufi-cli dashboard --export json
```

Dashboard text output includes the active profile.

## Global Options

| Option | Description |
|--------|-------------|
| `--config-file <path>` | Custom config file (default: `~/.hufi-cli/config.json`) |
| `--key-file <path>` | Custom key file (default: `~/.hufi-cli/key.json`) |
| `-p, --profile [name]` | Select a profile, or print available profiles when used without a value |
| `-V, --version` | Show version |
| `-h, --help` | Show help |

Most command actions support `--json` for machine-readable output. Help output remains text, and commands that intentionally show help when required arguments are missing do not emit a JSON error envelope.

## Configuration

Stored at `~/.hufi-cli/config.json`:

```json
{
  "recordingApiUrl": "https://ro.hu.finance",
  "launcherApiUrl": "https://cl.hu.finance",
  "defaultChainId": 137,
  "activeProfile": "default",
  "profiles": {
    "default": {
      "address": "0x...",
      "accessToken": "...",
      "refreshToken": "...",
      "keyFile": "~/.hufi-cli/key.json"
    }
  }
}
```

## Development

```bash
bun install              # install deps
bun run dev -- --help    # run from source
bun run build            # build to dist/cli.js
bun test                 # unit tests
./test-cli.sh            # full CLI integration coverage
bun run test:cli         # integration tests
bun run typecheck        # type check
```

## API Endpoints

| Service | URL |
|---------|-----|
| Recording Oracle | https://ro.hu.finance |
| Campaign Launcher | https://cl.hu.finance |

## License

This project is released under the [DO WHAT THE F*** YOU WANT TO PUBLIC LICENSE v2](http://www.wtfpl.net/about/). Do whatever you want with it.
