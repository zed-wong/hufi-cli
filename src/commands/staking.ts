import { Command } from "commander";
import { getStakingInfo, stakeHMT, unstakeHMT, withdrawHMT } from "../services/staking.ts";
import { loadConfig, getDefaultChainId, loadKey } from "../lib/config.ts";
import { printJson, printText } from "../lib/output.ts";

function requireKey(): string {
  const key = loadKey();
  if (!key) {
    printText("No private key found. Run: hufi auth generate");
    process.exit(1);
  }
  return key;
}

export function createStakingCommand(): Command {
  const staking = new Command("staking").description(
    "HMT staking management"
  );

  const statusCmd = staking
    .command("status")
    .description("Check staking status for an address")
    .option("-c, --chain-id <id>", "Chain ID (default: from config)", Number, getDefaultChainId())
    .option("-a, --address <address>", "Wallet address (default: from config)")
    .option("--json", "Output as JSON")
    .action(async (opts) => {
      const config = loadConfig();
      const address = opts.address ?? config.address;
      if (!address) {
        statusCmd.help();
        return;
      }

      try {
        const info = await getStakingInfo(address, opts.chainId);

        if (opts.json) {
          printJson(info);
        } else {
          printText(`Staking status (chain ${info.chainId}):`);
          printText(`  Address:         ${address}`);
          printText(`  HMT Balance:     ${Number(info.hmtBalance).toLocaleString()} HMT`);
          printText(`  Staked:          ${Number(info.stakedTokens).toLocaleString()} HMT`);
          printText(`  Available:       ${Number(info.availableStake).toLocaleString()} HMT`);
          printText(`  Locked:          ${Number(info.lockedTokens).toLocaleString()} HMT`);
          if (Number(info.lockedTokens) > 0 && info.unlockBlock > 0) {
            printText(`  Unlock block:    ${info.unlockBlock}`);
          }
          printText(`  Min stake:       ${Number(info.minimumStake).toLocaleString()} HMT`);
          printText(`  Lock period:     ${info.lockPeriod} blocks`);
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        printText(`Failed to get staking info: ${message}`);
        process.exitCode = 1;
      }
    });

  staking
    .command("stake")
    .description("Stake HMT tokens")
    .requiredOption("-a, --amount <amount>", "Amount of HMT to stake")
    .option("-c, --chain-id <id>", "Chain ID (default: from config)", Number, getDefaultChainId())
    .option("--json", "Output as JSON")
    .action(async (opts) => {
      const privateKey = requireKey();

      try {
        printText(`Staking ${opts.amount} HMT on chain ${opts.chainId}...`);
        const hash = await stakeHMT(privateKey, opts.amount, opts.chainId);

        if (opts.json) {
          printJson({ txHash: hash });
        } else {
          printText(`Staked successfully.`);
          printText(`TX: ${hash}`);
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        printText(`Failed to stake: ${message}`);
        process.exitCode = 1;
      }
    });

  staking
    .command("unstake")
    .description("Initiate unstaking (tokens will be locked for the lock period)")
    .requiredOption("-a, --amount <amount>", "Amount of HMT to unstake")
    .option("-c, --chain-id <id>", "Chain ID (default: from config)", Number, getDefaultChainId())
    .option("--json", "Output as JSON")
    .action(async (opts) => {
      const privateKey = requireKey();

      try {
        printText(`Unstaking ${opts.amount} HMT on chain ${opts.chainId}...`);
        const hash = await unstakeHMT(privateKey, opts.amount, opts.chainId);

        if (opts.json) {
          printJson({ txHash: hash });
        } else {
          printText(`Unstake initiated. Tokens are locked until the lock period ends.`);
          printText(`TX: ${hash}`);
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        printText(`Failed to unstake: ${message}`);
        process.exitCode = 1;
      }
    });

  staking
    .command("withdraw")
    .description("Withdraw unlocked tokens after the lock period")
    .option("-c, --chain-id <id>", "Chain ID (default: from config)", Number, getDefaultChainId())
    .option("--json", "Output as JSON")
    .action(async (opts) => {
      const privateKey = requireKey();

      try {
        printText(`Withdrawing unlocked HMT on chain ${opts.chainId}...`);
        const hash = await withdrawHMT(privateKey, opts.chainId);

        if (opts.json) {
          printJson({ txHash: hash });
        } else {
          printText(`Withdraw successful.`);
          printText(`TX: ${hash}`);
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        printText(`Failed to withdraw: ${message}`);
        process.exitCode = 1;
      }
    });

  return staking;
}
