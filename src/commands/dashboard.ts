import { Command } from "commander";
import { getStakingInfo } from "../services/staking.ts";
import { listJoinedCampaigns, getMyProgress } from "../services/recording/campaign.ts";
import { loadConfig, getDefaultChainId } from "../lib/config.ts";
import { printJson, printText } from "../lib/output.ts";

function requireAuth(): { baseUrl: string; accessToken: string; address: string } {
  const config = loadConfig();
  if (!config.accessToken || !config.address) {
    printText("Not authenticated. Run: hufi auth login --private-key <key>");
    process.exit(1);
  }
  return {
    baseUrl: config.recordingApiUrl.replace(/\/+$/, ""),
    accessToken: config.accessToken,
    address: config.address,
  };
}

export function createDashboardCommand(): Command {
  const dashboard = new Command("dashboard")
    .description("Portfolio overview — staking, campaigns, and earnings")
    .option("-c, --chain-id <id>", "Chain ID (default: from config)", Number, getDefaultChainId())
    .option("--json", "Output as JSON")
    .action(async (opts) => {
      const { baseUrl, accessToken, address } = requireAuth();

      try {
        const [stakingInfo, campaignsResult] = await Promise.all([
          getStakingInfo(address, opts.chainId).catch(() => null),
          listJoinedCampaigns(baseUrl, accessToken, 50).catch(() => null),
        ]);

        const campaigns = campaignsResult?.results ?? [];

        const activeCampaigns = campaigns.filter((c) => {
          const r = c as Record<string, unknown>;
          return r.status === "active" || r.status === "ACTIVE";
        });

        const progressPromises = activeCampaigns.map(async (c) => {
          const r = c as Record<string, unknown>;
          const chainId = (r.chain_id as number) ?? opts.chainId;
          const campaignAddress = (r.address as string) ?? (r.escrow_address as string) ?? "";
          if (!campaignAddress) return { campaign: c, progress: null };
          try {
            const progress = await getMyProgress(baseUrl, accessToken, chainId, campaignAddress);
            return { campaign: c, progress };
          } catch {
            return { campaign: c, progress: null };
          }
        });

        const progressResults = await Promise.all(progressPromises);

        if (opts.json) {
          printJson({
            address,
            chainId: opts.chainId,
            staking: stakingInfo,
            activeCampaigns: progressResults,
          });
          return;
        }

        printText(`Wallet: ${address}  Chain: ${opts.chainId}\n`);

        if (stakingInfo) {
          printText("Staking");
          printText(`  Staked:     ${Number(stakingInfo.stakedTokens).toLocaleString()} HMT`);
          printText(`  Available:  ${Number(stakingInfo.availableStake).toLocaleString()} HMT`);
          printText(`  Balance:    ${Number(stakingInfo.hmtBalance).toLocaleString()} HMT`);
          printText("");
        }

        if (activeCampaigns.length === 0) {
          printText("No active campaigns.");
        } else {
          printText(`Active Campaigns (${activeCampaigns.length})`);
          for (const { campaign, progress } of progressResults) {
            const r = campaign as Record<string, unknown>;
            const exchange = r.exchange_name ?? "?";
            const symbol = r.symbol ?? "?";
            const type = r.type ?? "?";
            const score = progress && typeof progress === "object" && "my_score" in progress
              ? `  score: ${(progress as Record<string, unknown>).my_score}`
              : "";
            printText(`  ${exchange} ${symbol} (${type})${score}`);
          }
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        printText(`Failed to load dashboard: ${message}`);
        process.exitCode = 1;
      }
    });

  return dashboard;
}
