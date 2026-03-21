import { Command } from "commander";
import {
  listLauncherCampaigns,
  getLauncherCampaign,
} from "../services/launcher/campaign.ts";
import { loadConfig } from "../lib/config.ts";
import { printJson, printText } from "../lib/output.ts";

function requireAuth(): { baseUrl: string; accessToken: string } {
  const config = loadConfig();
  if (!config.accessToken) {
    printText("Not authenticated. Run: hufi auth login --private-key <key>");
    process.exit(1);
  }
  return {
    baseUrl: (config.launcherApiUrl ?? "https://cl.hu.finance").replace(
      /\/+$/,
      ""
    ),
    accessToken: config.accessToken,
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
      const { baseUrl, accessToken } = requireAuth();

      try {
        const result = await listLauncherCampaigns(
          baseUrl,
          accessToken,
          opts.limit
        );

        if (opts.json) {
          printJson(result);
        } else {
          const campaigns = result.results ?? [];
          if (campaigns.length === 0) {
            printText("No campaigns found.");
          } else {
            printText(`Campaigns (${campaigns.length}):`);
            for (const c of campaigns) {
              const parts = [
                `  - ${c.name ?? c.id}`,
                c.chain_id ? `chain=${c.chain_id}` : null,
                c.status ?? null,
              ].filter(Boolean);
              printText(parts.join(" | "));
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
      const { baseUrl, accessToken } = requireAuth();

      try {
        const campaign = await getLauncherCampaign(
          baseUrl,
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
