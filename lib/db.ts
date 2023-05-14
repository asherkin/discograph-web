import serverlessMysql from "serverless-mysql";

const url = new URL(process.env.DATABASE_URL ?? "mysql://root@localhost/discograph");
if (url.protocol !== "mysql:") {
    throw new Error("expected DATABASE_URL to use mysql:// scheme");
}

export const db = serverlessMysql({
    config: {
        user: url.username || undefined,
        password: url.password || undefined,
        database: url.pathname ? url.pathname.substring(1) : undefined,
        host: url.hostname || undefined,
        port: url.port ? parseInt(url.port) : undefined,
        charset: "utf8mb4",
        typeCast: true,
        supportBigNumbers: true,
        bigNumberStrings: true,
    },
});

/**
 * Filter a list of guild IDs to those where the bot is present.
 */
export async function filterListOfGuildIdsWithBot(ids: string[]): Promise<string[]> {
    if (ids.length === 0) {
        return [];
    }

    const results = await db.query<{ id: string }[]>(
        "SELECT id FROM guilds WHERE id IN (?) AND departed IS NULL",
        [ids]);

    return results.map(row => row.id);
}
