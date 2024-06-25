// src/api/StableDiffusionClient.ts

import axios, {AxiosError} from "axios";
import RequestQueue, { type QueuedRequest } from "../managers/RequestQueue";
import ServerManager, { type ServerStatus } from "../managers/ServerManager";
import { CustomError, ErrorCodes } from "../utils/CustomError";

export interface ImageGenerationParams {
    prompt: string;
    negative_prompt?: string;
    seed?: number;
    sampler_name?: string;
    scheduler?: string;
    batch_size?: number;
    n_iter?: number;
    steps: number;
    cfg_scale?: number;
    width?: number;
    height?: number;
    tiling?: boolean;
    enable_hr?: boolean;
    sampler_index?: string;
}

export interface StatusUpdate {
    message: string;
    type: "info" | "warning" | "error";
}

class StableDiffusionClient {
    private isProcessingQueue = false;

    async generateImage(
        params: ImageGenerationParams,
        checkpoint: string | null,
        onStatusUpdate: (update: StatusUpdate) => Promise<void>,
    ): Promise<string> {
        return new Promise((resolve, reject) => {
            const request: QueuedRequest = {
                params,
                checkpoint,
                resolve,
                reject,
                onStatusUpdate,
            };
            this.enqueueOrProcess(request);
        });
    }

    private async enqueueOrProcess(request: QueuedRequest) {
        const server = ServerManager.getServerForCheckpoint(request.checkpoint);

        if (server && !server.isBusy) {
            await this.processRequest(request, server);
        } else {
            await request.onStatusUpdate({
                message: `Waiting in queue (position ${RequestQueue.size() + 1})`,
                type: "info",
            });
            RequestQueue.enqueue(request);
            this.processQueueAsync();
        }
    }

    private async processRequest(request: QueuedRequest, server: ServerStatus) {
        await request.onStatusUpdate({
            message: `Generating image on ${server.name}`,
            type: "info",
        });
        try {
            const result = await this.sendRequest(server.url, request.params);
            ServerManager.releaseServer(server.name);
            request.resolve(result);
        } catch (error) {
            console.error(
                `Error processing request on server ${server.name}:`,
                error,
            );
            ServerManager.releaseServer(server.name);
            await request.onStatusUpdate({
                message: `Error generating image on ${server.name}`,
                type: "error",
            });
            if (error instanceof CustomError) {
                request.reject(error);
            } else {
                request.reject(new CustomError(
                    "An unexpected error occurred while generating the image",
                    ErrorCodes.INTERNAL_SERVER_ERROR,
                    500,
                    { serverName: server.name }
                ));
            }
        } finally {
            this.processQueueAsync();
        }
    }

    private async sendRequest(
        url: string,
        params: ImageGenerationParams,
    ): Promise<string> {
        const payload = {
            ...params,
            send_images: true,
            save_images: false,
        };

        try {
            const response = await axios.post(`${url}/sdapi/v1/txt2img`, payload, {
                timeout: 900000,
            });
            return response.data.images[0]; // Base64 encoded image
        } catch (error) {
            if (axios.isAxiosError(error)) {
                const axiosError = error as AxiosError;
                if (axiosError.response) {
                    throw new CustomError(
                        `API request failed: ${axiosError.response.statusText}`,
                        ErrorCodes.API_ERROR,
                        axiosError.response.status,
                        { url, params }
                    );
                } else if (axiosError.request) {
                    throw new CustomError(
                        "No response received from API",
                        ErrorCodes.API_ERROR,
                        500,
                        { url, params }
                    );
                }
            }
            throw new CustomError(
                "An unexpected error occurred while sending the request",
                ErrorCodes.INTERNAL_SERVER_ERROR,
                500,
                { url, params }
            );
        }
    }

    private processQueueAsync() {
        if (!this.isProcessingQueue) {
            this.isProcessingQueue = true;
            setImmediate(() => this.processQueue());
        }
    }

    private async processQueue() {
        while (!RequestQueue.isEmpty()) {
            const nextRequest = RequestQueue.dequeue();
            if (nextRequest) {
                const server = ServerManager.getServerForCheckpoint(
                    nextRequest.checkpoint,
                );
                if (server && !server.isBusy) {
                    await this.processRequest(nextRequest, server);
                } else {
                    // If no server is available, put the request back in the queue
                    RequestQueue.enqueue(nextRequest);
                    break; // Exit the loop and try again later
                }
            }
        }
        this.isProcessingQueue = false;

        // If there are still items in the queue, schedule another process
        if (!RequestQueue.isEmpty()) {
            setTimeout(() => this.processQueueAsync(), 5000);
        }
    }
}

export default new StableDiffusionClient();
