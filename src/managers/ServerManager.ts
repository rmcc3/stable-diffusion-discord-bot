// src/managers/ServerManager.ts

import { Mutex } from 'async-mutex';
import ServerManagerBase, { ServerStatus, APIServer } from "./ServerManagerBase";
import apiServers from "../config/apiServers";

interface CheckpointInfo {
    name: string;
    servers: string[];
}

class ServerManager extends ServerManagerBase {
    private serverMutexes: Map<string, Mutex> = new Map();

    constructor() {
        super(apiServers);
        this.initializeMutexes();
        this.onServerStatusChanged(this.handleServerStatusChange.bind(this));
    }

    private initializeMutexes(): void {
        for (const server of this.servers) {
            this.serverMutexes.set(server.name, new Mutex());
        }
    }

    override async setServerBusy(serverName: string, isBusy: boolean): Promise<void> {
        const mutex = this.serverMutexes.get(serverName);
        if (!mutex) {
            throw new Error(`Mutex not found for server: ${serverName}`);
        }

        await mutex.acquire();
        try {
            super.setServerBusy(serverName, isBusy);
        } finally {
            mutex.release();
        }
    }

    handleServerStatusChange(server: ServerStatus): void {
        console.log(`Server ${server.name} status changed: ${server.isOnline ? "Online" : "Offline"}`);
    }

    getServerForCheckpoint(checkpoint: string | null): ServerStatus | null {
        const normalizedCheckpoint = this.normalizeCheckpointName(checkpoint);
        const availableServers = this.getAvailableServers();

        // Find a non-busy server with the correct checkpoint
        const server = availableServers.find(
            (s) => s.currentCheckpoint === normalizedCheckpoint && !s.isBusy
        );

        if (server) {
            return server;
        }

        // If no non-busy server found, return any server with the correct checkpoint
        const busyServer = availableServers.find(
            (s) => s.currentCheckpoint === normalizedCheckpoint
        );

        if (busyServer) {
            return busyServer;
        }
        return null;
    }

    getServersForCheckpoint(checkpoint: string | null): ServerStatus[] {
        const normalizedCheckpoint = this.normalizeCheckpointName(checkpoint);
        return this.getAvailableServers().filter(
            (s) => s.currentCheckpoint === normalizedCheckpoint
        );
    }

    getAvailableServerWithAnyCheckpoint(): ServerStatus | null {

        const availableServers = this.getAvailableServers();

        // First, try to find a non-busy server
        const server = availableServers.find(
            (s) => !s.isBusy && s.currentCheckpoint
        );

        if (server) {
            return server;
        }

        // If all servers are busy, return the first one with a loaded checkpoint
        const busyServer = availableServers.find((s) => s.currentCheckpoint);

        if (busyServer) {
            return busyServer;
        }
        return null;
    }

    getAvailableCheckpoints(): CheckpointInfo[] {
        const checkpointMap = new Map<string, string[]>();

        for (const server of this.getAvailableServers()) {
            for (const checkpoint of server.checkpoints) {
                const normalizedCheckpoint = this.normalizeCheckpointName(checkpoint);
                if (!normalizedCheckpoint) continue;
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
            })
        );

        return checkpoints;
    }

    getAvailableControlNetModels(module?: string): string[] {
        const availableServers = this.getAvailableServers();
        const allModels = availableServers.flatMap(server => server.controlNetModels);
        const uniqueModels = [...new Set(allModels)]; // Remove duplicates

        if (module) {
            return uniqueModels.filter(model =>
                model.toLowerCase().includes(module.toLowerCase())
            );
        }

        return uniqueModels;
    }

    getServerForCheckpointWithControlNet(checkpoint: string | null): ServerStatus | null {
        const normalizedCheckpoint = this.normalizeCheckpointName(checkpoint);

        const availableServers = this.getAvailableServers();

        // Find a non-busy server with the correct checkpoint and ControlNet support
        const server = availableServers.find(
            (s) => s.currentCheckpoint === normalizedCheckpoint && !s.isBusy && s.hasControlNet
        );

        if (server) {
            return server;
        }

        // If no non-busy server found, return any server with the correct checkpoint and ControlNet support
        const busyServer = availableServers.find(
            (s) => s.currentCheckpoint === normalizedCheckpoint && s.hasControlNet
        );

        if (busyServer) {
            return busyServer;
        }
        return null;
    }

    getAvailableServerWithControlNet(): ServerStatus | null {

        const availableServers = this.getAvailableServers();

        // First, try to find a non-busy server with ControlNet support
        const server = availableServers.find(
            (s) => !s.isBusy && s.hasControlNet
        );

        if (server) {
            return server;
        }

        // If all servers are busy, return the first one with ControlNet support
        const busyServer = availableServers.find((s) => s.hasControlNet);

        if (busyServer) {
            return busyServer;
        }
        return null;
    }

    releaseServer(serverName: string): void {
        this.setServerBusy(serverName, false);
    }
}

export type { ServerStatus, APIServer };
export default new ServerManager();