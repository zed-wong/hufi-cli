import { Command } from "commander";
import { authenticate, createWallet } from "../services/recording/auth.ts";
import { loadConfig, updateConfig } from "../lib/config.ts";
import { printJson, printText } from "../lib/output.ts";

export function createAuthCommand(): Command {
  const auth = new Command("auth").description("Authentication commands");

  auth
    .command("login")
    .description("Authenticate with Recording Oracle using a private key")
    .requiredOption("-k, --private-key <key>", "EVM private key")
    .option("-u, --api-url <url>", "Recording Oracle API URL")
    .option("--json", "Output as JSON")
    .action(async (opts) => {
      const config = loadConfig();
      const baseUrl = (opts.apiUrl ?? config.recordingApiUrl).replace(
        /\/+$/,
        ""
      );

      try {
        const result = await authenticate(baseUrl, opts.privateKey);

        updateConfig({
          recordingApiUrl: baseUrl,
          address: result.address,
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
        });

        if (opts.json) {
          printJson({ address: result.address, accessToken: result.accessToken });
        } else {
          printText(`Authenticated as ${result.address}`);
          printText(`Token saved to ~/.hufi-cli/config.json`);
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        printText(`Authentication failed: ${message}`);
        process.exitCode = 1;
      }
    });

  auth
    .command("generate")
    .description("Generate a new EVM wallet")
    .option("--json", "Output as JSON")
    .action((opts) => {
      const wallet = createWallet();
      if (opts.json) {
        printJson(wallet);
      } else {
        printText(`Address: ${wallet.address}`);
        printText(`Private key: ${wallet.privateKey}`);
      }
    });

  auth
    .command("status")
    .description("Show current authentication status")
    .option("--json", "Output as JSON")
    .action((opts) => {
      const config = loadConfig();
      const status = {
        address: config.address ?? null,
        apiUrl: config.recordingApiUrl,
        authenticated: Boolean(config.accessToken),
      };

      if (opts.json) {
        printJson(status);
      } else {
        if (status.authenticated) {
          printText(`Authenticated as ${status.address}`);
          printText(`API: ${status.apiUrl}`);
        } else {
          printText("Not authenticated. Run: hufi auth login --private-key <key>");
        }
      }
    });

  return auth;
}
