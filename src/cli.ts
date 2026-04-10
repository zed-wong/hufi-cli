#!/usr/bin/env node

import { Command } from "commander";
import { createAuthCommand, printAuthList } from "./commands/auth.ts";
import { createExchangeCommand } from "./commands/exchange.ts";
import { createCampaignCommand } from "./commands/campaign.ts";
import { createStakingCommand } from "./commands/staking.ts";
import { createDashboardCommand } from "./commands/dashboard.ts";
import { loadConfig, setConfigFile, setKeyFile, setProfile, validateConfig } from "./lib/config.ts";

const program = new Command();

program
  .name("hufi")
  .description("CLI tool for Hu.fi platform")
  .version("1.0.3")
  .option("--config-file <path>", "Custom config file path (default: ~/.hufi-cli/config.json)")
  .option("--key-file <path>", "Custom key file path (default: ~/.hufi-cli/key.json)")
  .option("-p, --profile [name]", "Profile to use for keys and auth state")
    .hook("preAction", (_, actionCommand) => {
    const opts = actionCommand.optsWithGlobals();
    if (opts.configFile) {
      setConfigFile(opts.configFile);
    }
    if (opts.keyFile) {
      setKeyFile(opts.keyFile);
    }
    if (opts.profile) {
      setProfile(opts.profile);
    }

    const validation = validateConfig(loadConfig());
    if (!validation.valid) {
      console.error("Invalid configuration:");
      for (const issue of validation.issues) {
        console.error(`- ${issue}`);
      }
      console.error("Fix config in ~/.hufi-cli/config.json or pass --config-file.");
      process.exit(1);
    }
  });

program.addCommand(createAuthCommand());
program.addCommand(createExchangeCommand());
program.addCommand(createCampaignCommand());
program.addCommand(createStakingCommand());
program.addCommand(createDashboardCommand());

const args = process.argv.slice(2);
const commandNames = new Set(["auth", "exchange", "campaign", "staking", "dashboard", "help"]);
const bareProfileArgCount = args.filter((arg) => arg === "-p" || arg === "--profile").length;
const controlFlagCount = args.filter((arg) => arg === "--json" || arg === "--config-file" || arg === "--key-file").length;
const bareProfileRequested =
  bareProfileArgCount === 1 &&
  args.length >= 1 &&
  !args.some((arg, index) => {
    if (arg !== "-p" && arg !== "--profile") return false;
    const next = args[index + 1];
    return next && !next.startsWith("-") && !commandNames.has(next);
  }) &&
  args.length <= bareProfileArgCount + controlFlagCount + (args.includes("--config-file") ? 1 : 0) + (args.includes("--key-file") ? 1 : 0);

if (bareProfileRequested) {
  const configIndex = args.indexOf("--config-file");
  const configPath = configIndex >= 0 ? args[configIndex + 1] : undefined;
  if (configPath) {
    setConfigFile(configPath);
  }
  const keyIndex = args.indexOf("--key-file");
  const keyPath = keyIndex >= 0 ? args[keyIndex + 1] : undefined;
  if (keyPath) {
    setKeyFile(keyPath);
  }
  printAuthList(false);
  process.exit(0);
}

program.parse(process.argv);
