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
import { authenticate } from "../services/recording/auth.ts";
import { loadConfig, getDefaultChainId, loadKey, getActiveProfile, getSelectedProfileName, updateProfile } from "../lib/config.ts";
import { getStakingInfo } from "../services/staking.ts";
import { printJson, printText } from "../lib/output.ts";
import { runWatchLoop } from "../lib/watch.ts";
import { type AuthAddressContext, requireAuthAddress } from "../lib/require-auth.ts";
import { ApiError } from "../lib/errors.ts";

function formatCampaignTimestamp(value?: string): string {
  if (!value) return "-";
  return value.replace("T", " ").replace(/\.\d+Z$/, "").replace(/Z$/, "");
}

function formatUtcTimestamp(value: unknown): string {
  if (typeof value !== "string") return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toISOString().replace("T", " ").replace(/\.\d+Z$/, " UTC");
}

function formatMetricValue(value: unknown): string {
  if (value === null || value === undefined) return "-";
  if (typeof value === "number") {
    return Number.isInteger(value)
      ? String(value)
      : value.toFixed(4).replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed && /^-?\d+(\.\d+)?$/.test(trimmed)) {
      const num = Number(trimmed);
      if (!Number.isNaN(num)) {
        return formatMetricValue(num);
      }
    }
    return value;
  }
  return JSON.stringify(value);
}

function printAlignedMetric(label: string, value: unknown, labelWidth = 14): void {
  printText(`  ${label.padEnd(labelWidth)}  ${formatMetricValue(value)}`);
}

function printCampaignProgressCard(result: Record<string, unknown>): void {
  const myMeta = result.my_meta && typeof result.my_meta === "object"
    ? result.my_meta as Record<string, unknown>
    : {};
  const totalMeta = result.total_meta && typeof result.total_meta === "object"
    ? result.total_meta as Record<string, unknown>
    : {};

  const myScore = Number(result.my_score ?? 0);
  const totalScore = Number(totalMeta.total_score ?? 0);
  const scoreShare = totalScore > 0 && Number.isFinite(myScore)
    ? `${((myScore / totalScore) * 100).toFixed(2)}%`
    : "-";

  printText("Campaign Progress");
  printText("-----------------");
  printText("[Window]");
  printAlignedMetric("From", formatUtcTimestamp(result.from));
  printAlignedMetric("To", formatUtcTimestamp(result.to));
  printText("");
  printText("[Mine]");
  printAlignedMetric("Score", result.my_score);
  printAlignedMetric("Token balance", myMeta.token_balance);
  printAlignedMetric("Score share", scoreShare);
  printText("");
  printText("[Totals]");
  printAlignedMetric("Total score", totalMeta.total_score);
  printAlignedMetric("Total balance", totalMeta.total_balance);
}

function formatTokenAmount(value: string, decimals: number, displayDecimals = 2): string {
  const amount = new BigNumber(value).dividedBy(new BigNumber(10).pow(decimals));
  const rounded = amount.decimalPlaces(displayDecimals, BigNumber.ROUND_HALF_UP);
  return rounded.toFormat().replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
}

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

function printCampaignSummary(
  campaign: Record<string, unknown>,
  options: { indent?: string; joinedTag?: string; showLauncher?: boolean } = {}
): void {
  const indent = options.indent ?? "";
  const joinedTag = options.joinedTag ?? "";
  const showLauncher = options.showLauncher ?? true;
  const exchange = String(campaign.exchange_name ?? "?");
  const symbol = String(campaign.symbol ?? "?");
  const type = String(campaign.type ?? "?");
  const chainId = String(campaign.chain_id ?? "-");
  const address = String(campaign.address ?? campaign.escrow_address ?? "-");
  const status = String(campaign.status ?? "-");
  const startDate = typeof campaign.start_date === "string" ? campaign.start_date : undefined;
  const endDate = typeof campaign.end_date === "string" ? campaign.end_date : undefined;
  const launcher = typeof campaign.launcher === "string" ? campaign.launcher : undefined;
  const decimals = Number(campaign.fund_token_decimals ?? 0);
  const fundAmount = new BigNumber(String(campaign.fund_amount ?? 0));
  const balanceNum = new BigNumber(String(campaign.balance ?? 0));
  const pct = fundAmount.gt(0) ? balanceNum.dividedBy(fundAmount).times(100).toFixed(1) : "0.0";
  const fundTokenSymbol = String(campaign.fund_token_symbol ?? campaign.fund_token ?? "-");

  printText(`${indent}${exchange} ${symbol} (${type})${joinedTag}`);
  printText(`${indent}  chain:      ${chainId}`);
  printText(`${indent}  address:    ${address}`);
  printText(`${indent}  status:     ${status}`);
  printText(`${indent}  duration:   ${formatCampaignTimestamp(startDate)} ~ ${formatCampaignTimestamp(endDate)}`);
  printText(
    `${indent}  funded:     ${formatTokenAmount(String(campaign.fund_amount ?? 0), decimals)} ${fundTokenSymbol}  paid: ${formatTokenAmount(String(campaign.amount_paid ?? 0), decimals)}  balance: ${formatTokenAmount(String(campaign.balance ?? 0), decimals)} (${pct}%)`
  );
  if (showLauncher && launcher) {
    printText(`${indent}  launcher:   ${launcher}`);
  }
}

function printProfileContext(address?: string): void {
  printText(`Profile: ${getSelectedProfileName()}`);
  if (address) {
    printText(`Address: ${address}`);
  }
  printText("");
}

function isCampaignActive(campaign: Record<string, unknown>): boolean {
  const status = String(campaign.status ?? "").toLowerCase();
  return status === "active";
}

function isUnauthorizedError(err: unknown): err is ApiError {
  return err instanceof ApiError && err.status === 401;
}

export async function withSingleUnauthorizedRetry<T>(
  run: () => Promise<T>,
  onUnauthorized: () => Promise<void>
): Promise<T> {
  try {
    return await run();
  } catch (err: unknown) {
    if (!isUnauthorizedError(err)) {
      throw err;
    }
    await onUnauthorized();
    return run();
  }
}

async function reauthenticateCampaignProfile(baseUrl: string): Promise<void> {
  const privateKey = loadKey();
  const profile = getSelectedProfileName();
  if (!privateKey) {
    throw new Error(
      `Authentication expired for profile '${profile}' and no private key was found. Run: hufi --profile ${profile} auth login --private-key <key>`
    );
  }

  try {
    const result = await authenticate(baseUrl, privateKey);
    updateProfile(profile, {
      address: result.address,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Authentication expired and automatic re-login failed: ${message}. Run: hufi --profile ${profile} auth login --private-key <key>`
    );
  }
}

async function runWithCampaignAuthRetry<T>(
  run: (auth: AuthAddressContext) => Promise<T>
): Promise<T> {
  let auth = requireAuthAddress();
  return withSingleUnauthorizedRetry(
    () => run(auth),
    async () => {
      await reauthenticateCampaignProfile(auth.baseUrl);
      auth = requireAuthAddress();
    }
  );
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
        if (getActiveProfile().accessToken) {
          const recordingUrl = config.recordingApiUrl.replace(/\/+$/, "");
          try {
            const joinedResult = await listJoinedCampaigns(
              recordingUrl,
              getActiveProfile().accessToken as string,
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
              printCampaignSummary(c as unknown as Record<string, unknown>, {
                indent: "  ",
                joinedTag: tag,
              });
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
          printText(`  funded:     ${formatTokenAmount(c.fund_amount, showDecimals)} ${c.fund_token_symbol}`);
          printText(`  balance:    ${formatTokenAmount(c.balance, showDecimals)} ${c.fund_token_symbol}`);
          printText(`  paid:       ${formatTokenAmount(c.amount_paid, showDecimals)} ${c.fund_token_symbol}`);
          printText(`  start:      ${formatCampaignTimestamp(c.start_date)}`);
          printText(`  end:        ${formatCampaignTimestamp(c.end_date)}`);
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
    .description("List active campaigns you have joined")
    .option("-l, --limit <n>", "Max results", Number, 20)
    .option("--all", "Include completed and cancelled joined campaigns")
    .option("--json", "Output as JSON")
    .action(async (opts) => {
      try {
        await runWithCampaignAuthRetry(async ({ baseUrl, accessToken }) => {
          const result = await listJoinedCampaigns(
            baseUrl,
            accessToken,
            opts.limit
          );

          const campaigns = (result.results ?? []).filter((c) => {
            if (opts.all) return true;
            return isCampaignActive(c as Record<string, unknown>);
          });
          const output = { ...result, results: campaigns, total: campaigns.length };

          if (opts.json) {
            printJson(output);
          } else {
            printProfileContext(getActiveProfile().address);
            if (campaigns.length === 0) {
              printText(
                opts.all
                  ? "No joined campaigns found."
                  : "No active joined campaigns found. Use --all to include completed and cancelled campaigns."
              );
            } else {
              printText(`${opts.all ? "Joined campaigns" : "Active joined campaigns"} (${campaigns.length}):\n`);
              for (const c of campaigns) {
                const record = c as Record<string, unknown>;
                const hasListMetadata = Boolean(
                  record.exchange_name ??
                  record.symbol ??
                  record.type ??
                  record.address ??
                  record.escrow_address
                );

                if (hasListMetadata) {
                  printCampaignSummary(record, {
                    indent: "  ",
                    showLauncher: typeof record.launcher === "string",
                  });
                } else {
                  const exchange = String(record.exchange_name ?? "").trim();
                  const symbol = String(record.symbol ?? "").trim();
                  const exchangeSymbol = [exchange, symbol].filter(Boolean).join(" ");
                  const label =
                    record.campaign_name ??
                    record.name ??
                    (exchangeSymbol || undefined) ??
                    record.address ??
                    record.escrow_address ??
                    c.id ??
                    "(unnamed campaign)";
                  printText(`  - ${label}`);
                }
                printText("");
              }
            }
          }
        });
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

      try {
        await runWithCampaignAuthRetry(async ({ baseUrl, accessToken }) => {
          const status = await checkJoinStatus(
            baseUrl,
            accessToken,
            opts.chainId,
            opts.address
          );

          if (opts.json) {
            printJson(status);
          } else {
            printProfileContext(getActiveProfile().address);
            printText(`Status: ${status.status}`);
            if (status.joined_at) printText(`Joined at: ${status.joined_at}`);
            if (status.reason) printText(`Reason: ${status.reason}`);
          }
        });
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

      try {
        await runWithCampaignAuthRetry(async ({ baseUrl, accessToken }) => {
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
              printProfileContext(getActiveProfile().address);
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
            printProfileContext(getActiveProfile().address);
            printText("Campaign joined successfully.");
            if (result.id) printText(`Campaign ID: ${result.id}`);
          }
        });
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

      try {
        await runWithCampaignAuthRetry(async ({ baseUrl, accessToken }) => {
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
              printProfileContext(getActiveProfile().address);
              const r = result as Record<string, unknown>;
              if (r.message) {
                printText(String(r.message));
              } else if (
                "from" in r ||
                "to" in r ||
                "my_score" in r ||
                "my_meta" in r ||
                "total_meta" in r
              ) {
                printCampaignProgressCard(r);
              } else {
                for (const [key, value] of Object.entries(r)) {
                  const displayValue =
                    value !== null && typeof value === "object"
                      ? JSON.stringify(value)
                      : String(value);
                  printText(`  ${key}: ${displayValue}`);
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
        });
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
    .option("--watch", "Poll continuously")
    .option("--interval <seconds>", "Polling interval in seconds", Number, 10)
    .option("--json", "Output as JSON")
    .action(async (opts) => {
      if (!opts.address) {
        leaderboardCmd.help();
        return;
      }
      try {
        const baseUrl = loadConfig().recordingApiUrl.replace(/\/+$/, "");
        let running = true;
        let hasRunOnce = false;
        let watchStoppedBySignal = false;
        const stop = () => {
          running = false;
          watchStoppedBySignal = true;
          printText("Stopped watching leaderboard.");
        };

        if (opts.watch) {
          process.once("SIGINT", stop);
        }

        await runWatchLoop(async () => {
          hasRunOnce = true;
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
              printText(
                `  total: ${formatMetricValue(result.total)}  updated: ${formatCampaignTimestamp(result.updated_at ?? undefined)}`
              );
              printText("");
              entries.forEach((entry, i) => {
                const parts = [
                  `score: ${formatMetricValue(entry.score)}`,
                  `result: ${formatMetricValue(entry.result)}`,
                  `reward: ${formatMetricValue(entry.estimated_reward)}`,
                ];
                printText(`  ${i + 1}. ${entry.address}`);
                printText(`     ${parts.join("  ")}`);
              });
            }
          }

          if (opts.watch) {
            printText("---");
          }
        }, {
          intervalMs: opts.interval * 1000,
          shouldContinue: () => (opts.watch ? running : !hasRunOnce),
        });

        if (opts.watch) {
          process.removeListener("SIGINT", stop);
          if (watchStoppedBySignal) {
            process.exitCode = 0;
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

      const address = getActiveProfile().address;
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
