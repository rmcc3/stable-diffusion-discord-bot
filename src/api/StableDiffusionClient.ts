// src/api/StableDiffusionClient.ts

import axios, { AxiosError } from "axios";
import RequestQueue, { type QueuedRequest } from "../managers/RequestQueue";
import ServerManager, { type ServerStatus } from "../managers/ServerManager";
import { CustomError, ErrorCodes } from "../utils/CustomError";
import PermissionsManager from "../managers/PermissionsManager";
import {GuildMember} from "discord.js";

export interface ControlNetParams {
    enabled: boolean;
    model: string;
    module: string;
    weight: number;
    image: string; // base64 encoded image
    control_mode?: string;
    guidance_start?: number;
    guidance_end?: number;
    processor_res?: number;
    threshold_a?: number;
    threshold_b?: number;
}

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
    use_controlnet?: boolean;
    controlnet?: ControlNetParams;
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
        member: GuildMember,
        priority: number,
    ): Promise<string> {
        return new Promise((resolve, reject): void => {
            const request: QueuedRequest = {
                params,
                checkpoint,
                resolve,
                reject,
                onStatusUpdate,
                member,
                priority,
                timestamp: Date.now(),
            };
            this.enqueueOrProcess(request);
        });
    }

    private async enqueueOrProcess(request: QueuedRequest): Promise<void> {
        const server = request.params.use_controlnet
            ? ServerManager.getServerForCheckpointWithControlNet(request.checkpoint)
            : ServerManager.getServerForCheckpoint(request.checkpoint);
        console.log(`Server for checkpoint ${request.checkpoint}: ${server?.name || 'None available'}`);

        if (server && !server.isBusy) {
            console.log(`Processing request immediately on server ${server.name}`);
            await this.processRequest(request, server);
        } else {
            const queuePosition = RequestQueue.getQueuePosition(request.member.id);
            console.log(`Enqueueing request for user ${request.member.user.tag} at position ${queuePosition + 1}`);
            await request.onStatusUpdate({
                message: `Waiting in queue (position ${queuePosition + 1})`,
                type: "info",
            });
            RequestQueue.enqueue(request);
            this.processQueueAsync();
        }
    }

    private async processRequest(request: QueuedRequest, server: ServerStatus): Promise<void> {
        console.log(`Processing request on server ${server.name}`);
        await ServerManager.setServerBusy(server.name, true);
        await request.onStatusUpdate({
            message: `Generating image on ${server.name}`,
            type: "info",
        });
        try {
            if (!(await PermissionsManager.canUseStableDiffusion(request.member))) {
                console.log(`User ${request.member.user.tag} no longer has permission to use this command`);
                request.reject(new CustomError(
                    "You no longer have permission to use this command.",
                    ErrorCodes.UNAUTHORIZED,
                    403,
                ));
                return;
            }

            console.log(`Sending request to server ${server.name}`);
            const result = await this.sendRequest(server.url, request.params);
            console.log(`Request processed successfully on server ${server.name}`);
            ServerManager.releaseServer(server.name);
            request.resolve(result);
        } catch (error) {
            console.error(`Error processing request on server ${server.name}:`, error);
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
        console.log(`Sending request to URL: ${url}`);
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
            console.error(`Error in sendRequest:`, error);
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

    private processQueueAsync(): void {
        if (!this.isProcessingQueue) {
            this.isProcessingQueue = true;
            setImmediate(() => this.processQueue());
        }
    }

    private async processQueue(retryCount: number = 0): Promise<void> {
        console.log(`Processing queue, retry count: ${retryCount}`);
        const MAX_RETRIES = 10;
        while (!RequestQueue.isEmpty() && retryCount < MAX_RETRIES) {
            const nextRequest = RequestQueue.dequeue();
            if (nextRequest) {
                console.log(`Processing next request for user ${nextRequest.member.user.tag}`);
                const server = ServerManager.getServerForCheckpoint(
                    nextRequest.checkpoint,
                );
                if (server && !server.isBusy) {
                    await this.processRequest(nextRequest, server);
                    retryCount = 0; // Reset retry count on successful processing
                } else {
                    console.log(`No available server, re-enqueueing request`);
                    RequestQueue.enqueue(nextRequest);
                    retryCount++;
                    await new Promise(resolve => setTimeout(resolve, 5000));
                }
            }
        }
        this.isProcessingQueue = false;
        if (retryCount >= MAX_RETRIES) {
            console.error("Max retries reached in processQueue");
        }
    }
}

export default new StableDiffusionClient();