// src/types/discord.ts

import { Client, Collection } from 'discord.js';
import * as stableDiffusionCommand from '../commands/stableDiffusion';

export interface BotClient extends Client {
    commands: Collection<string, typeof stableDiffusionCommand>;
}