#!/usr/bin/env node

import { Command } from "commander";
import { createAuthCommand } from "./commands/auth.ts";
import { createExchangeCommand } from "./commands/exchange.ts";
import { createCampaignCommand } from "./commands/campaign.ts";
import { createStakingCommand } from "./commands/staking.ts";
import { createDashboardCommand } from "./commands/dashboard.ts";
import { loadConfig, setConfigFile, setKeyFile, validateConfig } from "./lib/config.ts";

const program = new Command();

program
  .name("hufi")
  .description("CLI tool for hu.fi DeFi platform")
  .version("0.8.1")
  .option("--config-file <path>", "Custom config file path (default: ~/.hufi-cli/config.json)")
  .option("--key-file <path>", "Custom key file path (default: ~/.hufi-cli/key.json)")
  .hook("preAction", (thisCommand) => {
    const opts = thisCommand.opts();
    if (opts.configFile) {
      setConfigFile(opts.configFile);
    }
    if (opts.keyFile) {
      setKeyFile(opts.keyFile);
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

program.parse();
