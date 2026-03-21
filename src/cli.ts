#!/usr/bin/env node

import { Command } from "commander";
import { createAuthCommand } from "./commands/auth.ts";
import { createExchangeCommand } from "./commands/exchange.ts";
import { createCampaignCommand } from "./commands/campaign.ts";
import { createLauncherCommand } from "./commands/launcher.ts";

const program = new Command();

program
  .name("hufi")
  .description("CLI tool for hu.fi DeFi platform")
  .version("0.1.0");

program.addCommand(createAuthCommand());
program.addCommand(createExchangeCommand());
program.addCommand(createCampaignCommand());
program.addCommand(createLauncherCommand());

program.parse();
