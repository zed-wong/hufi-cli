import { describe, expect, test } from "bun:test";
import { createStakingCommand } from "./staking.ts";

describe("staking command UX", () => {
  test("stake help prefers positional amount", () => {
    const stake = createStakingCommand().commands.find(
      (command) => command.name() === "stake"
    );

    expect(stake).toBeDefined();
    expect(stake?.helpInformation()).toContain("staking stake [amount]");
  });

  test("unstake help prefers positional amount", () => {
    const unstake = createStakingCommand().commands.find(
      (command) => command.name() === "unstake"
    );

    expect(unstake).toBeDefined();
    expect(unstake?.helpInformation()).toContain("staking unstake [amount]");
  });
});
