import { Command } from "commander";
import { ApiError } from "../lib/errors.ts";
import {
  registerExchangeApiKey,
  listExchangeApiKeys,
  deleteExchangeApiKey,
  revalidateExchangeApiKey,
} from "../services/recording/exchange.ts";
import { printJson, printText, maskSecret } from "../lib/output.ts";
import { requireAuthToken } from "../lib/require-auth.ts";
import type { RevalidateResult } from "../types/exchange.ts";
import { getActiveProfile, getSelectedProfileName } from "../lib/config.ts";

function printProfileContext() {
  printText(`Profile: ${getSelectedProfileName()}`);
  if (getActiveProfile().address) {
    printText(`Address: ${getActiveProfile().address}`);
  }
}

const authHintByAction: Record<string, string> = {
  register:
    "Run: hufi auth login --private-key <key> before registering exchange API keys.",
  list:
    "Run: hufi auth login --private-key <key> before listing exchange API keys.",
  delete:
    "Run: hufi auth login --private-key <key> before deleting exchange API keys.",
  revalidate:
    "Run: hufi auth login --private-key <key> before revalidating exchange API keys.",
};

function isUnauthorizedError(err: unknown): err is ApiError {
  return err instanceof ApiError && err.status === 401;
}

export function formatExchangeCommandErrorMessage(
  action: "register" | "list" | "delete" | "revalidate",
  err: unknown
): string {
  const message = err instanceof Error ? err.message : String(err);
  const commandTarget = action === "list" ? "exchange API keys" : "exchange API key";

  if (isUnauthorizedError(err)) {
    return `Failed to ${action} ${commandTarget}: ${message}. ${authHintByAction[action]}`;
  }

  return `Failed to ${action} ${commandTarget}: ${message}`;
}

export function formatRevalidateText(
  exchangeName: string,
  result: RevalidateResult
): string[] {
  const lines = [`${exchangeName}: ${result.is_valid ? "valid" : "invalid"}`];
  if ((result.missing_permissions?.length ?? 0) > 0) {
    lines.push(`Missing permissions: ${result.missing_permissions?.join(", ")}`);
  }

  return lines;
}

export function createExchangeCommand(): Command {
  const exchange = new Command("exchange").description(
    "Exchange API key management"
  );

  exchange
    .command("register")
    .description("Register a read-only exchange API key")
    .requiredOption(
      "-n, --name <name>",
      "CCXT exchange name (e.g. binance, mexc)"
    )
    .requiredOption("--api-key <key>", "Read-only API key")
    .requiredOption("--secret-key <key>", "Read-only API secret")
    .option("--bitmart-memo <memo>", "Bitmart memo (only for bitmart)")
    .option("--json", "Output as JSON")
    .action(async (opts) => {
      const { baseUrl, accessToken } = requireAuthToken();

      try {
        const result = await registerExchangeApiKey(
          baseUrl,
          accessToken,
          opts.name,
          opts.apiKey,
          opts.secretKey,
          opts.bitmartMemo
        );

        if (opts.json) {
          printJson(result);
        } else {
          printProfileContext();
          printText(
            `Registered ${opts.name} API key ${maskSecret(opts.apiKey)}`
          );
          if (result.id) {
            printText(`ID: ${result.id}`);
          }
        }
      } catch (err: unknown) {
        printText(formatExchangeCommandErrorMessage("register", err));
        process.exitCode = 1;
      }
    });

  exchange
    .command("list")
    .description("List registered exchange API keys")
    .option("--json", "Output as JSON")
    .action(async (opts) => {
      const { baseUrl, accessToken } = requireAuthToken();

      try {
        const keys = await listExchangeApiKeys(baseUrl, accessToken);

        if (opts.json) {
          printJson(keys);
        } else {
          printProfileContext();
          if (keys.length === 0) {
            printText("No exchange API keys registered.");
          } else {
            for (const key of keys) {
              const status = key.is_valid ? "valid" : "invalid";
              printText(`- ${key.exchange_name} (${maskSecret(key.api_key)}) [${status}]`);
            }
          }
        }
      } catch (err: unknown) {
        printText(formatExchangeCommandErrorMessage("list", err));
        process.exitCode = 1;
      }
    });

  exchange
    .command("delete [name]")
    .description("Delete API keys for an exchange")
    .usage("[name] [options]")
    .option("-n, --name <name>", "Exchange name (e.g. mexc, bybit)")
    .option("--json", "Output as JSON")
    .action(async (nameArg, opts) => {
      const exchangeName = nameArg ?? opts.name;
      if (!exchangeName) {
        printText("Exchange name is required. Usage: hufi exchange delete <name>");
        process.exitCode = 1;
        return;
      }

      const { baseUrl, accessToken } = requireAuthToken();

      try {
        await deleteExchangeApiKey(baseUrl, accessToken, exchangeName);

        if (opts.json) {
          printJson({ deleted: true, exchange_name: exchangeName });
        } else {
          printProfileContext();
          printText(`Deleted API keys for ${exchangeName}.`);
        }
      } catch (err: unknown) {
        printText(formatExchangeCommandErrorMessage("delete", err));
        process.exitCode = 1;
      }
    });

  exchange
    .command("revalidate [name]")
    .description("Revalidate exchange API key")
    .usage("[name] [options]")
    .option("-n, --name <name>", "Exchange name (e.g. mexc, bybit)")
    .option("--json", "Output as JSON")
    .action(async (nameArg, opts) => {
      const exchangeName = nameArg ?? opts.name;
      if (!exchangeName) {
        printText("Exchange name is required. Usage: hufi exchange revalidate <name>");
        process.exitCode = 1;
        return;
      }

      const { baseUrl, accessToken } = requireAuthToken();

      try {
        const result = await revalidateExchangeApiKey(
          baseUrl,
          accessToken,
          exchangeName
        );

        if (opts.json) {
          printJson(result);
        } else {
          printProfileContext();
          for (const line of formatRevalidateText(exchangeName, result)) {
            printText(line);
          }
        }
      } catch (err: unknown) {
        printText(formatExchangeCommandErrorMessage("revalidate", err));
        process.exitCode = 1;
      }
    });

  return exchange;
}
