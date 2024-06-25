// src/commands/setRolePermissions.ts

import { SlashCommandBuilder } from "@discordjs/builders";
import {ChatInputCommandInteraction, GuildMember, PermissionFlagsBits} from "discord.js";
import PermissionsManager from "../managers/PermissionsManager";

export const data = new SlashCommandBuilder()
    .setName("setrolepermissions")
    .setDescription("Set permission level for a role")
    .addRoleOption(option =>
        option.setName("role")
            .setDescription("The role to set permissions for")
            .setRequired(true))
    .addIntegerOption(option =>
        option.setName("level")
            .setDescription("The permission level to set")
            .setRequired(true)
            .addChoices(
                { name: "User", value: 0 },
                { name: "Trusted", value: 1 },
                { name: "Moderator", value: 2 },
                { name: "Admin", value: 3 }
            ))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guild) {
        await interaction.reply({ content: "This command can only be used in a server.", ephemeral: true });
        return;
    }

    const member = interaction.member as GuildMember;
    if (!(await PermissionsManager.canManagePermissions(member))) {
        await interaction.reply({ content: "You don't have permission to manage roles.", ephemeral: true });
        return;
    }

    const role = interaction.options.getRole("role");
    const level = interaction.options.getInteger("level");

    if (!role || level === null) {
        await interaction.reply({ content: "Invalid role or permission level.", ephemeral: true });
        return;
    }

    await PermissionsManager.setRolePermission(interaction.guild.id, role.id, level);
    await interaction.reply(`Set permission level for role ${role.name} to ${level}`);
}