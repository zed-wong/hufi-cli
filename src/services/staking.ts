import { Contract, JsonRpcProvider, Wallet, formatUnits, parseUnits } from "ethers";
import type { StakingInfo } from "../types/staking.ts";
import { getContracts, getRpc, ERC20_ABI } from "../lib/contracts.ts";

const STAKING_ABI = [
  "function getAvailableStake(address _staker) external view returns (uint256)",
  "function getStakedTokens(address _staker) external view returns (uint256)",
  "function minimumStake() external view returns (uint256)",
  "function lockPeriod() external view returns (uint32)",
  "function stake(uint256 _tokens) external",
  "function unstake(uint256 _tokens) external",
  "function withdraw() external",
];

function getProvider(chainId: number): JsonRpcProvider {
  return new JsonRpcProvider(getRpc(chainId), chainId, { staticNetwork: true, batchMaxCount: 1 });
}

export async function getStakingInfo(
  address: string,
  chainId: number
): Promise<StakingInfo> {
  const contracts = getContracts(chainId);
  const provider = getProvider(chainId);
  const stakingContract = new Contract(contracts.staking, STAKING_ABI, provider);
  const hmtContract = new Contract(contracts.hmt, ERC20_ABI, provider);

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
  const contracts = getContracts(chainId);
  const provider = getProvider(chainId);
  const wallet = new Wallet(privateKey, provider);
  const stakingContract = new Contract(contracts.staking, STAKING_ABI, wallet);
  const hmtContract = new Contract(contracts.hmt, ERC20_ABI, wallet);

  const amountWei = parseUnits(amount, 18);

  const allowance = await hmtContract.getFunction("allowance")(wallet.address, contracts.staking) as bigint;
  if (allowance < amountWei) {
    const approveTx = await hmtContract.getFunction("approve")(contracts.staking, amountWei);
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
  const contracts = getContracts(chainId);
  const provider = getProvider(chainId);
  const wallet = new Wallet(privateKey, provider);
  const stakingContract = new Contract(contracts.staking, STAKING_ABI, wallet);

  const amountWei = parseUnits(amount, 18);
  const tx = await stakingContract.getFunction("unstake")(amountWei);
  const receipt = await tx.wait();
  return receipt.hash;
}

export async function withdrawHMT(
  privateKey: string,
  chainId: number
): Promise<string> {
  const contracts = getContracts(chainId);
  const provider = getProvider(chainId);
  const wallet = new Wallet(privateKey, provider);
  const stakingContract = new Contract(contracts.staking, STAKING_ABI, wallet);

  const tx = await stakingContract.getFunction("withdraw")();
  const receipt = await tx.wait();
  return receipt.hash;
}
