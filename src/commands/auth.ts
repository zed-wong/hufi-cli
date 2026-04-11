import { Command } from "commander";
import { authenticate, createWallet } from "../services/recording/auth.ts";
import {
  loadConfig,
  updateConfig,
  updateProfile,
  saveKey,
  loadKey,
  getKeyPath,
  keyExists,
  getConfigPath,
  getSelectedProfileName,
  getActiveProfile,
  listLocalKeys,
} from "../lib/config.ts";
import { printJson, printText } from "../lib/output.ts";

function listProfiles() {
  const config = loadConfig();
  const activeProfile = config.activeProfile ?? getSelectedProfileName();
  const profileNames = Object.keys(config.profiles ?? {});
  const names = new Set(profileNames.length > 0 ? profileNames : [activeProfile]);
  names.add(activeProfile);

  return Array.from(names)
    .sort((a, b) => a.localeCompare(b))
    .map((name) => {
      const profile = config.profiles?.[name] ?? {};
      return {
        name,
        active: name === activeProfile,
        address: profile.address ?? null,
        authenticated: Boolean(profile.accessToken),
        keyPath: profile.keyFile ?? null,
      };
    });
}

function getAuthListData() {
  return {
    profiles: listProfiles(),
    localKeys: listLocalKeys(),
  };
}

export function printAuthList(json = false) {
  const result = getAuthListData();

  if (json) {
    printJson(result);
    return;
  }

  printText("Profiles");
  if (result.profiles.length === 0) {
    printText("  No auth profiles found.");
  } else {
    for (const profile of result.profiles) {
      const marker = profile.active ? "*" : " ";
      const status = profile.authenticated ? "authenticated" : "not authenticated";
      const address = profile.address ?? "-";
      printText(`${marker} ${profile.name}  ${status}  ${address}`);
      if (profile.keyPath) {
        printText(`    key: ${profile.keyPath}`);
      }
    }
  }

  printText("");
  printText("Local keys");
  if (result.localKeys.length === 0) {
    printText("  No local key files found.");
  } else {
    for (const key of result.localKeys) {
      printText(`  ${key.profile}  ${key.address ?? "-"}  ${key.keyPath}`);
    }
  }
}

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
        printText("No private key provided. Run: hufi-cli auth login -k <key> or hufi-cli auth generate");
        process.exit(1);
      }
      const config = loadConfig();
      const baseUrl = (opts.apiUrl ?? config.recordingApiUrl).replace(
        /\/+$/,
        ""
      );

      try {
        const result = await authenticate(baseUrl, privateKey);

        if (opts.privateKey) {
          saveKey(opts.privateKey, result.address);
        }

        updateConfig({ recordingApiUrl: baseUrl });
        updateProfile(getSelectedProfileName(), {
          address: result.address,
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
        });

        if (opts.json) {
          printJson({ profile: getSelectedProfileName(), address: result.address, accessToken: result.accessToken });
        } else {
          printText(`Authenticated profile '${getSelectedProfileName()}' as ${result.address}`);
          printText(`Private key loaded from ${getKeyPath()}`);
          printText(`Tokens saved to ${getConfigPath()}`);
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
            process.stdin.resume();
            process.stdin.once("data", (data) => {
              process.stdin.pause();
              resolve(data.toString().trim().toLowerCase());
            });
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
        printJson({ profile: getSelectedProfileName(), address: wallet.address, keyPath });
      } else {
        printText(`Profile: ${getSelectedProfileName()}`);
        printText(`Address: ${wallet.address}`);
        printText(`Private key saved to ${keyPath}`);
      }
    });

  auth
    .command("list")
    .description("List saved auth profiles and local key files")
    .option("--json", "Output as JSON")
    .action((opts) => {
      printAuthList(Boolean(opts.json));
    });

  auth
    .command("status")
    .description("Show current authentication status")
    .option("--json", "Output as JSON")
    .action((opts) => {
      const config = loadConfig();
      const profile = getActiveProfile();
      const status = {
        profile: getSelectedProfileName(),
        address: profile.address ?? config.address ?? null,
        apiUrl: config.recordingApiUrl,
        authenticated: Boolean(profile.accessToken),
      };

      if (opts.json) {
        printJson(status);
      } else {
        if (status.authenticated) {
          printText(`Profile: ${status.profile}`);
          printText(`Authenticated as ${status.address}`);
          printText(`API: ${status.apiUrl}`);
        } else {
          printText(`Profile: ${status.profile}`);
          printText(`Not authenticated. Run: hufi --profile ${status.profile} auth login -k <key>`);
        }
      }
    });

  return auth;
}
