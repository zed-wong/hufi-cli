import { Command } from "commander";
import {
  listLauncherCampaigns,
  getLauncherCampaign,
} from "../services/launcher/campaign.ts";
import { listJoinedCampaigns } from "../services/recording/campaign.ts";
import { loadConfig } from "../lib/config.ts";
import { printJson, printText } from "../lib/output.ts";

function requireAuth(): {
  recordingUrl: string;
  launcherUrl: string;
  accessToken: string;
  address: string;
} {
  const config = loadConfig();
  if (!config.accessToken || !config.address) {
    printText("Not authenticated. Run: hufi auth login --private-key <key>");
    process.exit(1);
  }
  return {
    recordingUrl: config.recordingApiUrl.replace(/\/+$/, ""),
    launcherUrl: (config.launcherApiUrl ?? "https://cl.hu.finance").replace(
      /\/+$/,
      ""
    ),
    accessToken: config.accessToken,
    address: config.address,
  };
}

export function createLauncherCommand(): Command {
  const launcher = new Command("launcher").description(
    "Campaign Launcher commands"
  );

  launcher
    .command("list")
    .description("List campaigns from Campaign Launcher")
    .option("-l, --limit <n>", "Max results", Number, 20)
    .option("--json", "Output as JSON")
    .action(async (opts) => {
      const { recordingUrl, launcherUrl, accessToken } = requireAuth();

      try {
        const [launcherResult, joinedResult] = await Promise.all([
          listLauncherCampaigns(launcherUrl, accessToken, opts.limit),
          listJoinedCampaigns(recordingUrl, accessToken, 100).catch(
            () => ({ results: [] })
          ),
        ]);

        const joinedKeys = new Set(
          (joinedResult.results ?? []).map((c) => {
            const r = c as Record<string, unknown>;
            return `${r.chain_id ?? ""}:${r.escrow_address ?? r.address ?? c.id}`;
          })
        );

        if (opts.json) {
          printJson(launcherResult);
        } else {
          const campaigns = launcherResult.results ?? [];
          if (campaigns.length === 0) {
            printText("No campaigns found.");
          } else {
            printText(`Available campaigns (${campaigns.length}):\n`);
            for (const c of campaigns) {
              const key = `${c.chain_id ?? ""}:${c.escrow_address ?? c.id}`;
              const joined = joinedKeys.has(key);
              const tag = joined ? " [JOINED]" : "";
              printText(`  ${c.name ?? c.id}${tag}`);
              if (c.escrow_address)
                printText(`    address: ${c.escrow_address}`);
              printText(
                `    chain: ${c.chain_id ?? "?"}  status: ${c.status ?? "?"}`
              );
              printText("");
            }
          }
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        printText(`Failed to list launcher campaigns: ${message}`);
        process.exitCode = 1;
      }
    });

  launcher
    .command("get <campaignId>")
    .description("Get campaign details by ID")
    .option("--json", "Output as JSON")
    .action(async (campaignId: string, opts) => {
      const { launcherUrl, accessToken } = requireAuth();

      try {
        const campaign = await getLauncherCampaign(
          launcherUrl,
          accessToken,
          campaignId
        );

        if (opts.json) {
          printJson(campaign);
        } else {
          printText(`Name: ${campaign.name ?? "N/A"}`);
          printText(`ID: ${campaign.id}`);
          printText(`Chain: ${campaign.chain_id ?? "N/A"}`);
          if (campaign.escrow_address)
            printText(`Escrow: ${campaign.escrow_address}`);
          if (campaign.status) printText(`Status: ${campaign.status}`);
          if (campaign.start_time) printText(`Start: ${campaign.start_time}`);
          if (campaign.end_time) printText(`End: ${campaign.end_time}`);
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        printText(`Failed to get campaign: ${message}`);
        process.exitCode = 1;
      }
    });

  return launcher;
}
