import { Command } from "commander";
import { authenticate, createWallet } from "../services/recording/auth.ts";
import { loadConfig, updateConfig, saveKey, loadKey, getKeyPath, keyExists } from "../lib/config.ts";
import { printJson, printText } from "../lib/output.ts";

export function createAuthCommand(): Command {
  const auth = new Command("auth").description("Authentication commands");

  auth
    .command("login")
    .description("Authenticate with Recording Oracle using a private key")
    .option("-k, --private-key <key>", "EVM private key (uses saved key if not provided)")
    .option("-u, --api-url <url>", "Recording Oracle API URL")
    .option("--json", "Output as JSON")
    .action(async (opts) => {
      const privateKey = opts.privateKey ?? loadKey();
      if (!privateKey) {
        printText("No private key provided. Run: hufi auth login -k <key> or hufi auth generate");
        process.exit(1);
      }
      const config = loadConfig();
      const baseUrl = (opts.apiUrl ?? config.recordingApiUrl).replace(
        /\/+$/,
        ""
      );

      try {
        const result = await authenticate(baseUrl, privateKey);

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
    .action(async (opts) => {
      if (keyExists()) {
        if (!opts.json) {
          printText(`Key already exists at ${getKeyPath()}. Overwrite? (y/N)`);
          const answer = await new Promise<string>((resolve) => {
            process.stdin.once("data", (data) => resolve(data.toString().trim().toLowerCase()));
          });
          if (answer !== "y") {
            printText("Cancelled.");
            return;
          }
        }
      }
      const wallet = createWallet();
      saveKey(wallet.privateKey, wallet.address);
      const keyPath = getKeyPath();
      if (opts.json) {
        printJson({ address: wallet.address, keyPath });
      } else {
        printText(`Address: ${wallet.address}`);
        printText(`Private key saved to ${keyPath}`);
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
