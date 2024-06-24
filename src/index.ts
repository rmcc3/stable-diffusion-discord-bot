// src/index.ts

import { Client, Collection, GatewayIntentBits } from "discord.js";
import { config } from "dotenv";
import * as stableDiffusionCommand from "./commands/stableDiffusion";
import ServerManager from "./managers/ServerManager";

config();

interface BotClient extends Client {
    commands: Collection<string, typeof stableDiffusionCommand>;
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] }) as BotClient;

// Initialize the commands collection
client.commands = new Collection();
client.commands.set(stableDiffusionCommand.data.name, stableDiffusionCommand);

client.once("ready", () => {
    console.log("Bot is ready!");
    ServerManager.initialize();
});

client.on("interactionCreate", async (interaction) => {
    if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (!command) return;

        try {
            await command.execute(interaction);
        } catch (error) {
            console.error(error);
            await interaction.reply({
                content: "There was an error while executing this command!",
                ephemeral: true,
            });
        }
    } else if (interaction.isAutocomplete()) {
        const command = client.commands.get(interaction.commandName);
        if (!command) return;

        try {
            await command.autocomplete(interaction);
        } catch (error) {
            console.error(error);
        }
    }
});

client.login(process.env.DISCORD_TOKEN);
