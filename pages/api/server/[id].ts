import type { NextApiHandler, NextApiRequest, NextApiResponse } from "next";
import { getToken, JWT } from "next-auth/jwt";

import { db, filterListOfGuildIdsWithBot } from "@/lib/db";

export interface ClientRelationshipEvent {
    timestamp: string,
    channel: string,
    source: string,
    target: string,
    reason: number,
}

export interface ClientGuildMember {
    id: string,
    bot: boolean,
    username: string,
    nickname: string,
    avatar: string,
}

export type ServerResponse = {
    limit: number,
    events: ClientRelationshipEvent[],
    users: ClientGuildMember[],
};

interface ErrorResponse {
    error: string,
}

export async function getTokenAndGuildIdFromRequest<T>(req: NextApiRequest, res: NextApiResponse<T | ErrorResponse>): Promise<{ token: JWT, guildId: string } | { token: null, guildId: null }> {
    const token = await getToken({ req });
    if (!token) {
        res.status(403).json({
            error: 'Not authenticated.',
        });

        return { token: null, guildId: null };
    }

    const guildId = req.query.id;
    if (typeof guildId !== "string") {
        res.status(400).json({
            error: 'Missing guild ID.',
        });

        return { token: null, guildId: null };
    }

    if (!token.guild_ids.includes(guildId)) {
        res.status(403).json({
            error: 'User does not have access to guild.',
        });

        return { token: null, guildId: null };
    }

    return {
        token,
        guildId,
    };
}

// TODO: Rate limit this and the servers API per-user.
const server: NextApiHandler<ServerResponse | ErrorResponse> = async (req, res) => {
    const { token, guildId } = await getTokenAndGuildIdFromRequest(req, res);
    if (!token) {
        return;
    }

    const botPresent = await filterListOfGuildIdsWithBot([guildId]);
    if (!botPresent) {
        res.status(404).json({
            error: 'Guild not active.',
        });

        return;
    }

    // There is a slight chance this will miss events at the same timestamp across page boundaries, but it's so
    // rare to have simultaneous changes that it's not worth trying to figure out an alternative at the moment.
    const before = (typeof req.query.before === "string" ? req.query.before : undefined);
    const limit = Math.min((typeof req.query.limit === "string" ? parseInt(req.query.limit, 10) : NaN) || 1000, 1000);

    let events;
    if (before) {
        events = await db.query<ClientRelationshipEvent[]>(
            "SELECT timestamp, channel, source, target, reason FROM events WHERE guild = ? AND timestamp < ? ORDER BY timestamp DESC LIMIT ?",
            [guildId, before, limit]);
    } else {
        events = await db.query<ClientRelationshipEvent[]>(
            "SELECT timestamp, channel, source, target, reason FROM events WHERE guild = ? ORDER BY timestamp DESC LIMIT ?",
            [guildId, limit]);
    }

    const userIds = new Set<string>();
    for (const event of events) {
        userIds.add(event.source);
        userIds.add(event.target);
    }

    const users = [];
    if (userIds.size > 0) {
        type QueryRow = {
            id: string,
            bot: number,
            name: string,
            discriminator: number,
            nickname: string | null,
            avatar: Buffer | null,
            animated: number,
            guild_avatar: Buffer | null,
            guild_animated: number,
        };

        const results = await db.query<QueryRow[]>(
            "SELECT u.id, u.bot, u.name, u.discriminator, m.nickname, u.avatar, u.animated, m.avatar AS guild_avatar, m.animated AS guild_animated FROM users u LEFT JOIN members m ON m.guild = ? AND m.user = u.id AND m.departed = 0 WHERE u.id IN (?)",
            [guildId, Array.from(userIds.keys())]);

        const avatarToHash = (avatar: Buffer, animated: number) =>
            `${animated ? 'a_' : ''}${avatar.reverse().toString('hex').padStart(32, '0')}`;

        for (const row of results) {
            const avatar = row.guild_avatar !== null ?
                `https://cdn.discordapp.com/guilds/${guildId}/users/${row.id}/avatars/${avatarToHash(row.guild_avatar, row.guild_animated)}.png` :
                (row.avatar !== null ?
                    `https://cdn.discordapp.com/avatars/${row.id}/${avatarToHash(row.avatar, row.animated)}.png` :
                    `https://cdn.discordapp.com/embed/avatars/${row.discriminator % 5}.png`);

            users.push({
                id: row.id,
                bot: row.bot !== 0,
                username: `${row.name}#${row.discriminator.toString().padStart(4, '0')}`,
                nickname: row.nickname ?? row.name,
                avatar,
            });
        }
    }

    // TODO: Load missing users from Discord and include them in the response.

    res.status(200).json({
        limit,
        events,
        users,
    });
};

export default server;
