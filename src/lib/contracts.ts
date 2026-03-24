import { loadConfig } from "./config.ts";

export interface ChainContracts {
  hmt: string;
  staking: string;
  escrowFactory: string;
}

export const HUMAN_PROTOCOL_CONTRACTS: Record<number, ChainContracts> = {
  137: {
    hmt: "0xc748B2A084F8eFc47E086ccdDD9b7e67aEb571BF",
    staking: "0x01D115E9E8bF0C58318793624CC662a030D07F1D",
    escrowFactory: "0x8D50dA7abe354a628a63ADfE23C19a2944612b83",
  },
  1: {
    hmt: "0xd1ba9BAC957322D6e8c07a160a3A8dA11A0d2867",
    staking: "0x86Af9f6Cd34B69Db1B202223C6d6D109f2491569",
    escrowFactory: "0xE24e5C08E28331D24758b69A5E9f383D2bDD1c98",
  },
};

export const RPC_URLS: Record<number, string[]> = {
  137: [
    "https://polygon.drpc.org",
    "https://rpc.ankr.com/polygon",
    "https://polygon-mainnet.public.blastapi.io",
  ],
  1: [
    "https://eth.drpc.org",
    "https://rpc.ankr.com/eth",
    "https://ethereum-rpc.publicnode.com",
  ],
};

export const ORACLES = {
  exchangeOracle: "0x5b74d007ea08217bcde942a2132df43d568a6dca",
  recordingOracle: "0x3a2292c684e289fe5f07737b598fe0027ead5a0e",
  reputationOracle: "0x1519964f5cd2d9ef162b2b1b66f33669cca065c8",
};

export const FUND_TOKENS: Record<number, Record<string, string>> = {
  137: {
    USDT: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
    USDC: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
  },
  1: {
    USDT: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    USDC: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  },
};

export const ESCROW_FACTORY_ABI = [
  "function createFundAndSetupEscrow(address token, uint256 amount, string jobRequesterId, address reputationOracle, address recordingOracle, address exchangeOracle, string manifest, string manifestHash) returns (address)",
  "event LaunchedV2(address indexed escrow, address indexed launcher, string jobRequesterId)",
];

export const ERC20_ABI = [
  "function balanceOf(address) external view returns (uint256)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function decimals() external view returns (uint8)",
];

export function getContracts(chainId: number): ChainContracts {
  const c = HUMAN_PROTOCOL_CONTRACTS[chainId];
  if (!c) {
    throw new Error(
      `Unsupported chain ID: ${chainId}. Supported: ${Object.keys(HUMAN_PROTOCOL_CONTRACTS).join(", ")}`
    );
  }
  return c;
}

export function getRpc(chainId: number): string {
  const override = process.env[`HUFI_RPC_${chainId}`];
  if (override) {
    return override;
  }

  const configOverride = loadConfig().rpcUrls?.[String(chainId)];
  if (configOverride) {
    return configOverride;
  }

  const rpcs = RPC_URLS[chainId];
  if (!rpcs) {
    throw new Error(`No RPC URLs for chain ${chainId}`);
  }
  return rpcs[0] as string;
}

export function getFundTokenAddress(chainId: number, symbol: string): string {
  const tokens = FUND_TOKENS[chainId];
  if (!tokens) {
    throw new Error(`No fund tokens for chain ${chainId}`);
  }
  const addr = tokens[symbol.toUpperCase()];
  if (!addr) {
    throw new Error(`Unknown fund token: ${symbol}. Supported: ${Object.keys(tokens).join(", ")}`);
  }
  return addr;
}
