#!/usr/bin/env node

import { Command } from "commander";
import { createAuthCommand } from "./commands/auth.ts";
import { createExchangeCommand } from "./commands/exchange.ts";
import { createCampaignCommand } from "./commands/campaign.ts";
import { setKeyFile } from "./lib/config.ts";

const program = new Command();

program
  .name("hufi")
  .description("CLI tool for hu.fi DeFi platform")
  .version("0.5.1")
  .option("--key-file <path>", "Custom key file path (default: ~/.hufi-cli/key.json)")
  .hook("preAction", (thisCommand) => {
    const keyPath = thisCommand.opts().keyFile;
    if (keyPath) {
      setKeyFile(keyPath);
    }
  });

program.addCommand(createAuthCommand());
program.addCommand(createExchangeCommand());
program.addCommand(createCampaignCommand());

program.parse();
