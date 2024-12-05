import { Connection } from "@solana/web3.js";

import { GqlClient } from "@tub/gql";
import { MAX_BATCH_SIZE, MIN_BATCH_FREQUENCY } from "@/lib/constants";
import { Swap } from "@/lib/types";
import { fetchPriceAndMetadata, upsertTrades } from "@/lib/utils";

export class BatchManager {
  private batch: Swap[] = [];
  private lastProcessTime: number = 0;
  private processing: boolean = false;
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private gql: GqlClient["db"],
    private connection: Connection,
  ) {
    // Start the timer to check for processing needs periodically
    this.timer = setInterval(() => {
      this.processIfNeeded();
    }, MIN_BATCH_FREQUENCY);
  }

  async add(swaps: Swap[]) {
    this.batch.push(...swaps);
    await this.processIfNeeded();
  }

  private async processIfNeeded() {
    if (this.processing || this.batch.length === 0) return;

    const now = Date.now();
    const shouldProcessTime = this.lastProcessTime === 0 || now - this.lastProcessTime >= MIN_BATCH_FREQUENCY;
    const shouldProcessSize = this.batch.length >= MAX_BATCH_SIZE;

    if (shouldProcessTime || shouldProcessSize) {
      this.processing = true;
      const batchToProcess = this.batch.splice(0, MAX_BATCH_SIZE);
      const oldestSwapTime = Math.min(...batchToProcess.map((swap) => swap.timestamp));

      try {
        const SwapWithPriceAndMetadata = await fetchPriceAndMetadata(this.connection, batchToProcess);
        const res = await upsertTrades(this.gql, SwapWithPriceAndMetadata);
        if (res.error) throw res.error.message;

        this.lastProcessTime = Date.now();
        const latency = ((Date.now() - oldestSwapTime) / 1000).toFixed(2);
        console.log(`[${latency}s] Processed batch of ${res.data?.insert_trade_history?.affected_rows} swaps`);
      } catch (error) {
        console.error("Error processing batch:", error);
        // On error, add failed items back at the start of the batch
        this.batch.unshift(...batchToProcess);
      } finally {
        this.processing = false;
      }
    }
  }

  cleanup() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
