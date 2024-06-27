// src/commands/stableDiffusion.ts

import { SlashCommandBuilder } from "@discordjs/builders";
import type {
    AutocompleteInteraction, ChatInputCommandInteraction,
    GuildMember,
} from "discord.js";
import StableDiffusionClient, { type StatusUpdate, type ControlNetParams } from "../api/StableDiffusionClient";
import PermissionsManager from "../managers/PermissionsManager";
import ServerManager, { type ServerStatus } from "../managers/ServerManager";
import RateLimitManager from "../managers/RateLimitManager";
import axios from "axios";

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
    )
    .addBooleanOption((option) =>
        option
            .setName("use_controlnet")
            .setDescription("Whether to use ControlNet"),
    )
    .addStringOption((option) =>
        option
            .setName("controlnet_module")
            .setDescription("The ControlNet module to use")
            .setAutocomplete(true),
    )
    .addStringOption((option) =>
        option
            .setName("controlnet_model")
            .setDescription("The ControlNet model to use")
            .setAutocomplete(true),
    )
    .addAttachmentOption((option) =>
        option
            .setName("controlnet_image")
            .setDescription("The image to use for ControlNet"),
    );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.isChatInputCommand()) return;

    const member = interaction.member as GuildMember;
    const userId = member.id;

    console.log(`Received /generate command from user ${member.user.tag}`);

    if (!(await PermissionsManager.canUseStableDiffusion(member))) {
        console.log(`User ${member.user.tag} does not have permission to use Stable Diffusion`);
        await interaction.reply({
            content: "You do not have permission to use this command.",
            ephemeral: true,
        });
        return;
    }

    if (!rateLimitManager.checkRateLimit(userId)) {
        const cooldown = rateLimitManager.getRemainingCooldown(userId);
        console.log(`User ${member.user.tag} has reached the rate limit. Cooldown: ${cooldown}ms`);
        await interaction.reply({
            content: `You've reached the rate limit. Please try again in ${Math.ceil(cooldown / 1000)} seconds.`,
            ephemeral: true,
        });
        return;
    }

    const prompt = interaction.options.getString("prompt", true);
    const negative_prompt = interaction.options.getString("negative_prompt") || "";
    const steps = interaction.options.getInteger("steps", true);
    const checkpoint = interaction.options.getString("checkpoint");
    const width = interaction.options.getInteger("width") || 1024;
    const height = interaction.options.getInteger("height") || 1024;
    const cfg_scale = interaction.options.getNumber("cfg_scale") || 2;
    const sampler = interaction.options.getString("sampler") || "DPM++ SDE";
    const use_controlnet = interaction.options.getBoolean("use_controlnet") || false;
    const controlnet_model = interaction.options.getString("controlnet_model");
    const controlnet_module = interaction.options.getString("controlnet_module");
    const controlnet_image = interaction.options.getAttachment("controlnet_image");

    // ControlNet parameter validation
    if (use_controlnet) {
        if (!controlnet_model || !controlnet_module || !controlnet_image) {
            await interaction.reply({
                content: "When using ControlNet, you must provide a model, module, and image. Please check your inputs and try again.",
                ephemeral: true
            });
            return;
        }

        if (controlnet_model.toLowerCase() === 'none') {
            await interaction.reply({
                content: "No suitable ControlNet model is available for the selected module. Please try a different module or disable ControlNet.",
                ephemeral: true
            });
            return;
        }
    }

    await interaction.deferReply();

    try {
        const onStatusUpdate = async (update: StatusUpdate) => {
            console.log(`Status update for user ${member.user.tag}: ${update.message}`);
            await interaction.editReply(update.message);
        };

        console.log("Finding server for checkpoint and ControlNet");
        let server: ServerStatus | null = null;
        if (checkpoint) {
            server = use_controlnet
                ? ServerManager.getServerForCheckpointWithControlNet(checkpoint)
                : ServerManager.getServerForCheckpoint(checkpoint);
            if (!server) {
                console.log(`No suitable server available for checkpoint ${checkpoint} and ControlNet requirements`);
                await interaction.editReply(
                    `No server is currently available with the required checkpoint and ControlNet support. Please try a different configuration or retry later.`
                );
                return;
            }
        } else {
            server = use_controlnet
                ? ServerManager.getAvailableServerWithControlNet()
                : ServerManager.getAvailableServerWithAnyCheckpoint();
            if (!server) {
                console.log(`No suitable server available`);
                await interaction.editReply(
                    "No server is currently available with the required capabilities. Please try again later."
                );
                return;
            }
        }

        console.log(`Selected server for generation: ${server.name}`);

        console.log("Getting user priority");
        const priority = await PermissionsManager.getUserPriority(member);
        console.log(`User priority for ${member.user.tag}: ${priority}`);

        let controlnetParams: ControlNetParams | undefined;
        if (use_controlnet && controlnet_model && controlnet_module && controlnet_image) {
            console.log("Processing ControlNet image");
            const imageResponse = await axios.get(controlnet_image.url, { responseType: 'arraybuffer' });
            const base64Image = Buffer.from(imageResponse.data, 'binary').toString('base64');
            controlnetParams = {
                enabled: true,
                model: controlnet_model,
                module: controlnet_module,
                weight: 1.0,
                image: base64Image,
                control_mode: "Balanced",
                guidance_start: 0.0,
                guidance_end: 1.0,
                processor_res: 512,
                threshold_a: 0.5,
                threshold_b: 0.5
            };
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
                controlnet: controlnetParams
            },
            server.currentCheckpoint,
            onStatusUpdate,
            member,
            priority
        );

        console.log(`Image generated successfully for user ${member.user.tag}`);

        const buffer = Buffer.from(image, "base64");

        if (buffer.length > 20 * 1024 * 1024) { // 20MB limit
            await interaction.editReply("The generated image is too large to upload to Discord. Please try again with smaller dimensions.");
            return;
        }

        console.log("Sending reply with generated image");
        await interaction.editReply({
            content: "Image generated successfully!",
            files: [{ attachment: buffer, name: "generated_image.png" }],
        });
    } catch (error) {
        await interaction.followUp({
            content: "There was an error generating the image. Please try again later.",
            ephemeral: true
        });
    }
}

export async function autocomplete(interaction: AutocompleteInteraction): Promise<void> {
    const focusedOption = interaction.options.getFocused(true);
    const focusedValue = focusedOption.value.toLowerCase();

    try {
        let choices: { name: string; value: string }[] = [];

        switch (focusedOption.name) {
            case 'checkpoint':
                const checkpoints = ServerManager.getAvailableCheckpoints();
                choices = checkpoints.map(checkpoint => ({
                    name: `${checkpoint.name} (${checkpoint.servers.join(", ")})`,
                    value: checkpoint.name,
                }));
                break;

            case 'controlnet_model':
                const selectedModule = interaction.options.getString('controlnet_module');
                const controlNetModels = ServerManager.getAvailableControlNetModels();

                if (selectedModule) {
                    const filteredModels = controlNetModels.filter(model =>
                        model.toLowerCase().includes(selectedModule.toLowerCase())
                    );
                    choices = filteredModels.map(model => ({ name: model, value: model }));
                } else {
                    choices = controlNetModels.map(model => ({ name: model, value: model }));
                }

                if (choices.length === 0) {
                    choices = [{ name: "None available", value: "none" }];
                }
                break;

            case 'controlnet_module':
                choices = [
                    { name: "Canny", value: "canny" },
                    { name: "Depth", value: "depth" },
                    { name: "Pose", value: "openpose" },
                    { name: "T2I Adapter", value: "T2I" },
                ];
                break;

            default:
                break;
        }

        const filtered = choices.filter(choice =>
            choice.name.toLowerCase().includes(focusedValue) ||
            choice.value.toLowerCase().includes(focusedValue)
        );

        await interaction.respond(filtered.slice(0, 25));
    } catch (error) {
        await interaction.respond([{ name: 'Error fetching options', value: 'error' }]);
    }
}