import { Command } from "commander";
import {
  listLauncherCampaigns,
  getLauncherCampaign,
} from "../services/launcher/campaign.ts";
import { listJoinedCampaigns } from "../services/recording/campaign.ts";
import { loadConfig } from "../lib/config.ts";
import { printJson, printText } from "../lib/output.ts";

export function createLauncherCommand(): Command {
  const launcher = new Command("launcher").description(
    "Campaign Launcher commands"
  );

  launcher
    .command("list")
    .description("List all available campaigns")
    .requiredOption("-c, --chain-id <id>", "Chain ID", Number)
    .option("-l, --limit <n>", "Max results", Number, 20)
    .option("--json", "Output as JSON")
    .action(async (opts) => {
      const config = loadConfig();
      const launcherUrl = (config.launcherApiUrl ?? "https://cl.hu.finance").replace(
        /\/+$/,
        ""
      );

      try {
        const launcherResult = await listLauncherCampaigns(
          launcherUrl,
          opts.chainId,
          opts.limit
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
            // ignore - joined list is optional
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
          }
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        printText(`Failed to list campaigns: ${message}`);
        process.exitCode = 1;
      }
    });

  launcher
    .command("get")
    .description("Get campaign details")
    .requiredOption("-c, --chain-id <id>", "Chain ID", Number)
    .requiredOption("-a, --address <addr>", "Campaign address")
    .option("--json", "Output as JSON")
    .action(async (opts) => {
      const config = loadConfig();
      const launcherUrl = (config.launcherApiUrl ?? "https://cl.hu.finance").replace(
        /\/+$/,
        ""
      );

      try {
        const campaign = await getLauncherCampaign(
          launcherUrl,
          opts.chainId,
          opts.address
        );

        if (opts.json) {
          printJson(campaign);
        } else {
          printText(`${campaign.exchange_name} ${campaign.symbol} (${campaign.type})`);
          printText(`  address:    ${campaign.address}`);
          printText(`  chain:      ${campaign.chain_id}`);
          printText(`  status:     ${campaign.status}`);
          printText(`  funded:     ${campaign.fund_amount} ${campaign.fund_token_symbol}`);
          printText(`  balance:    ${campaign.balance} ${campaign.fund_token_symbol}`);
          printText(`  paid:       ${campaign.amount_paid} ${campaign.fund_token_symbol}`);
          printText(`  start:      ${campaign.start_date}`);
          printText(`  end:        ${campaign.end_date}`);
          printText(`  launcher:   ${campaign.launcher}`);
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        printText(`Failed to get campaign: ${message}`);
        process.exitCode = 1;
      }
    });

  return launcher;
}
