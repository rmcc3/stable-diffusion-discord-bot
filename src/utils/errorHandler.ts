// src/utils/errorHandler.ts

import { CustomError, ErrorCodes } from './CustomError';
import { Client, TextChannel } from 'discord.js';

export async function handleError(error: Error | CustomError, client: Client) {
    console.error('An error occurred:', error);

    let errorMessage: string;
    let errorCode: string;

    if (error instanceof CustomError) {
        errorMessage = error.message;
        errorCode = error.code;
    } else {
        errorMessage = error.message;
        errorCode = ErrorCodes.INTERNAL_SERVER_ERROR;
    }

    // Log to a Discord channel (optional)
    const errorLogChannelId = process.env.ERROR_LOG_CHANNEL_ID;
    if (errorLogChannelId) {
        const channel = await client.channels.fetch(errorLogChannelId);
        if (channel instanceof TextChannel) {
            await channel.send(`Error: ${errorCode}\nMessage: ${errorMessage}\nStack: ${error.stack}`);
        }
    }
}

export function wrapHandler(handler: Function, client: Client) {
    return async (...args: any[]) => {
        try {
            await handler(...args);
        } catch (error) {
            await handleError(error as Error, client);
        }
    };
}