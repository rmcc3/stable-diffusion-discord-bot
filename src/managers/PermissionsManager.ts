// src/managers/PermissionsManager.ts

import type { GuildMember } from "discord.js";

class PermissionsManager {
  private allowedRoles: string[] = ["Admin", "Moderator", "Mod", "Bruhs"];

  canUseStableDiffusion(member: GuildMember): boolean {
    return member.roles.cache.some((role) =>
      this.allowedRoles.includes(role.name),
    );
  }
}

export default new PermissionsManager();
