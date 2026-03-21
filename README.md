# hufi-cli

CLI tool for the hu.fi DeFi platform.

## Install

```bash
bun install
```

## Usage

```bash
# Show help
bun src/cli.ts --help

# Authenticate
bun src/cli.ts auth login --private-key 0x...

# Generate a new wallet
bun src/cli.ts auth generate

# Check auth status
bun src/cli.ts auth status

# Register exchange API key
bun src/cli.ts exchange register --name mexc --api-key xxx --secret-key yyy

# List exchange API keys
bun src/cli.ts exchange list

# Check campaign join status
bun src/cli.ts campaign status --chain-id 137 --address 0x...

# Join a campaign
bun src/cli.ts campaign join --chain-id 137 --address 0x...

# List joined campaigns
bun src/cli.ts campaign list --limit 20
```

## Global Options

- `--json` - Output as JSON (available on all commands)

## Configuration

Configuration is stored at `~/.hufi-cli/config.json`.

## API Endpoints

- Recording Oracle: `https://ro.hu.finance`
- Campaign Launcher: `https://cl.hu.finance`

## Development

```bash
# Run directly
bun src/cli.ts --help

# Run tests
bun test

# Type check
bun run typecheck
```
