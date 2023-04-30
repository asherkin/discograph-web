import { JWT } from "next-auth/jwt";

export interface DiscordGuildInfo {
    id: string,
    name: string,
    icon: string,
    owner: boolean,
    permissions: string,
    features: string[],
}

export async function getUserDiscordGuilds(token: JWT): Promise<DiscordGuildInfo[]> {
    const response = await fetch("https://discord.com/api/v10/users/@me/guilds", {
        headers: {
            "Authorization": `${token.token_type} ${token.access_token}`,
        },
    });

    // for (const [name, value] of response.headers) {
    //     if (name.startsWith("x-ratelimit-")) {
    //         console.log(name, value);
    //     }
    // }

    const body = await response.json();

    if (response.status === 429) {
        console.log(`Rate limit hit, retrying in ${body.retry_after} seconds`);

        await new Promise(resolve => {
            setTimeout(resolve, body.retry_after * 1000);
        });

        return getUserDiscordGuilds(token);
    }

    if (!response.ok) {
        throw new Error(`${response.status} error from discord: ${JSON.stringify(body)}`);
    }

    return body;
}