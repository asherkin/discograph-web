import type { NextApiHandler, NextApiRequest, NextApiResponse } from "next";
import { getToken, JWT } from "next-auth/jwt";

import { getGuildMember, getUser } from "@/lib/discord";
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
    departed: boolean,
}

export type EventsResponse = {
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

export function avatarToHash(avatar: Buffer, animated: boolean): string {
    return `${animated ? "a_" : ""}${avatar.reverse().toString("hex").padStart(32, "0")}`;
}

export function hashToAvatar(hash: string): { avatar: Buffer, animated: boolean } {
    let animated = false;
    if (hash.startsWith("a_")) {
        hash = hash.substring(2);
        animated = true;
    }

    const avatar = Buffer.from(hash, "hex").reverse();

    return { avatar, animated };
}

async function getUserInfo(guildId: string, userIds: string[]): Promise<ClientGuildMember[]> {
    if (userIds.length === 0) {
        return [];
    }

    type UserInfo = {
        bot: boolean,
        name: string,
        discriminator: number,
        avatar: string | null,
    };

    const userInfo = new Map<string, UserInfo>();

    type MemberInfo = {
        nickname: string | null,
        avatar: string | null,
        departed: boolean,
    };

    const memberInfo = new Map<string, MemberInfo>();

    type QueryRow = {
        id: string,
        bot: number,
        name: string,
        discriminator: number,
        avatar: Buffer | null,
        animated: number,
    } & ({
        nickname: string | null,
        guild_avatar: Buffer | null,
        guild_animated: number,
        departed: number,
    } | {
        nickname: null,
        guild_avatar: null,
        guild_animated: null,
        departed: null,
    });

    const loadUsersFromDb = async (userIds: string[]) => {
        const dbResults = await db.query<QueryRow[]>(
            "SELECT u.id, u.bot, u.name, u.discriminator, m.nickname, u.avatar, u.animated, m.avatar AS guild_avatar, m.animated AS guild_animated, m.departed FROM users u LEFT JOIN members m ON m.guild = ? AND m.user = u.id WHERE u.id IN (?)",
            [guildId, userIds]);

        for (const row of dbResults) {
            userInfo.set(row.id, {
                bot: row.bot !== 0,
                name: row.name,
                discriminator: row.discriminator,
                avatar: row.avatar && avatarToHash(row.avatar, row.animated !== 0),
            });

            if (row.departed !== null) {
                memberInfo.set(row.id, {
                    nickname: row.nickname,
                    avatar: row.guild_avatar && avatarToHash(row.guild_avatar, row.guild_animated !== 0),
                    departed: row.departed !== 0,
                });
            }
        }
    };

    // First load the users we have from the DB.
    await loadUsersFromDb(userIds);

    // Then request missing ones via the bot if enabled.
    if (process.env.DISCOGRAPH_API) {
        const missingUserIds = userIds.filter(userId => !userInfo.has(userId) || !memberInfo.has(userId));

        if (missingUserIds.length > 0) {
            const start = Date.now();
            console.log(`Requesting ${missingUserIds.length} users for ${guildId} via bot`);

            const result = await fetch(`${process.env.DISCOGRAPH_API}/api/members`, {
                method: "POST",
                headers: {
                    "Content-Type": "text/plain",
                },
                body: [guildId, ...missingUserIds].join("\n") + "\n",
            });

            console.log(`Bot user request took ${(Date.now() - start) / 1000} seconds`);

            if (result.ok) {
                // The bot writes directly to the DB, so re-request any we asked it for.
                await loadUsersFromDb(missingUserIds);

                const stillMissing = missingUserIds.filter(userId => !userInfo.has(userId) || !memberInfo.has(userId));
                if (stillMissing.length > 0) {
                    console.log(`Still missing ${stillMissing.length} users: ${stillMissing.join(", ")}`);
                }
            } else {
                console.log(`Failed to load users via bot (${result.status}): ${await result.text()}`);
            }
        }
    }

    // Then finally attempt to fetch any that are still missing from Discord.
    const loadPromises = userIds.map(async userId => {
        // We may have both, only user info, or neither - only member info isn't possible.
        // If we've got both, we've got everything we need.
        if (userInfo.has(userId) && memberInfo.has(userId)) {
            return {
                userDirty: false,
                memberDirty: false,
            };
        }

        const member = await getGuildMember(guildId, userId);

        // If we got member info back, we'll use that to update the user too.
        let user = member?.user ?? null;

        // If not, and we didn't have user info already, request that directly.
        if (!user && !userInfo.has(userId)) {
            user = await getUser(userId);

            // In practice, if the user doesn't exist, it appears to be because it is a webhook.
            // Actually delete users still return a valid user object with the details overwritten.
            // We want to save something to the DB here so that we don't keep making invalid requests.
            if (!user) {
                user = {
                    id: userId,
                    bot: true,
                    username: "Unknown Webhook",
                    discriminator: "0000",
                    avatar: null,
                };
            }
        }

        if (user) {
            userInfo.set(userId, {
                bot: user.bot ?? false,
                name: user.username,
                discriminator: parseInt(user.discriminator),
                avatar: user.avatar,
            });
        }

        memberInfo.set(userId, member ? {
            nickname: member.nick ?? null,
            avatar: member.avatar ?? null,
            departed: false,
        } : {
            nickname: null,
            avatar: null,
            departed: true,
        });

        return {
            userDirty: user !== null,
            memberDirty: true,
        };
    });

    const apiResults = await Promise.allSettled(loadPromises);
    const userInserts = [];
    const memberInserts = [];

    for (const [ i, result ] of apiResults.entries()) {
        const userId = userIds[i];

        if (result.status === "rejected") {
            console.log(`Failed to load info for ${userId} in ${guildId}: ${result.reason}`);
            continue;
        }

        if (result.value.userDirty) {
            const user = userInfo.get(userId)!;
            const avatar = user.avatar ? hashToAvatar(user.avatar) : null;
            userInserts.push([
                userId,
                user.name,
                user.discriminator,
                user.bot,
                avatar && avatar.avatar,
                avatar ? avatar.animated : false,
            ]);
        }

        if (result.value.memberDirty) {
            const member = memberInfo.get(userId)!;
            const avatar = member.avatar ? hashToAvatar(member.avatar) : null;
            memberInserts.push([
                guildId,
                userId,
                member.nickname,
                avatar && avatar.avatar,
                avatar ? avatar.animated : false,
                member.departed,
            ]);
        }
    }

    if (userInserts.length > 0) {
        await db.query(
            "INSERT INTO users (id, name, discriminator, bot, avatar, animated) VALUES ? ON DUPLICATE KEY UPDATE name = VALUE(name), discriminator = VALUE(discriminator), bot = VALUE(bot), avatar = VALUE(avatar), animated = VALUE(animated)",
            [userInserts]);
    }

    if (memberInserts.length > 0) {
        await db.query(
            "INSERT INTO members (guild, user, nickname, avatar, animated, departed) VALUES ? ON DUPLICATE KEY UPDATE nickname = VALUE(nickname), avatar = VALUE(avatar), animated = VALUE(animated), departed = VALUE(departed)",
            [memberInserts]);
    }

    return userIds.map(userId => {
        const user = userInfo.get(userId)!;
        const member = memberInfo.get(userId)!;

        const avatar = member.avatar !== null ?
            `https://cdn.discordapp.com/guilds/${guildId}/users/${userId}/avatars/${member.avatar}.png` :
            (user.avatar !== null ?
                `https://cdn.discordapp.com/avatars/${userId}/${user.avatar}.png` :
                `https://cdn.discordapp.com/embed/avatars/${user.discriminator % 5}.png`);

        return {
            id: userId,
            bot: user.bot,
            username: `${user.name}#${user.discriminator.toString(10).padStart(4, "0")}`,
            nickname: member.nickname ?? user.name,
            avatar,
            departed: member.departed,
        };
    });
}

// TODO: Rate limit this and the servers API per-user.
const events: NextApiHandler<EventsResponse | ErrorResponse> = async (req, res) => {
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

    const users = await getUserInfo(guildId, Array.from(userIds));

    res.status(200).json({
        limit,
        events,
        users,
    });
};

export default events;
