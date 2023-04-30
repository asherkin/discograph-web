import serverlessMysql from "serverless-mysql";

const url = process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL) : null;
if (url && url.protocol !== "mysql:") {
    throw new Error("expected DATABASE_URL to use mysql:// scheme");
}
export const db = serverlessMysql({
    config: {
        user: url?.username || undefined,
        password: url?.password || undefined,
        database: url?.pathname ? url.pathname.substring(1) : undefined,
        host: url?.host || undefined,
        port: (url && url.port) ? parseInt(url.port) : undefined,
        typeCast: true,
        supportBigNumbers: true,
        bigNumberStrings: true,
    },
});

/**
 * Return IDs of user's guilds that we got data from in the last 30 days.
 */
export async function filterListOfGuildIdsWithBotActivity(ids: string[]): Promise<string[]> {
    const results = await db.query<{ guild: string }[]>(
        "SELECT guild FROM events WHERE guild IN (?) GROUP BY guild HAVING MAX(timestamp) >= ((UNIX_TIMESTAMP() - 2592000) * 1000)",
        [ids]);

    return results.map(row => row.guild);
}
