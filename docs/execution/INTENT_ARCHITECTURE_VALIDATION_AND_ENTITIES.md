# Intent Architecture, Validation, and Entities

This is the living technical document for how `hufi` turns CLI input into validated runtime actions.

## Scope

The current CLI is organized around five top-level command groups:

- `auth`
- `exchange`
- `campaign`
- `staking`
- `dashboard`

The entrypoint wires those groups in `src/cli.ts`.

## Runtime flow

Every invocation follows the same high-level path:

1. Parse flags and subcommands with Commander.
2. Apply global overrides for `--config-file`, `--key-file`, and `-p/--profile`.
3. Load config defaults from `src/lib/config.ts`.
4. Validate config shape before running the selected command.
5. Execute the command handler.
6. Print text or JSON output.

## Core entities

### Config

Defined in `src/types/config.ts` and loaded by `src/lib/config.ts`.

Key fields:

- `recordingApiUrl`
- `launcherApiUrl`
- `defaultChainId`
- `activeProfile`
- `profiles`

Stored by default in `~/.hufi-cli/config.json`.

Each profile can hold:

- `address`
- `accessToken`
- `refreshToken`
- `keyFile`

### Key material

Wallet material is generated or loaded through `auth` commands and stored by default in:

- `~/.hufi-cli/key.json` for the default profile
- `~/.hufi-cli/key.<profile>.json` for named profiles

This file contains:

- wallet address
- private key

## Service boundaries

### Recording service

Files under `src/services/recording/` talk to the Recording Oracle for:

- authentication
- joined campaigns
- campaign progress and leaderboard data
- exchange API key registration and validation

### Launcher service

Files under `src/services/launcher/` fetch public campaign catalog and campaign detail data from the campaign launcher API.

### On-chain staking and campaign creation

- `src/services/staking.ts` handles staking reads and transactions.
- `src/services/campaign-create.ts` handles preflight checks, gas estimates, approvals, and escrow creation.
- `src/lib/contracts.ts` and `src/lib/blockchain.ts` hold chain-specific contract and provider utilities.

## Validation layers

### Global config validation

`src/lib/config.ts` validates:

- API URLs are valid `http` or `https` URLs
- `defaultChainId` is a positive integer
- configured wallet addresses match EVM address format

If validation fails, the CLI exits before running a subcommand.

### Auth requirements

`src/lib/require-auth.ts` centralizes checks for commands that need:

- an authenticated access token
- a configured address

These checks are now profile-aware and resolve identity from the selected profile or active profile.

### Campaign command validation

`campaign create` applies the richest runtime validation in the repo:

- command-specific required fields by campaign type
- start and end date parsing
- duration bounds of at least 6 hours and at most 100 days
- minimum HMT stake checks when staking data is available
- fund token balance checks
- gas estimation for approval and creation transactions

### Watch and export helpers

- `src/lib/watch.ts` drives repeated polling for `campaign progress --watch`.
- `src/lib/export.ts` formats dashboard export rows for CSV output.

## Output model

The CLI uses `src/lib/output.ts` to keep text and JSON output consistent.

- Human output is concise and task-oriented.
- Profile-scoped text output surfaces the active profile, and often the resolved wallet address, to make account context explicit.
- JSON output is intended for scripting and automation.
- Some help-first flows still print Commander help instead of a JSON error object.

## Test coverage expectations

`test-cli.sh` is the main integration safety net. It currently covers:

- auth generation and login flows
- profile listing and local key discovery
- campaign listing, detail, progress, leaderboard, and create validation
- exchange list and help surfaces
- exchange auth guidance for missing or invalid login state
- positional-first command help for exchange delete/revalidate
- positional-first command help for staking stake/unstake
- staking reads and deposit output
- dashboard text, JSON, and export behavior
- top-level and subcommand help output

## Known gaps

- This document describes the current command runtime, not a separate intent engine.
- There is no standalone domain entity layer yet; most entities are shaped directly from service responses plus `src/types/*.ts` definitions.
- Exchange API keys are still one-per-user-per-exchange in the backend, so the CLI treats the CCXT exchange name as the single identifier for enrollment and listing.
- If new command groups, config fields, or validation paths are added, this document should be updated in the same change.
