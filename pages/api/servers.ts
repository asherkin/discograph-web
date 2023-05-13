import type { NextApiHandler } from "next";
import { getToken } from "next-auth/jwt";

import { db, filterListOfGuildIdsWithBot } from "@/lib/db";
import { getUserGuilds } from "@/lib/discord";

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
  tokenNeedsRefresh: boolean,
}

interface ErrorResponse {
  error: string,
}

function compareGuildIdArrays(a: string[], b: string[]) {
  const length = a.length;
  if (length !== b.length) {
    return false;
  }

  a = a.slice().sort();
  b = b.slice().sort();

  for (let i = 0; i < length; ++i) {
    if (a[i] !== b[i]) {
      return false;
    }
  }

  return true;
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

  const guilds = await getUserGuilds(token);

  // There doesn't appear to be any way to modify the token or session from the server directly,
  // so we have this check and pass it on to the client to make the request to refresh the token's list.
  const tokenNeedsRefresh = !compareGuildIdArrays(token.guild_ids, guilds.map(guild => guild.id));

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

  const existingGuilds = new Set(await filterListOfGuildIdsWithBot(clientGuilds.map(guild => guild.id)));

  const groupedGuilds: ServersResponse = {
    added: [],
    managed: [],
    other: [],
    tokenNeedsRefresh,
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
