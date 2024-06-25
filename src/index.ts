// src/index.ts

import {
    AutocompleteInteraction,
    ChatInputCommandInteraction,
    Client,
    Collection,
    CommandInteraction,
    GatewayIntentBits
} from "discord.js";
import env from './config/environment';
import * as stableDiffusionCommand from "./commands/stableDiffusion";
import * as setRoleCommand from "./commands/setRolePermissions";
import ServerManager from "./managers/ServerManager";
import { wrapHandler } from "./utils/errorHandler";



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

client.once("ready", () => {
    console.log("Bot is ready!");
    ServerManager.initialize();
});

client.on("interactionCreate", async (interaction) => {
    if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (!command) return;

        await wrapHandler(command.execute, client)(interaction);
    } else if (interaction.isAutocomplete()) {
        const command = client.commands.get(interaction.commandName);
        if (!command || !command.autocomplete) return;

        await wrapHandler(command.autocomplete, client)(interaction);
    }
});

client.login(env.DISCORD_TOKEN);