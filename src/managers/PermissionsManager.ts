// src/managers/PermissionsManager.ts

import { GuildMember, Snowflake } from "discord.js";
import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import env from '../config/environment';

enum PermissionLevel {
    BANNED = -1,
    USER = 0,
    TRUSTED = 1,
    MODERATOR = 2,
    ADMIN = 3,
    BOT_OWNER = 4,
}

class PermissionsManager {
    private db: Database | null = null;
    private botOwnerId: Snowflake;

    constructor(botOwnerId: Snowflake) {
        this.botOwnerId = botOwnerId;
        this.initDatabase().catch(console.error);
    }

    private async initDatabase() {
        this.db = await open({
            filename: 'permissions.sqlite',
            driver: sqlite3.Database
        });

        await this.db.exec(`
            CREATE TABLE IF NOT EXISTS role_permissions (
                guild_id TEXT,
                role_id TEXT,
                permission_level INTEGER,
                PRIMARY KEY (guild_id, role_id)
            );
            CREATE TABLE IF NOT EXISTS user_permissions (
                guild_id TEXT,
                user_id TEXT,
                permission_level INTEGER,
                PRIMARY KEY (guild_id, user_id)
            );
            CREATE TABLE IF NOT EXISTS global_bans (
                user_id TEXT PRIMARY KEY
            );
        `);
    }

    private async runInTransaction<T>(operation: () => Promise<T>): Promise<T> {
        if (!this.db) throw new Error("Database not initialized");

        await this.db.run('BEGIN');
        try {
            const result = await operation();
            await this.db.run('COMMIT');
            return result;
        } catch (error) {
            await this.db.run('ROLLBACK');
            throw error;
        }
    }

    public async setRolePermission(guildId: Snowflake, roleId: Snowflake, level: PermissionLevel): Promise<void> {
        await this.runInTransaction(async () => {
            await this.db?.run(
                'INSERT OR REPLACE INTO role_permissions (guild_id, role_id, permission_level) VALUES (?, ?, ?)',
                [guildId, roleId, level]
            );
        });
    }

    public async setUserPermission(guildId: Snowflake, userId: Snowflake, level: PermissionLevel): Promise<void> {
        await this.runInTransaction(async () => {
            await this.db?.run(
                'INSERT OR REPLACE INTO user_permissions (guild_id, user_id, permission_level) VALUES (?, ?, ?)',
                [guildId, userId, level]
            );
        });
    }

    public async removeRolePermission(guildId: Snowflake, roleId: Snowflake): Promise<void> {
        await this.runInTransaction(async () => {
            await this.db?.run('DELETE FROM role_permissions WHERE guild_id = ? AND role_id = ?', [guildId, roleId]);
        });
    }

    public async removeUserPermission(guildId: Snowflake, userId: Snowflake): Promise<void> {
        await this.runInTransaction(async () => {
            await this.db?.run('DELETE FROM user_permissions WHERE guild_id = ? AND user_id = ?', [guildId, userId]);
        });
    }

    public async globalBanUser(userId: Snowflake): Promise<void> {
        await this.runInTransaction(async () => {
            await this.db?.run('INSERT OR REPLACE INTO global_bans (user_id) VALUES (?)', [userId]);
        });
    }

    public async removeGlobalBan(userId: Snowflake): Promise<void> {
        await this.runInTransaction(async () => {
            await this.db?.run('DELETE FROM global_bans WHERE user_id = ?', [userId]);
        });
    }

    public async isGloballyBanned(userId: Snowflake): Promise<boolean> {
        const result = await this.db?.get('SELECT 1 FROM global_bans WHERE user_id = ?', [userId]);
        return !!result;
    }

    private async getPermissionLevel(member: GuildMember): Promise<PermissionLevel> {
        if (member.id === this.botOwnerId) return PermissionLevel.BOT_OWNER;
        if (await this.isGloballyBanned(member.id)) return PermissionLevel.BANNED;

        // Check user-specific permissions
        const userPermission = await this.db?.get(
            'SELECT permission_level FROM user_permissions WHERE guild_id = ? AND user_id = ?',
            [member.guild.id, member.id]
        );
        if (userPermission) return userPermission.permission_level;

        // Check role permissions
        let highestLevel = PermissionLevel.USER;
        for (const role of member.roles.cache.values()) {
            const rolePermission = await this.db?.get(
                'SELECT permission_level FROM role_permissions WHERE guild_id = ? AND role_id = ?',
                [member.guild.id, role.id]
            );
            if (rolePermission && rolePermission.permission_level > highestLevel) {
                highestLevel = rolePermission.permission_level;
            }
        }

        // Check Discord permissions
        if (member.permissions.has("Administrator")) return PermissionLevel.ADMIN;
        if (member.permissions.has("ModerateMembers")) return PermissionLevel.MODERATOR;

        return highestLevel;
    }

    public async canUseStableDiffusion(member: GuildMember): Promise<boolean> {
        const level = await this.getPermissionLevel(member);
        return level >= PermissionLevel.TRUSTED;
    }

    public async canManagePermissions(member: GuildMember): Promise<boolean> {
        const level = await this.getPermissionLevel(member);
        return level >= PermissionLevel.ADMIN;
    }

    public async canBanGlobally(member: GuildMember): Promise<boolean> {
        return member.id === this.botOwnerId;
    }

    public async hasPermissionLevel(member: GuildMember, requiredLevel: PermissionLevel): Promise<boolean> {
        const level = await this.getPermissionLevel(member);
        return level >= requiredLevel;
    }
}

export default new PermissionsManager(env.BOT_OWNER_ID || '');