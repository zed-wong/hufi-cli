#!/usr/bin/env node

function printHelp() {
  console.log(`
Usage:
  yarn join:campaign-api [options]

Auth options:
  --recording-api-url <url>      Recording Oracle API base URL
  --private-key <hex>            Existing EVM private key used to sign in
  --generate-wallet              Generate a fresh EVM wallet with ethers.js
  --show-private-key             Print generated private key to stdout
  --json                         Print structured JSON result to stdout

Register read-only API key:
  --exchange-name <name>         Exchange name, e.g. binance
  --exchange-api-key <key>       Read-only API key
  --exchange-secret-key <key>    Read-only API secret
  --bitmart-memo <memo>          Optional Bitmart memo

Campaign actions:
  --chain-id <id>                Campaign chain id
  --campaign-address <address>   Campaign escrow address
  --list-joined-campaigns        Fetch joined campaigns after auth

Behavior:
  - Auth always happens first
  - If --generate-wallet is used, the script creates a fresh wallet locally
  - If exchange args are provided, the script first registers the API key.
  - If campaign args are provided, the script checks join status and joins when needed.
  - If --list-joined-campaigns is set, the script fetches joined campaigns.
  - You can use auth only, registration only, join only, or combine them in one run.

Examples:
  yarn join:campaign-api \\
    --recording-api-url http://localhost:5101 \\
    --private-key 0xabc... \\
    --exchange-name binance \\
    --exchange-api-key myKey \\
    --exchange-secret-key mySecret

  yarn join:campaign-api \\
    --recording-api-url http://localhost:5101 \\
    --private-key 0xabc... \\
    --chain-id 137 \\
    --campaign-address 0x1234...

  yarn join:campaign-api \\
    --recording-api-url http://localhost:5101 \\
    --private-key 0xabc... \\
    --exchange-name binance \\
    --exchange-api-key myKey \\
    --exchange-secret-key mySecret \\
    --chain-id 137 \\
    --campaign-address 0x1234...

  yarn join:campaign-api \\
    --recording-api-url https://ro.hu.finance \\
    --generate-wallet \\
    --show-private-key \\
    --chain-id 137 \\
    --campaign-address 0x1234... \\
    --list-joined-campaigns \\
    --json

Environment variable fallbacks:
  RECORDING_API_URL
  EVM_PRIVATE_KEY
  EXCHANGE_NAME
  EXCHANGE_API_KEY
  EXCHANGE_SECRET_KEY
  BITMART_MEMO
  CAMPAIGN_CHAIN_ID
  CAMPAIGN_ADDRESS
`);
}

function parseArgs(argv) {
  const args = {};

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];

    if (!token.startsWith('--')) {
      throw new Error(`Unexpected argument: ${token}`);
    }

    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      args[key] = true;
      continue;
    }

    args[key] = next;
    i += 1;
  }

  return args;
}

function getConfig(cliArgs) {
  return {
    recordingApiUrl:
      cliArgs['recording-api-url'] || process.env.RECORDING_API_URL,
    privateKey: cliArgs['private-key'] || process.env.EVM_PRIVATE_KEY,
    generateWallet: Boolean(cliArgs['generate-wallet']),
    showPrivateKey: Boolean(cliArgs['show-private-key']),
    json: Boolean(cliArgs.json),
    listJoinedCampaigns: Boolean(cliArgs['list-joined-campaigns']),
    exchangeName: cliArgs['exchange-name'] || process.env.EXCHANGE_NAME,
    exchangeApiKey: cliArgs['exchange-api-key'] || process.env.EXCHANGE_API_KEY,
    exchangeSecretKey:
      cliArgs['exchange-secret-key'] || process.env.EXCHANGE_SECRET_KEY,
    bitmartMemo: cliArgs['bitmart-memo'] || process.env.BITMART_MEMO,
    chainId: cliArgs['chain-id'] || process.env.CAMPAIGN_CHAIN_ID,
    campaignAddress:
      cliArgs['campaign-address'] || process.env.CAMPAIGN_ADDRESS,
  };
}

function normalizeBaseUrl(url) {
  return url.replace(/\/+$/, '');
}

function maskSecret(value) {
  if (!value) {
    return value;
  }

  if (value.length <= 8) {
    return '*'.repeat(value.length);
  }

  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  const contentType = response.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');
  const payload = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    let message = `HTTP ${response.status}`;

    if (payload && typeof payload === 'object' && payload.message) {
      message = payload.message;
    } else if (typeof payload === 'string' && payload) {
      message = payload;
    }

    const error = new Error(message);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return payload;
}

function loadEthers() {
  try {
    return require('ethers');
  } catch (_error) {
    throw new Error(
      'Missing dependency "ethers". Run yarn in /recording-oracle before using this script.'
    );
  }
}

function createWallet() {
  const { Wallet } = loadEthers();
  return Wallet.createRandom();
}

async function authenticate(baseUrl, privateKey) {
  const { Wallet } = loadEthers();

  const wallet = new Wallet(privateKey);
  const address = wallet.address;

  const noncePayload = await requestJson(`${baseUrl}/auth/nonce`, {
    method: 'POST',
    body: JSON.stringify({ address }),
  });

  const signableMessage =
    noncePayload && typeof noncePayload === 'object' && 'nonce' in noncePayload
      ? JSON.stringify(noncePayload)
      : JSON.stringify(noncePayload);

  const signature = await wallet.signMessage(signableMessage);

  const authPayload = await requestJson(`${baseUrl}/auth`, {
    method: 'POST',
    body: JSON.stringify({
      address,
      signature,
    }),
  });

  const accessToken =
    authPayload && typeof authPayload === 'object'
      ? authPayload.access_token || authPayload.accessToken
      : undefined;

  if (!accessToken) {
    throw new Error('Auth succeeded but access token is missing in response');
  }

  return {
    address,
    noncePayload,
    signature,
    accessToken,
    refreshToken:
      authPayload.refresh_token ||
      authPayload.refreshToken ||
      undefined,
  };
}

async function registerReadOnlyApiKey(baseUrl, accessToken, config) {
  const extras =
    config.exchangeName === 'bitmart' && config.bitmartMemo
      ? { api_key_memo: config.bitmartMemo }
      : undefined;

  const payload = {
    exchange_name: config.exchangeName,
    api_key: config.exchangeApiKey,
    secret_key: config.exchangeSecretKey,
  };

  if (extras) {
    payload.extras = extras;
  }

  return requestJson(`${baseUrl}/exchange-api-keys`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  });
}

async function checkJoinStatus(baseUrl, accessToken, chainId, address) {
  return requestJson(`${baseUrl}/campaigns/check-join-status`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      chain_id: Number(chainId),
      address,
    }),
  });
}

async function joinCampaign(baseUrl, accessToken, chainId, address) {
  return requestJson(`${baseUrl}/campaigns/join`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      chain_id: Number(chainId),
      address,
    }),
  });
}

async function listJoinedCampaigns(baseUrl, accessToken, limit = 20) {
  return requestJson(`${baseUrl}/campaigns?limit=${Number(limit)}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

function validateConfig(config) {
  if (!config.recordingApiUrl) {
    throw new Error('Missing --recording-api-url');
  }

  if (!config.privateKey && !config.generateWallet) {
    throw new Error('Missing --private-key or --generate-wallet');
  }

  const wantsRegister =
    config.exchangeName ||
    config.exchangeApiKey ||
    config.exchangeSecretKey ||
    config.bitmartMemo;

  const wantsJoin = config.chainId || config.campaignAddress;

  if (
    wantsRegister &&
    (!config.exchangeName || !config.exchangeApiKey || !config.exchangeSecretKey)
  ) {
    throw new Error(
      'Registering API key requires --exchange-name, --exchange-api-key, and --exchange-secret-key'
    );
  }

  if (wantsJoin && (!config.chainId || !config.campaignAddress)) {
    throw new Error(
      'Joining campaign requires --chain-id and --campaign-address'
    );
  }
}

async function main() {
  const cliArgs = parseArgs(process.argv.slice(2));

  if (cliArgs.help) {
    printHelp();
    return;
  }

  const config = getConfig(cliArgs);
  validateConfig(config);

  const baseUrl = normalizeBaseUrl(config.recordingApiUrl);
  const result = {
    recordingApiUrl: baseUrl,
  };

  if (config.generateWallet) {
    const wallet = createWallet();
    config.privateKey = wallet.privateKey;
    result.wallet = {
      address: wallet.address,
      privateKey: wallet.privateKey,
    };

    console.log(`Generated new wallet: ${wallet.address}`);
    if (config.showPrivateKey) {
      console.log(`Private key: ${wallet.privateKey}`);
    }
  }

  console.log(`Authenticating against ${baseUrl}`);
  const auth = await authenticate(baseUrl, config.privateKey);
  console.log(`Authenticated as ${auth.address}`);
  result.auth = {
    address: auth.address,
    noncePayload: auth.noncePayload,
    signature: auth.signature,
    accessToken: auth.accessToken,
    refreshToken: auth.refreshToken,
  };

  if (config.exchangeName) {
    console.log(
      `Registering read-only API key for ${config.exchangeName} using key ${maskSecret(config.exchangeApiKey)}`
    );

    const registration = await registerReadOnlyApiKey(
      baseUrl,
      auth.accessToken,
      config
    );
    console.log('API key registered');
    result.exchangeApiKeyRegistration = registration;
    if (registration && registration.id) {
      console.log(`exchange_api_key_id=${registration.id}`);
    }
  }

  if (config.chainId && config.campaignAddress) {
    console.log(
      `Checking join status for chain ${config.chainId}, campaign ${config.campaignAddress}`
    );
    const joinStatus = await checkJoinStatus(
      baseUrl,
      auth.accessToken,
      config.chainId,
      config.campaignAddress
    );
    result.joinStatus = joinStatus;
    console.log(`join_status=${joinStatus.status}`);
    if (joinStatus.joined_at) {
      console.log(`joined_at=${joinStatus.joined_at}`);
    }
    if (joinStatus.reason) {
      console.log(`join_status_reason=${joinStatus.reason}`);
    }

    if (joinStatus.status === 'already_joined') {
      console.log('Campaign already joined, skipping join request');
      return;
    }

    console.log('Joining campaign');
    const joinResult = await joinCampaign(
      baseUrl,
      auth.accessToken,
      config.chainId,
      config.campaignAddress
    );
    result.joinResult = joinResult;
    console.log('Campaign joined');
    if (joinResult && joinResult.id) {
      console.log(`campaign_id=${joinResult.id}`);
    }
  }

  if (config.listJoinedCampaigns) {
    console.log('Fetching joined campaigns');
    const joinedCampaigns = await listJoinedCampaigns(baseUrl, auth.accessToken);
    result.joinedCampaigns = joinedCampaigns;
    console.log(
      `joined_campaigns_count=${Array.isArray(joinedCampaigns.results) ? joinedCampaigns.results.length : 0}`
    );
  }

  if (config.json) {
    console.log(JSON.stringify(result, null, 2));
  }
}

main().catch((error) => {
  console.error('Script failed');
  console.error(error.message || error);

  if (error.payload) {
    console.error(JSON.stringify(error.payload, null, 2));
  }

  process.exitCode = 1;
});
