// src/managers/RateLimitManager.ts

import { Collection, Snowflake } from "discord.js";

interface RateLimitInfo {
    lastUsage: number;
    usageCount: number;
}

export default class RateLimitManager {
    private limits: Collection<Snowflake, RateLimitInfo> = new Collection();
    private readonly maxUsages: number;
    private readonly timeWindow: number;
    private cleanupInterval: NodeJS.Timeout;

    constructor(maxUsages: number, timeWindowSeconds: number) {
        this.maxUsages = maxUsages;
        this.timeWindow = timeWindowSeconds * 1000; // Convert to milliseconds
        this.cleanupInterval = setInterval(() => this.cleanup(), this.timeWindow);
    }

    checkRateLimit(userId: Snowflake): boolean {
        const now = Date.now();
        const userLimit = this.limits.get(userId) || { lastUsage: 0, usageCount: 0 };

        if (now - userLimit.lastUsage > this.timeWindow) {
            // Reset if the time window has passed
            userLimit.usageCount = 1;
            userLimit.lastUsage = now;
        } else if (userLimit.usageCount < this.maxUsages) {
            // Increment usage count if within limits
            userLimit.usageCount++;
        } else {
            // Rate limit exceeded
            return false;
        }

        this.limits.set(userId, userLimit);
        return true;
    }

    getRemainingCooldown(userId: Snowflake): number {
        const userLimit = this.limits.get(userId);
        if (!userLimit || userLimit.usageCount < this.maxUsages) {
            return 0;
        }
        const elapsed = Date.now() - userLimit.lastUsage;
        return Math.max(0, this.timeWindow - elapsed);
    }

    private cleanup(): void {
        const now = Date.now();
        this.limits.sweep((limit) => now - limit.lastUsage > this.timeWindow);
    }

    // Call this method when shutting down the bot to prevent memory leaks
    destroy(): void {
        clearInterval(this.cleanupInterval);
    }
}