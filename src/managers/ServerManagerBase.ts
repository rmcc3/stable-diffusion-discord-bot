// src/managers/ServerManagerBase.ts

import axios from "axios";
import express from "express";

export interface ServerStatus {
    name: string;
    url: string;
    isOnline: boolean;
    currentCheckpoint: string | null;
    isBusy: boolean;
    checkpoints: string[];
    loras: string[];
    hasControlNet: boolean;
    extensions: ExtensionInfo[];
}

export interface APIServer {
    name: string;
    url: string;
    checkpoints: string[];
    loras: string[];
}

interface ExtensionInfo {
    name: string;
    enabled: boolean;
    version: string;
}

type ServerStatusCallback = (server: ServerStatus) => void;

export default class ServerManagerBase {
    protected servers: ServerStatus[];
    private app: express.Express;
    private updateInterval: NodeJS.Timeout | null = null;
    private statusCallbacks: ServerStatusCallback[] = [];

    constructor(apiServers: APIServer[]) {
        this.servers = apiServers.map((server): ServerStatus => ({
            ...server,
            isOnline: false,
            currentCheckpoint: null,
            isBusy: false,
            hasControlNet: false,
            extensions: [],
        }));
        this.app = express();
        this.setupWebhookEndpoint();
    }

    onServerStatusChanged(callback: ServerStatusCallback): void {
        this.statusCallbacks.push(callback);
    }

    async initialize(): Promise<void> {
        await this.updateAllServerStatuses();
        this.startPeriodicUpdates(5 * 60 * 1000); // Update every 5 minutes
        this.startWebhookServer();
    }

    private setupWebhookEndpoint(): void {
        this.app.post('/server-status', express.json(), (req, res) => {
            const { name, status } = req.body;
            this.updateServerStatus(name, status);
            res.sendStatus(200);
        });
    }

    private startWebhookServer(): void {
        const port = process.env.WEBHOOK_PORT || 3000;
        this.app.listen(port, () => {
            console.log(`Webhook server listening on port ${port}`);
        });
    }

    private startPeriodicUpdates(interval: number): void {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }
        this.updateInterval = setInterval(() => this.updateAllServerStatuses(), interval);
    }

    async updateAllServerStatuses(): Promise<void> {
        console.log("Updating all server statuses...");
        await Promise.all(this.servers.map(server => this.checkServerStatus(server.name)));
    }

    async checkServerStatus(serverName: string): Promise<void> {
        const server = this.servers.find(s => s.name === serverName);
        if (!server) {
            console.log(`Server ${serverName} not found`);
            return;
        }

        try {
            const [optionsResponse, extensionsResponse] = await Promise.all([
                axios.get(`${server.url}/sdapi/v1/options`, { timeout: 5000 }),
                axios.get(`${server.url}/sdapi/v1/extensions`, { timeout: 5000 })
            ]);

            const extensions = extensionsResponse.data as ExtensionInfo[];
            const hasControlNet = extensions.some(ext => ext.name === "sd-webui-controlnet" && ext.enabled);

            this.updateServerStatus(serverName, {
                isOnline: true,
                currentCheckpoint: this.normalizeCheckpointName(optionsResponse.data.sd_model_checkpoint),
                hasControlNet: hasControlNet,
                extensions: extensions,
            });
        } catch (error) {
            this.updateServerStatus(serverName, {
                isOnline: false,
                currentCheckpoint: null,
                hasControlNet: false,
                extensions: [],
            });
        }
    }

    protected updateServerStatus(serverName: string, newStatus: Partial<ServerStatus>): void {
        const server = this.servers.find(s => s.name === serverName);
        if (server) {
            Object.assign(server, newStatus);
            console.log(`Updated status for ${serverName}:`, newStatus);
            this.notifyStatusChange(server);
        }
    }

    private notifyStatusChange(server: ServerStatus): void {
        for (const callback of this.statusCallbacks) {
            callback(server);
        }
    }

    getAvailableServers(): ServerStatus[] {
        return this.servers.filter((server) => server.isOnline);
    }

    protected normalizeCheckpointName(
        checkpoint: string | null | undefined
    ): string | null {
        if (checkpoint == null) return null;
        const normalized = checkpoint.split(".")[0]?.split("[")[0]?.trim();
        return normalized || null;
    }

    setServerBusy(serverName: string, isBusy: boolean): void {
        this.updateServerStatus(serverName, { isBusy });
    }

    logServerStatus(): void {
        console.log("Current server status:");
        for (const server of this.servers) {
            console.log(
                `- ${server.name}: Online: ${server.isOnline}, Checkpoint: ${server.currentCheckpoint}, Busy: ${server.isBusy}`
            );
        }
    }
}