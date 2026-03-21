import { Command } from "commander";
import {
  registerExchangeApiKey,
  listExchangeApiKeys,
} from "../services/recording/exchange.ts";
import { loadConfig } from "../lib/config.ts";
import { printJson, printText, maskSecret } from "../lib/output.ts";

function requireAuth(): { baseUrl: string; accessToken: string } {
  const config = loadConfig();
  if (!config.accessToken) {
    printText("Not authenticated. Run: hufi auth login --private-key <key>");
    process.exit(1);
  }
  return {
    baseUrl: config.recordingApiUrl.replace(/\/+$/, ""),
    accessToken: config.accessToken,
  };
}

export function createExchangeCommand(): Command {
  const exchange = new Command("exchange").description(
    "Exchange API key management"
  );

  exchange
    .command("register")
    .description("Register a read-only exchange API key")
    .requiredOption("-n, --name <name>", "Exchange name (e.g. binance, mexc)")
    .requiredOption("--api-key <key>", "Read-only API key")
    .requiredOption("--secret-key <key>", "Read-only API secret")
    .option("--bitmart-memo <memo>", "Bitmart memo (only for bitmart)")
    .option("--json", "Output as JSON")
    .action(async (opts) => {
      const { baseUrl, accessToken } = requireAuth();

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
          printText(
            `Registered ${opts.name} API key ${maskSecret(opts.apiKey)}`
          );
          if (result.id) {
            printText(`ID: ${result.id}`);
          }
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        printText(`Failed to register exchange API key: ${message}`);
        process.exitCode = 1;
      }
    });

  exchange
    .command("list")
    .description("List registered exchange API keys")
    .option("--json", "Output as JSON")
    .action(async (opts) => {
      const { baseUrl, accessToken } = requireAuth();

      try {
        const keys = await listExchangeApiKeys(baseUrl, accessToken);

        if (opts.json) {
          printJson(keys);
        } else {
          if (keys.length === 0) {
            printText("No exchange API keys registered.");
          } else {
            for (const key of keys) {
              printText(`- ${key.exchange_name} (ID: ${key.id})`);
            }
          }
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        printText(`Failed to list exchange API keys: ${message}`);
        process.exitCode = 1;
      }
    });

  return exchange;
}
