import { Contract, JsonRpcProvider, Wallet, formatUnits, parseUnits } from "ethers";
import type { StakingInfo } from "../types/staking.ts";

const STAKING_CONTRACTS: Record<number, { staking: string; hmt: string; rpcs: string[] }> = {
  137: {
    staking: "0x01D115E9E8bF0C58318793624CC662a030D07F1D",
    hmt: "0xc748B2A084F8eFc47E086ccdDD9b7e67aEb571BF",
    rpcs: [
      "https://polygon.drpc.org",
      "https://rpc.ankr.com/polygon",
      "https://polygon-mainnet.public.blastapi.io",
    ],
  },
  1: {
    staking: "0x86Af9f6Cd34B69Db1B202223C6d6D109f2491569",
    hmt: "0xd1ba9BAC957322D6e8c07a160a3A8dA11A0d2867",
    rpcs: [
      "https://eth.drpc.org",
      "https://rpc.ankr.com/eth",
      "https://ethereum-rpc.publicnode.com",
    ],
  },
};

const STAKING_ABI = [
  "function getAvailableStake(address _staker) external view returns (uint256)",
  "function getStakedTokens(address _staker) external view returns (uint256)",
  "function minimumStake() external view returns (uint256)",
  "function lockPeriod() external view returns (uint32)",
  "function stake(uint256 _tokens) external",
  "function unstake(uint256 _tokens) external",
  "function withdraw() external",
];

const ERC20_ABI = [
  "function balanceOf(address) external view returns (uint256)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function decimals() external view returns (uint8)",
];

function getProvider(chainId: number): JsonRpcProvider {
  const config = getConfig(chainId);
  return new JsonRpcProvider(config.rpcs[0], chainId, { staticNetwork: true, batchMaxCount: 1 });
}

function getConfig(chainId: number) {
  const config = STAKING_CONTRACTS[chainId];
  if (!config) {
    throw new Error(`Unsupported chain ID: ${chainId}. Supported: ${Object.keys(STAKING_CONTRACTS).join(", ")}`);
  }
  return config;
}

export async function getStakingInfo(
  address: string,
  chainId: number
): Promise<StakingInfo> {
  const config = getConfig(chainId);
  const provider = getProvider(chainId);
  const stakingContract = new Contract(config.staking, STAKING_ABI, provider);
  const hmtContract = new Contract(config.hmt, ERC20_ABI, provider);

  const [stakedTokens, availableStake, minimumStake, lockPeriod, hmtBalance] = await Promise.all([
    stakingContract.getFunction("getStakedTokens")(address) as Promise<bigint>,
    stakingContract.getFunction("getAvailableStake")(address) as Promise<bigint>,
    stakingContract.getFunction("minimumStake")() as Promise<bigint>,
    stakingContract.getFunction("lockPeriod")() as Promise<number>,
    hmtContract.getFunction("balanceOf")(address) as Promise<bigint>,
  ]);

  const lockedTokens = stakedTokens > availableStake ? stakedTokens - availableStake : 0n;

  return {
    stakedTokens: formatUnits(stakedTokens, 18),
    availableStake: formatUnits(availableStake, 18),
    lockedTokens: formatUnits(lockedTokens, 18),
    unlockBlock: 0,
    minimumStake: formatUnits(minimumStake, 18),
    lockPeriod: Number(lockPeriod),
    hmtBalance: formatUnits(hmtBalance, 18),
    chainId,
  };
}

export async function stakeHMT(
  privateKey: string,
  amount: string,
  chainId: number
): Promise<string> {
  const config = getConfig(chainId);
  const provider = getProvider(chainId);
  const wallet = new Wallet(privateKey, provider);
  const stakingContract = new Contract(config.staking, STAKING_ABI, wallet);
  const hmtContract = new Contract(config.hmt, ERC20_ABI, wallet);

  const amountWei = parseUnits(amount, 18);

  const allowance = await hmtContract.getFunction("allowance")(wallet.address, config.staking) as bigint;
  if (allowance < amountWei) {
    const approveTx = await hmtContract.getFunction("approve")(config.staking, amountWei);
    await approveTx.wait();
  }

  const tx = await stakingContract.getFunction("stake")(amountWei);
  const receipt = await tx.wait();
  return receipt.hash;
}

export async function unstakeHMT(
  privateKey: string,
  amount: string,
  chainId: number
): Promise<string> {
  const config = getConfig(chainId);
  const provider = getProvider(chainId);
  const wallet = new Wallet(privateKey, provider);
  const stakingContract = new Contract(config.staking, STAKING_ABI, wallet);

  const amountWei = parseUnits(amount, 18);
  const tx = await stakingContract.getFunction("unstake")(amountWei);
  const receipt = await tx.wait();
  return receipt.hash;
}

export async function withdrawHMT(
  privateKey: string,
  chainId: number
): Promise<string> {
  const config = getConfig(chainId);
  const provider = getProvider(chainId);
  const wallet = new Wallet(privateKey, provider);
  const stakingContract = new Contract(config.staking, STAKING_ABI, wallet);

  const tx = await stakingContract.getFunction("withdraw")();
  const receipt = await tx.wait();
  return receipt.hash;
}
