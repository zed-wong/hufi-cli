# Recording Oracle API Automation

This document covers the reusable scripts in [`recording-oracle/scripts`](/home/whoami/dev/hufi/recording-oracle/scripts) for:

- authenticating with Recording Oracle using an EVM key
- generating a fresh wallet for testing
- registering a read-only exchange API key
- joining a campaign
- verifying joined campaigns

## Scripts

### `join-campaign-api.js`

Primary reusable script.

Capabilities:

- authenticate with an existing EVM private key
- generate a fresh wallet with `ethers.js`
- register a read-only exchange API key
- check campaign join status
- join a campaign if not already joined
- list joined campaigns
- print a JSON result payload

Run:

```sh
cd /home/whoami/dev/hufi/recording-oracle
corepack yarn join:campaign-api --help
```

### `test-join-campaign-ethers.js`

Thin wrapper over `join-campaign-api.js`.

It always:

- generates a fresh wallet
- prints the private key
- prints JSON output

Run:

```sh
cd /home/whoami/dev/hufi/recording-oracle
corepack yarn test:join-campaign-ethers --help
```

## Prerequisites

Install dependencies first:

```sh
cd /home/whoami/dev/hufi/recording-oracle
corepack yarn
```

Production endpoints used in this repo:

- Recording Oracle Swagger: `https://ro.hu.finance/swagger`
- Campaign Launcher Swagger: `https://cl.hu.finance/swagger`

## Common flows

### 1. Authenticate only with an existing wallet

```sh
corepack yarn join:campaign-api \
  --recording-api-url https://ro.hu.finance \
  --private-key 0xYOUR_PRIVATE_KEY
```

### 2. Generate a fresh wallet and test auth

```sh
corepack yarn join:campaign-api \
  --recording-api-url https://ro.hu.finance \
  --generate-wallet \
  --show-private-key \
  --json
```

### 3. Register a read-only exchange API key

```sh
corepack yarn join:campaign-api \
  --recording-api-url https://ro.hu.finance \
  --private-key 0xYOUR_PRIVATE_KEY \
  --exchange-name mexc \
  --exchange-api-key "$MEXC_API_KEY" \
  --exchange-secret-key "$MEXC_SECRET_KEY"
```

### 4. Join a campaign

```sh
corepack yarn join:campaign-api \
  --recording-api-url https://ro.hu.finance \
  --private-key 0xYOUR_PRIVATE_KEY \
  --chain-id 137 \
  --campaign-address 0xCAMPAIGN_ADDRESS
```

### 5. Register API key and join in one run

```sh
corepack yarn join:campaign-api \
  --recording-api-url https://ro.hu.finance \
  --private-key 0xYOUR_PRIVATE_KEY \
  --exchange-name mexc \
  --exchange-api-key "$MEXC_API_KEY" \
  --exchange-secret-key "$MEXC_SECRET_KEY" \
  --chain-id 137 \
  --campaign-address 0xCAMPAIGN_ADDRESS
```

### 6. Join and then list joined campaigns

```sh
corepack yarn join:campaign-api \
  --recording-api-url https://ro.hu.finance \
  --private-key 0xYOUR_PRIVATE_KEY \
  --chain-id 137 \
  --campaign-address 0xCAMPAIGN_ADDRESS \
  --list-joined-campaigns \
  --json
```

## Environment variable fallbacks

`join-campaign-api.js` also reads:

```sh
export RECORDING_API_URL=https://ro.hu.finance
export EVM_PRIVATE_KEY=0xYOUR_PRIVATE_KEY
export EXCHANGE_NAME=mexc
export EXCHANGE_API_KEY='...'
export EXCHANGE_SECRET_KEY='...'
export BITMART_MEMO='...'
export CAMPAIGN_CHAIN_ID=137
export CAMPAIGN_ADDRESS=0xCAMPAIGN_ADDRESS
```

Then run:

```sh
corepack yarn join:campaign-api --list-joined-campaigns --json
```

## What `join campaign` means in this codebase

For the current Recording Oracle implementation, joining a campaign is not an on-chain transaction.

It is a protected backend action that:

1. authenticates the wallet owner via `POST /auth/nonce` and `POST /auth`
2. validates campaign state
3. validates exchange API access when required
4. inserts a participation row into the Recording Oracle database

Relevant code:

- [`campaigns.service.ts`](/home/whoami/dev/hufi/recording-oracle/src/modules/campaigns/campaigns.service.ts#L151)
- [`participations.service.ts`](/home/whoami/dev/hufi/recording-oracle/src/modules/campaigns/participations/participations.service.ts#L14)
- [`participation.entity.ts`](/home/whoami/dev/hufi/recording-oracle/src/modules/campaigns/participations/participation.entity.ts#L15)

Implications:

- no gas cost for `join`
- no wallet transaction popup beyond the auth signature
- DEX campaigns can be joined without exchange API keys
- CEX campaigns require registering a read-only API key first

## Real production test run

The following production test run was executed against `https://ro.hu.finance` and `https://cl.hu.finance`.

Test wallet:

- address: `0x3643d09E318bA9D7BFE957B41571D913C9f9848B`
- private key: `0xa4bf755d98607d4db6adc11fa62df868d81a34e1398cf81f4b1c6c090f5715f8`

Successful joins:

1. PancakeSwap DEX campaign
   - chain id: `137`
   - address: `0x228f8be6f8447331536662adf9447df3dad5cd20`
   - initial `join_status`: `can_join`
   - returned campaign id: `8ea598cf-b627-4274-b605-3696e1e1c1e1`
   - final `join_status`: `already_joined`
   - `joined_at`: `2026-03-21T09:10:23.354Z`

2. MEXC CEX campaign
   - chain id: `137`
   - address: `0x8ec517d124a7ff4510d5888a0d9cafb380845148`
   - initial join attempt before API key registration failed with:
     - `Exchange API key not found`
   - registered MEXC API key id:
     - `d3a2754d-2c21-440b-9c5a-892be4400648`
   - returned campaign id after registration:
     - `b39a7eaa-6678-4cd0-9dda-3e2f0558c321`
   - final `join_status`: `already_joined`
   - `joined_at`: `2026-03-21T09:30:25.347Z`

Final joined campaigns list for the test wallet contained both campaigns:

- `mexc` / `XIN/USDT`
- `pancakeswap` / `HMT/USDT`

## Notes

- The scripts only use the Recording Oracle API. Campaign discovery still needs Campaign Launcher data when you need a fresh campaign address.
- For CEX exchanges, the backend validates API permissions before storing the key.
- Deleting an exchange API key can remove the user from active campaigns for that exchange.
