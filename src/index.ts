// src/index.ts

import {
    AutocompleteInteraction,
    ChatInputCommandInteraction,
    Client,
    Collection,
    GatewayIntentBits
} from "discord.js";
import env from './config/environment';
import * as stableDiffusionCommand from "./commands/stableDiffusion";
import * as setRoleCommand from "./commands/setRolePermissions";
import ServerManager from "./managers/ServerManager";
import { wrapHandler } from "./utils/errorHandler";
import RateLimitManager from "./managers/RateLimitManager";
import { Mutex } from 'async-mutex';

interface CommandModule {
    data: { name: string };
    execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
    autocomplete?: (interaction: AutocompleteInteraction) => Promise<void>;
}

interface BotClient extends Client {
    commands: Collection<string, CommandModule>;
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] }) as BotClient;

// Initialize the commands collection
client.commands = new Collection();
client.commands.set(stableDiffusionCommand.data.name, stableDiffusionCommand);
client.commands.set(setRoleCommand.data.name, setRoleCommand);

// Initialize global rate limit manager (20 commands per minute)
const globalRateLimitManager = new RateLimitManager(20, 60);

client.once("ready", () => {
    console.log("Bot is ready!");
    ServerManager.initialize();
});

client.on("interactionCreate", async (interaction) => {
    if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (!command) return;

        if (interaction.commandName === 'generate' && !globalRateLimitManager.checkRateLimit('global')) {
            await interaction.reply({
                content: "The bot is currently experiencing high traffic. Please try again later.",
                ephemeral: true
            });
            return;
        }

        await wrapHandler(command.execute, client)(interaction);
    } else if (interaction.isAutocomplete()) {
        const command = client.commands.get(interaction.commandName);
        if (!command || !command.autocomplete) return;

        await wrapHandler(command.autocomplete, client)(interaction);
    }
});

client.login(env.DISCORD_TOKEN);

process.on('SIGINT', () => {
    console.log('Bot is shutting down...');
    globalRateLimitManager.destroy();
    client.destroy();
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('Bot is shutting down...');
    globalRateLimitManager.destroy();
    client.destroy();
    process.exit(0);
});