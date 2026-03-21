import { Command } from "commander";
import {
  checkJoinStatus,
  joinCampaign,
  listJoinedCampaigns,
} from "../services/recording/campaign.ts";
import { loadConfig } from "../lib/config.ts";
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

export function createCampaignCommand(): Command {
  const campaign = new Command("campaign").description(
    "Campaign management commands"
  );

  campaign
    .command("status")
    .description("Check campaign join status")
    .requiredOption("-c, --chain-id <id>", "Chain ID", Number)
    .requiredOption("-a, --address <address>", "Campaign escrow address")
    .option("--json", "Output as JSON")
    .action(async (opts) => {
      const { baseUrl, accessToken, address } = requireAuth();

      try {
        const status = await checkJoinStatus(
          baseUrl,
          accessToken,
          opts.chainId,
          opts.address
        );

        if (opts.json) {
          printJson(status);
        } else {
          printText(`Status: ${status.status}`);
          if (status.joined_at) printText(`Joined at: ${status.joined_at}`);
          if (status.reason) printText(`Reason: ${status.reason}`);
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        printText(`Failed to check join status: ${message}`);
        process.exitCode = 1;
      }
    });

  campaign
    .command("join")
    .description("Join a campaign")
    .requiredOption("-c, --chain-id <id>", "Chain ID", Number)
    .requiredOption("-a, --address <address>", "Campaign escrow address")
    .option("--json", "Output as JSON")
    .action(async (opts) => {
      const { baseUrl, accessToken, address } = requireAuth();

      try {
        const joinStatus = await checkJoinStatus(
          baseUrl,
          accessToken,
          opts.chainId,
          opts.address
        );

        if (joinStatus.status === "already_joined") {
          if (opts.json) {
            printJson(joinStatus);
          } else {
            printText("Already joined this campaign.");
          }
          return;
        }

        const result = await joinCampaign(
          baseUrl,
          accessToken,
          opts.chainId,
          opts.address
        );

        if (opts.json) {
          printJson(result);
        } else {
          printText("Campaign joined successfully.");
          if (result.id) printText(`Campaign ID: ${result.id}`);
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        printText(`Failed to join campaign: ${message}`);
        process.exitCode = 1;
      }
    });

  campaign
    .command("list")
    .description("List joined campaigns")
    .option("-l, --limit <n>", "Max results", Number, 20)
    .option("--json", "Output as JSON")
    .action(async (opts) => {
      const { baseUrl, accessToken } = requireAuth();

      try {
        const result = await listJoinedCampaigns(
          baseUrl,
          accessToken,
          opts.limit
        );

        if (opts.json) {
          printJson(result);
        } else {
          const campaigns = result.results ?? [];
          if (campaigns.length === 0) {
            printText("No joined campaigns found.");
          } else {
            printText(`Joined campaigns (${campaigns.length}):`);
            for (const c of campaigns) {
              const label =
                (c as Record<string, unknown>).campaign_name ??
                (c as Record<string, unknown>).name ??
                c.id;
              printText(`  - ${label}`);
            }
          }
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        printText(`Failed to list campaigns: ${message}`);
        process.exitCode = 1;
      }
    });

  return campaign;
}
