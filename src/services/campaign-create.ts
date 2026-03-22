import { Contract, JsonRpcProvider, Wallet, parseUnits } from "ethers";
import { createHash } from "node:crypto";
import type { CampaignCreateParams, CampaignCreateResult } from "../types/campaign-create.ts";
import {
  getContracts,
  getRpc,
  getFundTokenAddress,
  ORACLES,
  ESCROW_FACTORY_ABI,
  ERC20_ABI,
} from "../lib/contracts.ts";

function getProvider(chainId: number): JsonRpcProvider {
  return new JsonRpcProvider(getRpc(chainId), chainId, { staticNetwork: true, batchMaxCount: 1 });
}

function buildManifest(params: CampaignCreateParams): string {
  const base = {
    exchange: params.exchange,
    start_date: params.startDate,
    end_date: params.endDate,
  };

  switch (params.type) {
    case "MARKET_MAKING":
      return JSON.stringify({
        ...base,
        type: params.type,
        pair: params.pair,
        daily_volume_target: params.dailyVolumeTarget,
      });
    case "HOLDING":
      return JSON.stringify({
        ...base,
        type: params.type,
        symbol: params.symbol,
        daily_balance_target: params.dailyBalanceTarget,
      });
    case "THRESHOLD":
      return JSON.stringify({
        ...base,
        type: params.type,
        symbol: params.symbol,
        minimum_balance_target: params.minimumBalanceTarget,
      });
    default:
      throw new Error(`Unknown campaign type: ${(params as CampaignCreateParams).type}`);
  }
}

function hashManifest(manifest: string): string {
  return createHash("sha1").update(manifest).digest("hex");
}

export async function createCampaign(
  privateKey: string,
  chainId: number,
  params: CampaignCreateParams
): Promise<CampaignCreateResult> {
  const contracts = getContracts(chainId);
  const provider = getProvider(chainId);
  const wallet = new Wallet(privateKey, provider);

  const tokenAddress = getFundTokenAddress(chainId, params.fundToken);
  const hmtContract = new Contract(tokenAddress, ERC20_ABI, wallet);
  const decimals = await hmtContract.getFunction("decimals")() as number;
  const fundAmountWei = parseUnits(params.fundAmount, decimals);

  const allowance = await hmtContract.getFunction("allowance")(wallet.address, contracts.escrowFactory) as bigint;
  if (allowance < fundAmountWei) {
    const approveTx = await hmtContract.getFunction("approve")(contracts.escrowFactory, fundAmountWei);
    await approveTx.wait();
  }

  const manifest = buildManifest(params);
  const manifestHash = hashManifest(manifest);

  const factory = new Contract(contracts.escrowFactory, ESCROW_FACTORY_ABI, wallet);

  const tx = await factory.getFunction("createFundAndSetupEscrow")(
    tokenAddress,
    fundAmountWei,
    "hufi-campaign-launcher",
    ORACLES.reputationOracle,
    ORACLES.recordingOracle,
    ORACLES.exchangeOracle,
    manifest,
    manifestHash
  );

  const receipt = await tx.wait();

  const iface = factory.interface;
  let escrowAddress = "";
  for (const log of receipt.logs) {
    try {
      const parsed = iface.parseLog({ topics: log.topics as string[], data: log.data });
      if (parsed?.name === "LaunchedV2") {
        escrowAddress = parsed.args.escrow;
        break;
      }
    } catch {
      // not our event
    }
  }

  return {
    escrowAddress: escrowAddress || "unknown",
    txHash: receipt.hash,
  };
}
