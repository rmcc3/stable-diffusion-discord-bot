// src/managers/ServerManagerBase.ts

import axios from "axios";

export interface ServerStatus {
    name: string;
    url: string;
    isOnline: boolean;
    currentCheckpoint: string | null;
    isBusy: boolean;
    checkpoints: string[];
    loras: string[];
}

export interface APIServer {
    name: string;
    url: string;
    checkpoints: string[];
    loras: string[];
}

export default class ServerManagerBase {
    protected servers: ServerStatus[];

    constructor(apiServers: APIServer[]) {
        this.servers = apiServers.map((server): ServerStatus => ({
            ...server,
            isOnline: false,
            currentCheckpoint: null,
            isBusy: false,
        }));
    }

    async initialize(): Promise<void> {
        await this.updateServerStatus();
        setInterval(() => this.updateServerStatus(), 20000);
    }

    protected async updateServerStatus() {
        console.log("Updating server status...");
        for (const server of this.servers) {
            try {
                const response = await axios.get(
                    `${server.url}/sdapi/v1/options`,
                    { timeout: 5000 }
                );
                server.isOnline = true;
                server.currentCheckpoint = this.normalizeCheckpointName(
                    response.data.sd_model_checkpoint
                );
                server.isBusy = false;
                console.log(
                    `Server ${server.name} is online. Current checkpoint: ${server.currentCheckpoint}`
                );
            } catch (error) {
                server.isOnline = false;
                server.currentCheckpoint = null;
                server.isBusy = false;
                console.log(`Server ${server.name} is offline.`);
            }
        }
    }

    getAvailableServers() {
        return this.servers.filter((server) => server.isOnline);
    }

    protected normalizeCheckpointName(
        checkpoint: string | null | undefined
    ): string | null {
        return checkpoint?.split(".")[0]?.split("[")[0]?.trim() || null;
    }

    setServerBusy(serverName: string, isBusy: boolean) {
        const server = this.servers.find((s) => s.name === serverName);
        if (server) {
            server.isBusy = isBusy;
            console.log(`Set server ${serverName} busy status to ${isBusy}`);
        } else {
            console.log(
                `Attempted to set busy status for non-existent server ${serverName}`
            );
        }
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