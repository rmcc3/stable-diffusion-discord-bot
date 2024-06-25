// src/managers/ServerManager.ts

import ServerManagerBase, { ServerStatus, APIServer } from "./ServerManagerBase";
import apiServers from "../config/apiServers";

interface CheckpointInfo {
    name: string;
    servers: string[];
}

class ServerManager extends ServerManagerBase {
    constructor() {
        super(apiServers);
    }

    getServerForCheckpoint(checkpoint: string | null): ServerStatus | null {
        const normalizedCheckpoint = this.normalizeCheckpointName(checkpoint);
        console.log(
            `Searching for server with checkpoint: ${normalizedCheckpoint}`
        );
        const availableServers = this.getAvailableServers();
        console.log(
            `Available servers: ${availableServers.map((s) => s.name).join(", ")}`
        );

        // First, try to find a non-busy server with the correct checkpoint
        const server = availableServers.find(
            (s) => s.currentCheckpoint === normalizedCheckpoint && !s.isBusy
        );

        if (server) {
            console.log(
                `Found non-busy server ${server.name} for checkpoint ${normalizedCheckpoint}`
            );
            return server;
        }

        // If all servers with the checkpoint are busy, return the first one that matches the checkpoint
        const busyServer = availableServers.find(
            (s) => s.currentCheckpoint === normalizedCheckpoint
        );

        if (busyServer) {
            console.log(
                `All servers with checkpoint ${normalizedCheckpoint} are busy. Returning ${busyServer.name}`
            );
            return busyServer;
        }

        console.log(`No server found for checkpoint ${normalizedCheckpoint}`);
        return null;
    }

    releaseServer(serverName: string): void {
        this.setServerBusy(serverName, false);
        console.log(`Released server ${serverName}`);
    }

    getAvailableServerWithAnyCheckpoint(): ServerStatus | null {
        console.log(
            "Searching for any available server with a loaded checkpoint"
        );
        const availableServers = this.getAvailableServers();
        console.log(
            `Available servers: ${availableServers.map((s) => s.name).join(", ")}`
        );

        // First, try to find a non-busy server
        const server = availableServers.find(
            (s) => !s.isBusy && s.currentCheckpoint
        );

        if (server) {
            console.log(
                `Found non-busy server ${server.name} with checkpoint ${server.currentCheckpoint}`
            );
            this.setServerBusy(server.name, true);
            return server;
        }

        // If all servers are busy, return the first one with a loaded checkpoint
        const busyServer = availableServers.find((s) => s.currentCheckpoint);

        if (busyServer) {
            console.log(
                `All servers are busy. Returning ${busyServer.name} with checkpoint ${busyServer.currentCheckpoint}`
            );
            return busyServer;
        }

        console.log("No server found with a loaded checkpoint");
        return null;
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
            })
        );

        console.log("Available checkpoints:", checkpoints);
        return checkpoints;
    }
}

export type { ServerStatus, APIServer };
export default new ServerManager();