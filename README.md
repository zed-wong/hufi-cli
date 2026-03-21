# hufi-cli

CLI tool for the hu.fi DeFi platform.

## Install

```bash
bun install
```

## Usage

```bash
# Show help
bunx hufi-cli --help

# Authenticate
bunx hufi-cli auth login --private-key 0x...

# Generate a new wallet
bunx hufi-cli auth generate

# Check auth status
bunx hufi-cli auth status

# Register exchange API key
bunx hufi-cli exchange register --name mexc --api-key xxx --secret-key yyy

# List exchange API keys
bunx hufi-cli exchange list

# Check campaign join status
bunx hufi-cli campaign status --chain-id 137 --address 0x...

# Join a campaign
bunx hufi-cli campaign join --chain-id 137 --address 0x...

# List joined campaigns
bunx hufi-cli campaign list --limit 20
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
bunx hufi-cli --help

# Run tests
bun test

# Type check
bun run typecheck
```
