import type { NextApiHandler } from "next";
import { getToken } from "next-auth/jwt";

import { db, filterListOfGuildIdsWithBotActivity } from "@/lib/db";
import { getUserDiscordGuilds } from "@/lib/discord";

export interface ClientDiscordGuildInfo {
  id: string,
  name: string,
  can_manage: boolean,
  icon_url: string | null,
  hover_icon_url: string | null,
}

export interface ServersResponse {
  added: ClientDiscordGuildInfo[],
  managed: ClientDiscordGuildInfo[],
  other: ClientDiscordGuildInfo[],
}

interface ErrorResponse {
  error: string,
}

const servers: NextApiHandler<ServersResponse | ErrorResponse> = async (req, res) => {
  const token = await getToken({ req });
  if (!token) {
    res.status(403).json({
      error: 'not authenticated',
    });

    return;
  }

  // Ensure that we can actually connect before querying Discord - only important during dev.
  await db.connect();

  const guilds = await getUserDiscordGuilds(token);

  const clientGuilds = guilds.map(({ id, name, icon, permissions }): ClientDiscordGuildInfo => {
    const iconFormat = icon?.startsWith("a_") ? "gif" : "png";
    return {
      id,
      name,
      can_manage: (BigInt(permissions) & BigInt(1 << 3)) === BigInt(1 << 3),
      icon_url: icon ? `https://cdn.discordapp.com/icons/${id}/${icon}.png` : null,
      hover_icon_url: icon ? `https://cdn.discordapp.com/icons/${id}/${icon}.${iconFormat}` : null,
    }
  });

  clientGuilds.sort((a, b) => a.name.localeCompare(b.name));

  // IDs of user's guilds that we got data from in the last 30 days.
  const existingGuilds = new Set(await filterListOfGuildIdsWithBotActivity(clientGuilds.map(guild => guild.id)));

  const groupedGuilds: ServersResponse = {
    added: [],
    managed: [],
    other: [],
  };

  for (const guild of clientGuilds) {
    if (existingGuilds.has(guild.id)) {
      groupedGuilds.added.push(guild);
    } else if (guild.can_manage) {
      groupedGuilds.managed.push(guild);
    } else {
      groupedGuilds.other.push(guild);
    }
  }

  res.status(200).json(groupedGuilds);
};

export default servers;
