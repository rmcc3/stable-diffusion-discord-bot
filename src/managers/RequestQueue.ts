// src/managers/RequestQueue.ts

import type {
  ImageGenerationParams,
  StatusUpdate,
} from "../api/StableDiffusionClient";

export interface QueuedRequest {
  params: ImageGenerationParams;
  checkpoint: string | null;
  resolve: (value: string) => void;
  reject: (reason?: unknown) => void;
  onStatusUpdate: (update: StatusUpdate) => Promise<void>;
}

class RequestQueue {
  private queue: QueuedRequest[] = [];

  enqueue(request: QueuedRequest) {
    this.queue.push(request);
  }

  dequeue(): QueuedRequest | undefined {
    return this.queue.shift();
  }

  isEmpty(): boolean {
    return this.queue.length === 0;
  }

  size(): number {
    return this.queue.length;
  }
}

export default new RequestQueue();
