#!/usr/bin/env node

import { Command } from "commander";
import { createAuthCommand } from "./commands/auth.ts";
import { createExchangeCommand } from "./commands/exchange.ts";
import { createCampaignCommand } from "./commands/campaign.ts";
import { createStakingCommand } from "./commands/staking.ts";
import { setConfigFile, setKeyFile } from "./lib/config.ts";

const program = new Command();

program
  .name("hufi")
  .description("CLI tool for hu.fi DeFi platform")
  .version("0.6.0")
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
  });

program.addCommand(createAuthCommand());
program.addCommand(createExchangeCommand());
program.addCommand(createCampaignCommand());
program.addCommand(createStakingCommand());

program.parse();
