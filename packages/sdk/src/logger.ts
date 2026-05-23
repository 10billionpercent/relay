import type { InferenceLog, LogBatchRequest } from "@relay/shared";

export class LogBatcher {
  private buffer: InferenceLog[] = [];
  private flushInterval: NodeJS.Timeout | null = null;
  private ingestionEndpoint: string;
  private maxBatchSize: number;
  private maxRetries: number = 3;
  private retryDelay: number = 1000; //meow

  constructor(
    ingestionEndpoint: string,
    flushIntervalMs = 5000,
    maxBatchSize = 10,
  ) {
    this.ingestionEndpoint = ingestionEndpoint;
    this.maxBatchSize = maxBatchSize;
    this.flushInterval = setInterval(() => this.flush(), flushIntervalMs);
  }

  async addLog(log: InferenceLog): Promise<void> {
    this.buffer.push(log);

    // Flush if buffer reaches max size
    if (this.buffer.length >= this.maxBatchSize) {
      await this.flush();
    }
  }

  async flush(): Promise<void> {
    if (this.buffer.length === 0) return;

    const batch = [...this.buffer];
    this.buffer = [];

    let retries = 0;
    while (retries < this.maxRetries) {
      try {
        const response = await fetch(
          `${this.ingestionEndpoint}/api/ingest/batch`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ logs: batch } as LogBatchRequest),
          },
        );

        if (response.ok) {
          return; // Success
        }

        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      } catch (error) {
        retries++;
        console.error(`Log flush attempt ${retries} failed:`, error);

        if (retries < this.maxRetries) {
          await new Promise((resolve) =>
            setTimeout(resolve, this.retryDelay * retries),
          );
        } else {
          // On final failure, add logs back to buffer
          console.error("Max retries reached, re-queueing logs");
          this.buffer.unshift(...batch);
        }
      }
    }
  }

  destroy(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
    // Final flush attempt
    this.flush().catch(console.error);
  }
}
