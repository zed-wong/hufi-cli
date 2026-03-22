interface WatchOptions {
  intervalMs?: number;
  shouldContinue?: () => boolean;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runWatchLoop(
  fn: () => Promise<void>,
  options: WatchOptions = {}
): Promise<void> {
  const intervalMs = options.intervalMs ?? 10_000;
  const shouldContinue = options.shouldContinue ?? (() => true);

  while (shouldContinue()) {
    await fn();
    if (!shouldContinue()) {
      break;
    }
    await sleep(intervalMs);
  }
}
