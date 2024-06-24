// src/managers/ServerManager.ts

import axios from "axios";
import apiServers from "../config/apiServers";

export interface ServerStatus {
    name: string;
    url: string;
    isOnline: boolean;
    currentCheckpoint: string | null;
    isBusy: boolean;
    checkpoints: string[];
    loras: string[];
}

interface CheckpointInfo {
    name: string;
    servers: string[];
}

class ServerManager {
    private servers: ServerStatus[];

    constructor() {
        this.servers = apiServers.map((server) => ({
            ...server,
            isOnline: false,
            currentCheckpoint: null,
            isBusy: false,
        }));
    }

    async initialize() {
        await this.updateServerStatus();
        setInterval(() => this.updateServerStatus(), 20000);
    }

    private async updateServerStatus() {
        console.log("Updating server status...");
        for (const server of this.servers) {
            try {
                const response = await axios.get(
                    `${server.url}/sdapi/v1/options`,
                    {
                        timeout: 5000,
                    },
                );
                server.isOnline = true;
                server.currentCheckpoint = this.normalizeCheckpointName(
                    response.data.sd_model_checkpoint,
                );
                server.isBusy = false; // Reset busy status
                console.log(
                    `Server ${server.name} is online. Current checkpoint: ${server.currentCheckpoint}`,
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

    getServerForCheckpoint(checkpoint: string | null) {
        const normalizedCheckpoint = this.normalizeCheckpointName(checkpoint);
        console.log(
            `Searching for server with checkpoint: ${normalizedCheckpoint}`,
        );
        const availableServers = this.getAvailableServers();
        console.log(
            `Available servers: ${availableServers.map((s) => s.name).join(", ")}`,
        );

        // First, try to find a non-busy server with the correct checkpoint
        const server = availableServers.find(
            (s) => s.currentCheckpoint === normalizedCheckpoint && !s.isBusy,
        );

        if (server) {
            console.log(
                `Found non-busy server ${server.name} for checkpoint ${normalizedCheckpoint}`,
            );
            return server;
        }

        // If all servers with the checkpoint are busy, return the first one that matches the checkpoint
        const busyServer = availableServers.find(
            (s) => s.currentCheckpoint === normalizedCheckpoint,
        );

        if (busyServer) {
            console.log(
                `All servers with checkpoint ${normalizedCheckpoint} are busy. Returning ${busyServer.name}`,
            );
            return busyServer;
        }

        console.log(`No server found for checkpoint ${normalizedCheckpoint}`);
        return null;
    }

    releaseServer(serverName: string) {
        const server = this.servers.find((s) => s.name === serverName);
        if (server) {
            server.isBusy = false;
            console.log(`Released server ${serverName}`);
        } else {
            console.log(
                `Attempted to release non-existent server ${serverName}`,
            );
        }
    }

    getAvailableServerWithAnyCheckpoint() {
        console.log(
            "Searching for any available server with a loaded checkpoint",
        );
        const availableServers = this.getAvailableServers();
        console.log(
            `Available servers: ${availableServers.map((s) => s.name).join(", ")}`,
        );

        // First, try to find a non-busy server
        const server = availableServers.find(
            (s) => !s.isBusy && s.currentCheckpoint,
        );

        if (server) {
            console.log(
                `Found non-busy server ${server.name} with checkpoint ${server.currentCheckpoint}`,
            );
            server.isBusy = true;
            return server;
        }

        // If all servers are busy, return the first one with a loaded checkpoint
        const busyServer = availableServers.find((s) => s.currentCheckpoint);

        if (busyServer) {
            console.log(
                `All servers are busy. Returning ${busyServer.name} with checkpoint ${busyServer.currentCheckpoint}`,
            );
            return busyServer;
        }

        console.log("No server found with a loaded checkpoint");
        return null;
    }

    setServerBusy(serverName: string, isBusy: boolean) {
        const server = this.servers.find((s) => s.name === serverName);
        if (server) {
            server.isBusy = isBusy;
            console.log(`Set server ${serverName} busy status to ${isBusy}`);
        } else {
            console.log(
                `Attempted to set busy status for non-existent server ${serverName}`,
            );
        }
    }

    getAvailableCheckpoints(): CheckpointInfo[] {
        const checkpointMap = new Map<string, string[]>();

        for (const server of this.getAvailableServers()) {
            for (const checkpoint of server.checkpoints) {
                const normalizedCheckpoint =
                    this.normalizeCheckpointName(checkpoint);
                if (!normalizedCheckpoint) {
                    continue;
                }
                const servers = checkpointMap.get(normalizedCheckpoint) || [];
                if (!servers.includes(server.name)) {
                    servers.push(server.name);
                }
                checkpointMap.set(normalizedCheckpoint, servers);
            }
        }

        const checkpoints = Array.from(checkpointMap.entries()).map(
            ([name, servers]) => ({
                name,
                servers,
            }),
        );

        console.log("Available checkpoints:", checkpoints);
        return checkpoints;
    }

    private normalizeCheckpointName(
        checkpoint: string | null | undefined,
    ): string | null {
        // Remove file extensions and version hashes
        return checkpoint?.split(".")[0]?.split("[")[0]?.trim() || null;
    }

    logServerStatus() {
        console.log("Current server status:");
        for (const server of this.servers) {
            console.log(
                `- ${server.name}: Online: ${server.isOnline}, Checkpoint: ${server.currentCheckpoint}, Busy: ${server.isBusy}`,
            );
        }
    }
}

export default new ServerManager();
