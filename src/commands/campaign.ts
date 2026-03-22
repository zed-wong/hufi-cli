import { Command } from "commander";
import BigNumber from "bignumber.js";
import { formatUnits } from "ethers";
import {
  checkJoinStatus,
  joinCampaign,
  listJoinedCampaigns,
  getMyProgress,
  getLeaderboard,
} from "../services/recording/campaign.ts";
import { createCampaign, preflightCampaign, estimateTotalGasCost } from "../services/campaign-create.ts";
import {
  listLauncherCampaigns,
  getLauncherCampaign,
} from "../services/launcher/campaign.ts";
import { loadConfig, getDefaultChainId, loadKey } from "../lib/config.ts";
import { getStakingInfo } from "../services/staking.ts";
import { printJson, printText } from "../lib/output.ts";
import { runWatchLoop } from "../lib/watch.ts";
import { requireAuthAddress } from "../lib/require-auth.ts";

export function formatCampaignCreateProgress(confirmations: number): string {
  if (confirmations <= 0) {
    return "Transaction submitted. Waiting for confirmations...";
  }
  return `Confirmations: ${confirmations}`;
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
    .option("-c, --chain-id <id>", "Chain ID (default: from config)", Number, getDefaultChainId())
    .option("-s, --status <status>", "Filter by status (active, completed, cancelled, to_cancel)", "active")
    .option("--page <n>", "Page number", Number, 1)
    .option("--page-size <n>", "Items per page", Number, 20)
    .option("-l, --limit <n>", "Max results", Number, 20)
    .option("--json", "Output as JSON")
    .action(async (opts) => {
      const config = loadConfig();
      try {
        const pageSize = opts.pageSize ?? opts.limit;
        const launcherResult = await listLauncherCampaigns(
          getLauncherUrl(),
          opts.chainId,
          pageSize,
          opts.status,
          opts.page
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
              const decimals = c.fund_token_decimals ?? 0;
              const fmt = (v: string) => {
                const bn = new BigNumber(v).dividedBy(new BigNumber(10).pow(decimals));
                return bn.toFormat();
              };
              const fundAmount = new BigNumber(c.fund_amount);
              const balanceNum = new BigNumber(c.balance);
              const pct = fundAmount.gt(0) ? balanceNum.dividedBy(fundAmount).times(100).toFixed(1) : "0.0";
              printText(
                `  ${c.exchange_name} ${c.symbol} (${c.type})${tag}`
              );
              printText(`    chain:      ${c.chain_id}`);
              printText(`    address:    ${c.address}`);
              printText(`    status:     ${c.status}`);
              printText(`    duration:   ${c.start_date?.split("T")[0] ?? "-"} ~ ${c.end_date?.split("T")[0] ?? "-"}`);
              printText(
                `    funded:     ${fmt(c.fund_amount)} ${c.fund_token_symbol}  paid: ${fmt(c.amount_paid)}  balance: ${fmt(c.balance)} (${pct}%)`
              );
              printText("");
            }
            if (opts.status === "active") {
              printText("Tip: use --status completed, --status cancelled, or --status to_cancel to see other campaigns.");
            }
            if (launcherResult.has_more) {
              printText(`Tip: more campaigns available, try --page ${opts.page + 1} --page-size ${pageSize}.`);
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
          const showDecimals = c.fund_token_decimals ?? 0;
          const showFmt = (v: string) => new BigNumber(v).dividedBy(new BigNumber(10).pow(showDecimals)).toFormat();
          printText(`  funded:     ${showFmt(c.fund_amount)} ${c.fund_token_symbol}`);
          printText(`  balance:    ${showFmt(c.balance)} ${c.fund_token_symbol}`);
          printText(`  paid:       ${showFmt(c.amount_paid)} ${c.fund_token_symbol}`);
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
      const { baseUrl, accessToken } = requireAuthAddress();

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

  const statusCmd = campaign
    .command("status")
    .description("Check campaign join status")
    .option("-c, --chain-id <id>", "Chain ID (default: from config)", Number, getDefaultChainId())
    .option("-a, --address <address>", "Campaign escrow address")
    .option("--json", "Output as JSON")
    .action(async (opts) => {
      if (!opts.address) {
        statusCmd.help();
        return;
      }
      const { baseUrl, accessToken } = requireAuthAddress();

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

  const joinCmd = campaign
    .command("join")
    .description("Join a campaign")
    .option("-c, --chain-id <id>", "Chain ID (default: from config)", Number, getDefaultChainId())
    .option("-a, --address <address>", "Campaign escrow address")
    .option("--json", "Output as JSON")
    .action(async (opts) => {
      if (!opts.address) {
        joinCmd.help();
        return;
      }
      const { baseUrl, accessToken } = requireAuthAddress();

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

  const progressCmd = campaign
    .command("progress")
    .description("Check your progress in a campaign")
    .option("-c, --chain-id <id>", "Chain ID (default: from config)", Number, getDefaultChainId())
    .option("-a, --address <address>", "Campaign escrow address")
    .option("--watch", "Poll continuously")
    .option("--interval <ms>", "Polling interval in ms", Number, 10000)
    .option("--json", "Output as JSON")
    .action(async (opts) => {
      if (!opts.address) {
        progressCmd.help();
        return;
      }
      const { baseUrl, accessToken } = requireAuthAddress();

      try {
        let running = true;
        let hasRunOnce = false;
        let watchStoppedBySignal = false;
        const stop = () => {
          running = false;
          watchStoppedBySignal = true;
          printText("Stopped watching progress.");
        };

        if (opts.watch) {
          process.once("SIGINT", stop);
        }

        await runWatchLoop(async () => {
          hasRunOnce = true;
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

          if (opts.watch) {
            printText("---");
          }
        }, {
          intervalMs: opts.interval,
          shouldContinue: () => (opts.watch ? running : !hasRunOnce),
        });

        if (opts.watch) {
          process.removeListener("SIGINT", stop);
          if (watchStoppedBySignal) {
            process.exitCode = 0;
          }
        } else {
          return;
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        printText(`Failed to get progress: ${message}`);
        process.exitCode = 1;
      }
    });

  const leaderboardCmd = campaign
    .command("leaderboard")
    .description("View campaign leaderboard")
    .option("-c, --chain-id <id>", "Chain ID (default: from config)", Number, getDefaultChainId())
    .option("-a, --address <address>", "Campaign escrow address")
    .option(
      "-r, --rank-by <field>",
      "Rank by (rewards, current_progress)",
      "rewards"
    )
    .option("-l, --limit <n>", "Max results", Number, 20)
    .option("--json", "Output as JSON")
    .action(async (opts) => {
      if (!opts.address) {
        leaderboardCmd.help();
        return;
      }
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

  const VALID_TYPES = ["market_making", "holding", "threshold"];

  campaign
    .command("create")
    .description("Create a new campaign (launch escrow on-chain)")
    .requiredOption("--type <type>", `Campaign type (${VALID_TYPES.join(", ")})`)
    .requiredOption("--exchange <name>", "Exchange name (e.g. mexc, bybit)")
    .requiredOption("--symbol <symbol>", "Token symbol or pair (e.g. HMT/USDT or HMT)")
    .requiredOption("--start-date <date>", "Start date (YYYY-MM-DD)")
    .requiredOption("--end-date <date>", "End date (YYYY-MM-DD)")
    .requiredOption("--fund-token <token>", "Fund token (USDT or USDC)")
    .requiredOption("--fund-amount <amount>", "Fund amount")
    .option("--daily-volume-target <n>", "Daily volume target (market_making)", Number)
    .option("--daily-balance-target <n>", "Daily balance target (holding)", Number)
    .option("--minimum-balance-target <n>", "Minimum balance target (threshold)", Number)
    .option("-c, --chain-id <id>", "Chain ID (default: from config)", Number, getDefaultChainId())
    .option("--json", "Output as JSON")
    .action(async (opts) => {
      const privateKey = loadKey();
      if (!privateKey) {
        printText("No private key found. Run: hufi auth generate");
        process.exit(1);
      }

      const config = loadConfig();
      const address = config.address;
      if (!address) {
        printText("Not authenticated. Run: hufi auth login --private-key <key>");
        process.exit(1);
      }

      const type = opts.type.toLowerCase();
      if (!VALID_TYPES.includes(type)) {
        printText(`Invalid type: ${opts.type}. Must be one of: ${VALID_TYPES.join(", ")}`);
        process.exit(1);
      }

      const typeMap: Record<string, "MARKET_MAKING" | "HOLDING" | "THRESHOLD"> = {
        market_making: "MARKET_MAKING",
        holding: "HOLDING",
        threshold: "THRESHOLD",
      };

      const startDate = new Date(opts.startDate);
      const endDate = new Date(opts.endDate);
      const durationHours = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60);

      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        printText("Invalid date format. Use YYYY-MM-DD.");
        process.exit(1);
      }
      if (durationHours < 6) {
        printText("Campaign duration must be at least 6 hours.");
        process.exit(1);
      }
      if (durationHours > 100 * 24) {
        printText("Campaign duration must be at most 100 days.");
        process.exit(1);
      }

      if (type === "market_making" && !opts.dailyVolumeTarget) {
        printText("--daily-volume-target is required for market_making campaigns.");
        process.exit(1);
      }
      if (type === "holding" && !opts.dailyBalanceTarget) {
        printText("--daily-balance-target is required for holding campaigns.");
        process.exit(1);
      }
      if (type === "threshold" && !opts.minimumBalanceTarget) {
        printText("--minimum-balance-target is required for threshold campaigns.");
        process.exit(1);
      }

      const params = {
        type: typeMap[type] as "MARKET_MAKING" | "HOLDING" | "THRESHOLD",
        exchange: opts.exchange,
        pair: type === "market_making" ? opts.symbol : undefined,
        symbol: type !== "market_making" ? opts.symbol : undefined,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        fundToken: opts.fundToken.toUpperCase(),
        fundAmount: opts.fundAmount,
        dailyVolumeTarget: opts.dailyVolumeTarget,
        dailyBalanceTarget: opts.dailyBalanceTarget,
        minimumBalanceTarget: opts.minimumBalanceTarget,
      };

      // Check staking requirement
      let minimumStake = "0";
      try {
        const stakingInfo = await getStakingInfo(address, opts.chainId);
        minimumStake = stakingInfo.minimumStake;

        if (Number(stakingInfo.stakedTokens) < Number(minimumStake)) {
          printText("Insufficient staked HMT to create a campaign.");
          printText(`  Required:  ${Number(minimumStake).toLocaleString()} HMT (minimum stake)`);
          printText(`  Your stake: ${Number(stakingInfo.stakedTokens).toLocaleString()} HMT`);
          printText("");
          printText("Stake more HMT with: hufi staking stake -a <amount>");
          process.exit(1);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        printText(`Warning: could not verify staking status: ${message}`);
        printText("Proceeding anyway...");
      }

      // Run preflight checks
      let preflight;
      try {
        preflight = await preflightCampaign(privateKey, opts.chainId, params);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        printText(`Preflight check failed: ${message}`);
        process.exitCode = 1;
        return;
      }

      // Check fund token balance
      const fundAmountWei = BigInt(Math.floor(Number(opts.fundAmount) * (10 ** preflight.fundTokenDecimals)));
      if (preflight.fundTokenBalance < fundAmountWei) {
        printText(`Insufficient ${preflight.fundTokenSymbol} balance.`);
        printText(`  Required: ${opts.fundAmount} ${preflight.fundTokenSymbol}`);
        printText(`  Balance:  ${formatUnits(preflight.fundTokenBalance, preflight.fundTokenDecimals)} ${preflight.fundTokenSymbol}`);
        process.exit(1);
      }

      // Estimate gas costs
      const gasCost = estimateTotalGasCost(preflight, opts.chainId);

      // Show summary before proceeding
      printText("Campaign creation summary:");
      printText(`  Type:       ${type} on ${opts.exchange}`);
      printText(`  Symbol:     ${opts.symbol}`);
      printText(`  Fund:       ${opts.fundAmount} ${preflight.fundTokenSymbol}`);
      printText(`  Duration:   ${opts.startDate} ~ ${opts.endDate}`);
      printText(`  Chain:      ${opts.chainId}`);
      printText("");
      printText("Estimated gas costs:");
      if (preflight.needsApproval) {
        printText(`  Approval:   ~${preflight.approveGasEstimate.toLocaleString()} gas`);
      }
      printText(`  Creation:   ~${preflight.createGasEstimate.toLocaleString()} gas`);
      printText(`  Total:      ~${formatUnits(gasCost.totalGasWei, 18)} ${gasCost.nativeSymbol}`);
      printText("");

      if (gasCost.insufficientNative) {
        printText(`Insufficient ${gasCost.nativeSymbol} for gas.`);
        printText(`  Balance: ${formatUnits(preflight.nativeBalance, 18)} ${gasCost.nativeSymbol}`);
        printText(`  Needed:  ~${formatUnits(gasCost.totalGasWei, 18)} ${gasCost.nativeSymbol}`);
        process.exit(1);
      }

      try {
        printText(formatCampaignCreateProgress(0));

        const result = await createCampaign(
          privateKey,
          opts.chainId,
          params,
          (confirmations) => {
            printText(formatCampaignCreateProgress(confirmations));
          }
        );

        if (opts.json) {
          printJson(result);
        } else {
          printText(`Campaign created successfully!`);
          printText(`  Escrow: ${result.escrowAddress}`);
          printText(`  TX:     ${result.txHash}`);
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        printText(`Failed to create campaign: ${message}`);
        process.exitCode = 1;
      }
    });

  return campaign;
}
