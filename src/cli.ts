#!/usr/bin/env node

import { Command } from "commander";
import { createAuthCommand } from "./commands/auth.ts";
import { createExchangeCommand } from "./commands/exchange.ts";
import { createCampaignCommand } from "./commands/campaign.ts";

const BASH_COMPLETION = [
  "_hufi_completions() {",
  "  local cur prev commands",
  "  COMPREPLY=()",
  '  cur="${COMP_WORDS[COMP_CWORD]}"',
  '  prev="${COMP_WORDS[COMP_CWORD-1]}"',
  "",
  '  commands="auth exchange campaign completion help"',
  "",
  '  case "$prev" in',
  "    hufi)",
  '      COMPREPLY=( $(compgen -W "$commands" -- "$cur") )',
  "      return 0",
  "      ;;",
  "    auth)",
  '      COMPREPLY=( $(compgen -W "login generate status help" -- "$cur") )',
  "      return 0",
  "      ;;",
  "    exchange)",
  '      COMPREPLY=( $(compgen -W "register list help" -- "$cur") )',
  "      return 0",
  "      ;;",
  "    campaign)",
  '      COMPREPLY=( $(compgen -W "list get joined status join progress leaderboard help" -- "$cur") )',
  "      return 0",
  "      ;;",
  "  esac",
  "",
  '  COMPREPLY=( $(compgen -W "--help --version --json" -- "$cur") )',
  "  return 0",
  "}",
  "",
  "complete -F _hufi_completions hufi",
].join("\n");

const ZSH_COMPLETION = [
  "#compdef hufi",
  "",
  "_hufi() {",
  "  local -a commands",
  "  commands=(",
  "    'auth:Authentication commands'",
  "    'exchange:Exchange API key management'",
  "    'campaign:Campaign management'",
  "    'completion:Generate shell completion script'",
  "    'help:Display help'",
  "  )",
  "",
  "  _arguments -C \\",
  "    '1:command:->command' \\",
  "    '*::arg:->args'",
  "",
  "  case $state in",
  "    command)",
  "      _describe 'command' commands",
  "      ;;",
  "    args)",
  "      case ${words[1]} in",
  "        auth)",
  "          _arguments \\",
  "            '1:subcommand:(login generate status help)'",
  "          ;;",
  "        exchange)",
  "          _arguments \\",
  "            '1:subcommand:(register list help)'",
  "          ;;",
  "        campaign)",
  "          _arguments \\",
  "            '1:subcommand:(list get joined status join progress leaderboard help)'",
  "          ;;",
  "      esac",
  "      ;;",
  "  esac",
  "}",
  "",
  '_hufi "$@"',
].join("\n");

const FISH_COMPLETION = [
  "# hufi completions for fish",
  "complete -c hufi -f",
  "",
  "# Top-level commands",
  "complete -c hufi -n '__fish_use_subcommand' -a auth -d 'Authentication commands'",
  "complete -c hufi -n '__fish_use_subcommand' -a exchange -d 'Exchange API key management'",
  "complete -c hufi -n '__fish_use_subcommand' -a campaign -d 'Campaign management'",
  "complete -c hufi -n '__fish_use_subcommand' -a completion -d 'Generate shell completion script'",
  "",
  "# auth subcommands",
  "complete -c hufi -n '__fish_seen_subcommand_from auth' -a login -d 'Authenticate with private key'",
  "complete -c hufi -n '__fish_seen_subcommand_from auth' -a generate -d 'Generate a new wallet'",
  "complete -c hufi -n '__fish_seen_subcommand_from auth' -a status -d 'Show auth status'",
  "",
  "# exchange subcommands",
  "complete -c hufi -n '__fish_seen_subcommand_from exchange' -a register -d 'Register exchange API key'",
  "complete -c hufi -n '__fish_seen_subcommand_from exchange' -a list -d 'List exchange API keys'",
  "",
  "# campaign subcommands",
  "complete -c hufi -n '__fish_seen_subcommand_from campaign' -a list -d 'List available campaigns'",
  "complete -c hufi -n '__fish_seen_subcommand_from campaign' -a get -d 'Get campaign details'",
  "complete -c hufi -n '__fish_seen_subcommand_from campaign' -a joined -d 'List joined campaigns'",
  "complete -c hufi -n '__fish_seen_subcommand_from campaign' -a status -d 'Check join status'",
  "complete -c hufi -n '__fish_seen_subcommand_from campaign' -a join -d 'Join a campaign'",
  "complete -c hufi -n '__fish_seen_subcommand_from campaign' -a progress -d 'Check your progress'",
  "complete -c hufi -n '__fish_seen_subcommand_from campaign' -a leaderboard -d 'View leaderboard'",
  "",
  "# Global options",
  "complete -c hufi -l help -d 'Show help'",
  "complete -c hufi -l version -d 'Show version'",
  "complete -c hufi -l json -d 'Output as JSON'",
].join("\n");

const program = new Command();

program
  .name("hufi")
  .description("CLI tool for hu.fi DeFi platform")
  .version("0.5.1");

program
  .command("completion")
  .description("Generate shell completion script")
  .option("--bash", "Bash completion (default)")
  .option("--zsh", "Zsh completion")
  .option("--fish", "Fish completion")
  .action((opts) => {
    if (opts.zsh) {
      console.log(ZSH_COMPLETION);
    } else if (opts.fish) {
      console.log(FISH_COMPLETION);
    } else {
      console.log(BASH_COMPLETION);
    }
  });

program.addCommand(createAuthCommand());
program.addCommand(createExchangeCommand());
program.addCommand(createCampaignCommand());

program.parse();
