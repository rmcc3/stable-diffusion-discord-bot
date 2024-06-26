// src/registerCommands.ts

import { REST } from "@discordjs/rest";
import { Routes } from "discord-api-types/v9";
import { config } from "dotenv";
import * as stableDiffusionCommand from "./commands/stableDiffusion";
import * as setRoleCommand from "./commands/setRolePermissions";
import env from './config/environment';

config();

const commands = [
    stableDiffusionCommand.data.toJSON(),
    setRoleCommand.data.toJSON(),
];

const rest = new REST({ version: "9" }).setToken(
    env.DISCORD_TOKEN || "",
);

(async () => {
    try {
        console.log("Started refreshing application (/) commands.");

        // Register the commands to the Discord API
        const result = await rest.put(
            Routes.applicationCommands(env.CLIENT_ID || ""),
            {
                body: commands,
            },
        );

        console.log("Successfully reloaded application (/) commands.");
        console.log("Registered commands:", result);
    } catch (error) {
        console.error("Error registering commands:", error);
    }
})();