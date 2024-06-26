import type {
    ImageGenerationParams,
    StatusUpdate,
} from "../api/StableDiffusionClient";
import { GuildMember } from "discord.js";

export interface QueuedRequest {
    params: ImageGenerationParams;
    checkpoint: string | null;
    resolve: (value: string) => void;
    reject: (reason?: unknown) => void;
    onStatusUpdate: (update: StatusUpdate) => Promise<void>;
    member: GuildMember;
    priority: number;
    timestamp: number;
}

class RequestQueue {
    private queue: QueuedRequest[] = [];

    enqueue(request: QueuedRequest): void {
        const index = this.queue.findIndex(item => item.priority < request.priority);
        if (index === -1) {
            this.queue.push(request);
        } else {
            this.queue.splice(index, 0, request);
        }
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

    getQueuePosition(userId: string): number {
        return this.queue.findIndex(request => request.member.id === userId);
    }
}

export default new RequestQueue();