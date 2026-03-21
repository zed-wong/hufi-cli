import { Command } from "commander";
import {
  checkJoinStatus,
  joinCampaign,
  listJoinedCampaigns,
  getMyProgress,
  getLeaderboard,
} from "../services/recording/campaign.ts";
import {
  listLauncherCampaigns,
  getLauncherCampaign,
} from "../services/launcher/campaign.ts";
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

function getLauncherUrl(): string {
  const config = loadConfig();
  return (config.launcherApiUrl ?? "https://cl.hu.finance").replace(/\/+$/, "");
}

export function createCampaignCommand(): Command {
  const campaign = new Command("campaign").description(
    "Campaign management commands"
  );

  campaign
    .command("list")
    .description("List available campaigns")
    .option("-c, --chain-id <id>", "Chain ID", Number, 137)
    .option("-s, --status <status>", "Filter by status (active, completed, cancelled, to_cancel)", "active")
    .option("-l, --limit <n>", "Max results", Number, 20)
    .option("--json", "Output as JSON")
    .action(async (opts) => {
      const config = loadConfig();
      try {
        const launcherResult = await listLauncherCampaigns(
          getLauncherUrl(),
          opts.chainId,
          opts.limit,
          opts.status
        );

        let joinedKeys = new Set<string>();
        if (config.accessToken) {
          const recordingUrl = config.recordingApiUrl.replace(/\/+$/, "");
          try {
            const joinedResult = await listJoinedCampaigns(
              recordingUrl,
              config.accessToken,
              100
            );
            joinedKeys = new Set(
              (joinedResult.results ?? []).map((c) => {
                const r = c as Record<string, unknown>;
                return `${r.chain_id ?? ""}:${r.escrow_address ?? r.address ?? c.id}`;
              })
            );
          } catch {
            // ignore
          }
        }

        if (opts.json) {
          printJson(launcherResult);
        } else {
          const campaigns = launcherResult.results ?? [];
          if (campaigns.length === 0) {
            printText("No campaigns found.");
          } else {
            printText(`Available campaigns (${campaigns.length}):\n`);
            for (const c of campaigns) {
              const key = `${c.chain_id}:${c.address}`;
              const joined = joinedKeys.has(key);
              const tag = joined ? " [JOINED]" : "";
              printText(
                `  ${c.exchange_name} ${c.symbol} (${c.type})${tag}`
              );
              printText(`    address: ${c.address}`);
              printText(`    status: ${c.status}`);
              printText(
                `    funded: ${c.fund_amount} ${c.fund_token_symbol}  balance: ${c.balance}`
              );
              printText("");
            }
            if (opts.status === "active") {
              printText("Tip: use --status completed, --status cancelled, or --status to_cancel to see other campaigns.");
            }
          }
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        printText(`Failed to list campaigns: ${message}`);
        process.exitCode = 1;
      }
    });

  campaign
    .command("get")
    .description("Get campaign details")
    .requiredOption("-c, --chain-id <id>", "Chain ID", Number)
    .requiredOption("-a, --address <addr>", "Campaign address")
    .option("--json", "Output as JSON")
    .action(async (opts) => {
      try {
        const c = await getLauncherCampaign(
          getLauncherUrl(),
          opts.chainId,
          opts.address
        );

        if (opts.json) {
          printJson(c);
        } else {
          printText(`${c.exchange_name} ${c.symbol} (${c.type})`);
          printText(`  address:    ${c.address}`);
          printText(`  chain:      ${c.chain_id}`);
          printText(`  status:     ${c.status}`);
          printText(`  funded:     ${c.fund_amount} ${c.fund_token_symbol}`);
          printText(`  balance:    ${c.balance} ${c.fund_token_symbol}`);
          printText(`  paid:       ${c.amount_paid} ${c.fund_token_symbol}`);
          printText(`  start:      ${c.start_date}`);
          printText(`  end:        ${c.end_date}`);
          printText(`  launcher:   ${c.launcher}`);
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        printText(`Failed to get campaign: ${message}`);
        process.exitCode = 1;
      }
    });

  campaign
    .command("joined")
    .description("List campaigns you have joined")
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
        printText(`Failed to list joined campaigns: ${message}`);
        process.exitCode = 1;
      }
    });

  campaign
    .command("status")
    .description("Check campaign join status")
    .requiredOption("-c, --chain-id <id>", "Chain ID", Number)
    .requiredOption("-a, --address <address>", "Campaign escrow address")
    .option("--json", "Output as JSON")
    .action(async (opts) => {
      const { baseUrl, accessToken } = requireAuth();

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
      const { baseUrl, accessToken } = requireAuth();

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
    .command("progress")
    .description("Check your progress in a campaign")
    .requiredOption("-c, --chain-id <id>", "Chain ID", Number)
    .requiredOption("-a, --address <address>", "Campaign escrow address")
    .option("--json", "Output as JSON")
    .action(async (opts) => {
      const { baseUrl, accessToken } = requireAuth();

      try {
        const result = await getMyProgress(
          baseUrl,
          accessToken,
          opts.chainId,
          opts.address
        );

        if (opts.json) {
          printJson(result);
        } else {
          const r = result as Record<string, unknown>;
          if (r.message) {
            printText(String(r.message));
          } else {
            for (const [key, value] of Object.entries(r)) {
              printText(`  ${key}: ${value}`);
            }
          }
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        printText(`Failed to get progress: ${message}`);
        process.exitCode = 1;
      }
    });

  campaign
    .command("leaderboard")
    .description("View campaign leaderboard")
    .requiredOption("-c, --chain-id <id>", "Chain ID", Number)
    .requiredOption("-a, --address <address>", "Campaign escrow address")
    .option(
      "-r, --rank-by <field>",
      "Rank by (rewards, current_progress)",
      "rewards"
    )
    .option("-l, --limit <n>", "Max results", Number, 20)
    .option("--json", "Output as JSON")
    .action(async (opts) => {
      try {
        const baseUrl = loadConfig().recordingApiUrl.replace(/\/+$/, "");
        const result = await getLeaderboard(
          baseUrl,
          opts.chainId,
          opts.address,
          opts.rankBy,
          opts.limit
        );

        if (opts.json) {
          printJson(result);
        } else {
          const entries = result.data ?? [];
          if (entries.length === 0) {
            printText("No leaderboard entries.");
          } else {
            printText(`Leaderboard (${opts.rankBy}):\n`);
            entries.forEach((entry, i) => {
              printText(`  ${i + 1}. ${entry.address}  ${entry.result}`);
            });
          }
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        printText(`Failed to get leaderboard: ${message}`);
        process.exitCode = 1;
      }
    });

  return campaign;
}
