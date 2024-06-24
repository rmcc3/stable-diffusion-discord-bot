// src/registerCommands.ts

import { REST } from "@discordjs/rest";
import { Routes } from "discord-api-types/v9";
import { config } from "dotenv";
import * as stableDiffusionCommand from "./commands/stableDiffusion";

config();

const commands = [stableDiffusionCommand.data.toJSON()];

const rest = new REST({ version: "9" }).setToken(
  process.env.DISCORD_TOKEN || "",
);

(async () => {
  try {
    console.log("Started refreshing application (/) commands.");

    // Register the commands to the Discord API
    await rest.put(Routes.applicationCommands(process.env.CLIENT_ID || ""), {
      body: commands,
    });

    console.log("Successfully reloaded application (/) commands.");
  } catch (error) {
    console.error(error);
  }
})();
