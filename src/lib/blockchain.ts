export interface WaitTxOptions {
  minConfirmations?: number;
  pollMs?: number;
  timeoutMs?: number;
  onProgress?: (confirmations: number) => void;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface ReceiptLike {
  confirmations?: number | (() => Promise<number>);
  hash?: string;
  logs?: readonly unknown[];
}

interface ProviderLike {
  getTransactionReceipt(txHash: string): Promise<ReceiptLike | null>;
}

export async function waitForConfirmations(
  provider: ProviderLike,
  txHash: string,
  opts: WaitTxOptions = {}
): Promise<ReceiptLike> {
  const minConfirmations = opts.minConfirmations ?? 1;
  const pollMs = opts.pollMs ?? 3_000;
  const timeoutMs = opts.timeoutMs ?? 120_000;
  const started = Date.now();

  while (Date.now() - started <= timeoutMs) {
    const receipt = await provider.getTransactionReceipt(txHash);
    if (!receipt) {
      await sleep(pollMs);
      continue;
    }

    let confirmations = 0;
    if (typeof receipt.confirmations === "function") {
      confirmations = await receipt.confirmations();
    } else {
      confirmations = receipt.confirmations ?? 0;
    }

    opts.onProgress?.(confirmations);

    if (confirmations >= minConfirmations) {
      return receipt;
    }
    await sleep(pollMs);
  }

  throw new Error(`Timed out waiting for transaction confirmation: ${txHash}`);
}

export function estimateGasWithBuffer(estimated: bigint, bps = 1200): bigint {
  return (estimated * BigInt(10_000 + bps)) / BigInt(10_000);
}
