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

```bash
hufi campaign list                                          # list active campaigns
hufi campaign list --status completed --chain-id 1          # completed on Ethereum
hufi campaign get --chain-id 137 --address 0x...            # campaign details
hufi campaign join --address 0x...                          # join (chain-id defaults to 137)
hufi campaign status --address 0x...                        # check status
hufi campaign progress --address 0x...                      # your progress
hufi campaign leaderboard --address 0x...                   # leaderboard
```

Running `campaign status/join/progress/leaderboard` without `-a` shows help.

### exchange

| Command | Description |
|---------|-------------|
| `exchange register` | Register a read-only exchange API key |
| `exchange list` | List registered API keys |

```bash
hufi exchange register --name mexc --api-key <key> --secret-key <secret>
hufi exchange list
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
