// src/types/discord.ts

import type { Client, Collection } from "discord.js";
import type * as stableDiffusionCommand from "../commands/stableDiffusion";

export interface BotClient extends Client {
    commands: Collection<string, typeof stableDiffusionCommand>;
}
