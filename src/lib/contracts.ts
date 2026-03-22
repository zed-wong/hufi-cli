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
  const rpcs = RPC_URLS[chainId];
  if (!rpcs) {
    throw new Error(`No RPC URLs for chain ${chainId}`);
  }
  return rpcs[0] as string;
}
