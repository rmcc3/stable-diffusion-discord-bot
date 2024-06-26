// src/commands/stableDiffusion.ts

import { SlashCommandBuilder } from "@discordjs/builders";
import type {
    AutocompleteInteraction, ChatInputCommandInteraction,
    CommandInteraction,
    GuildMember,
} from "discord.js";
import StableDiffusionClient, {
    type StatusUpdate,
} from "../api/StableDiffusionClient";
import PermissionsManager from "../managers/PermissionsManager";
import ServerManager, { type ServerStatus } from "../managers/ServerManager";
import RateLimitManager from "../managers/RateLimitManager";

// Initialize rate limit manager (10 usages per 5 minutes)
const rateLimitManager = new RateLimitManager(10, 300);

export const data = new SlashCommandBuilder()
    .setName("generate")
    .setDescription("Generate an image using Stable Diffusion")
    .addStringOption((option) =>
        option
            .setName("prompt")
            .setDescription("The prompt for the image")
            .setRequired(true),
    )
    .addIntegerOption((option) =>
        option
            .setName("steps")
            .setDescription("The number of inference steps")
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(60),
    )
    .addStringOption((option) =>
        option
            .setName("checkpoint")
            .setDescription("The Stable Diffusion checkpoint to use")
            .setAutocomplete(true),
    )
    .addStringOption((option) =>
        option
            .setName("negative_prompt")
            .setDescription("The negative prompt for the image"),
    )
    .addIntegerOption((option) =>
        option
            .setName("width")
            .setDescription("The width of the image")
            .setMinValue(512)
            .setMaxValue(1024),
    )
    .addIntegerOption((option) =>
        option
            .setName("height")
            .setDescription("The height of the image")
            .setMinValue(512)
            .setMaxValue(1024),
    )
    .addNumberOption((option) =>
        option
            .setName("cfg_scale")
            .setDescription("The CFG scale")
            .setMinValue(1)
            .setMaxValue(10),
    )
    .addStringOption((option) =>
        option
            .setName("sampler")
            .setDescription("The sampler to use")
            .addChoices(
                { name: "Euler", value: "Euler" },
                { name: "DPM++ SDE", value: "DPM++ SDE" },
                // Add more samplers as needed
            ),
    );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.isChatInputCommand()) return;

    const member = interaction.member as GuildMember;
    const userId = member.id;

    if (!(await PermissionsManager.canUseStableDiffusion(member))) {
        await interaction.reply({
            content: "You do not have permission to use this command.",
            ephemeral: true,
        });
        return;
    }

    if (!rateLimitManager.checkRateLimit(userId)) {
        const cooldown = rateLimitManager.getRemainingCooldown(userId);
        await interaction.reply({
            content: `You've reached the rate limit. Please try again in ${Math.ceil(cooldown / 1000)} seconds.`,
            ephemeral: true,
        });
        return;
    }

    const prompt = interaction.options.getString("prompt", true);
    const negative_prompt =
        interaction.options.getString("negative_prompt") || "";
    const steps = interaction.options.getInteger("steps", true);
    const checkpoint = interaction.options.getString("checkpoint");
    const width = interaction.options.getInteger("width") || 1024;
    const height = interaction.options.getInteger("height") || 1024;
    const cfg_scale = interaction.options.getNumber("cfg_scale") || 2;
    const sampler = interaction.options.getString("sampler") || "DPM++ SDE";

    await interaction.deferReply();

    try {
        const onStatusUpdate = async (update: StatusUpdate) => {
            await interaction.editReply(update.message);
        };

        let server: ServerStatus | null = null;
        if (checkpoint) {
            server = ServerManager.getServerForCheckpoint(checkpoint);
            if (!server) {
                await interaction.editReply(
                    `The checkpoint "${checkpoint}" is not currently available on any server. Please try a different checkpoint or retry later.`
                );
                return;
            }
        } else {
            server = ServerManager.getAvailableServerWithAnyCheckpoint();
            if (!server) {
                await interaction.editReply(
                    "No server is currently available with a loaded checkpoint. Please try again later."
                );
                return;
            }
        }

        const image = await StableDiffusionClient.generateImage(
            {
                prompt,
                negative_prompt,
                steps,
                width,
                height,
                cfg_scale,
                sampler_name: sampler,
            },
            server.currentCheckpoint,
            onStatusUpdate,
        );

        const buffer = Buffer.from(image, "base64");
        await interaction.editReply({
            content: "Image generated successfully!",
            files: [{ attachment: buffer, name: "generated_image.png" }],
        });
    } catch (error) {
        console.error("Error generating image:", error);
        await interaction.editReply(
            "There was an error generating the image. Please try again later.",
        );
    }
}

export async function autocomplete(interaction: AutocompleteInteraction): Promise<void> {
    const focusedValue = interaction.options.getFocused().toLowerCase();
    const choices = ServerManager.getAvailableCheckpoints().map(
        (checkpoint) => ({
            name: `${checkpoint.name} (${checkpoint.servers.join(", ")})`,
            value: checkpoint.name,
        }),
    );

    const filtered = choices.filter((choice) =>
        choice.name.toLowerCase().includes(focusedValue),
    );
    await interaction.respond(filtered.slice(0, 25));
}
