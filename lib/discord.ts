import { JWT } from "next-auth/jwt";

const headOfLineRequests = new Map<string, Promise<any>>();
const rateLimitBucketKeys = new Map<string, string>();
const rateLimitBuckets = new Map<string, { resetAt: number, remaining: number }>();

async function makeDiscordRequestInner<T>(rateLimitKey: string, authorizationHeader: string, pathname: string, attempt: number): Promise<T> {
    // Get the currently known rate limit bucket key from previous requests.
    let rateLimitBucketKey = rateLimitBucketKeys.get(rateLimitKey);
    const rateLimitBucket = (rateLimitBucketKey !== undefined) ?
        rateLimitBuckets.get(rateLimitBucketKey) :
        undefined;

    // If we don't have a known bucket, only allow a single in-flight request.
    if (rateLimitBucket === undefined) {
        // TODO: This is fairly hacky and would be much better served by the suggestion below.
        const existingRequest = headOfLineRequests.get(rateLimitKey);

        if (existingRequest) {
            console.log(`[${pathname}] No known rate limit bucket and a request is already in-flight, waiting on it.`)

            try {
                await existingRequest;
            } catch (e) {
                // Do nothing.
            }

            // We re-make the request to re-get the bucket.
            return makeDiscordRequestInner(rateLimitKey, authorizationHeader, pathname, attempt);
        }
    }

    // TODO: Consider re-implementing the waits in here as a Promise-based token bucket, which would
    //       appear to be a closer match to the server-side implementation.
    // console.log(`[${pathname}] Known rate limit bucket: ${JSON.stringify(rateLimitBucket)}`);
    if (rateLimitBucket !== undefined) {
        // If we're out of requests in this period, wait for it to be reset.
        // There is still something a little off here as we're getting occasional 429s with ~0.3s retry times,
        // but it is completely obviated as long as we have our 5s debounce, so not worrying about it for now.
        const delayUntil = rateLimitBucket.resetAt - Date.now();
        if (delayUntil > 0 && rateLimitBucket.remaining <= 0) {
            console.log(`[${pathname}] Rate limit would be exceeded, retrying in ${delayUntil / 1000} seconds`)

            await new Promise(resolve => {
                setTimeout(resolve, delayUntil);
            });

            // We re-make the request to re-get the bucket.
            return makeDiscordRequestInner(rateLimitKey, authorizationHeader, pathname, attempt);
        }

        // Count this request against the bucket.
        rateLimitBucket.remaining -= 1;
    }

    const response = await fetch(`https://discord.com/api/v10${pathname}`, {
        headers: {
            "Authorization": authorizationHeader,
        },
    });

    // If we got back a new rate limit bucket key, update it.
    const newRateLimitBucketKey = response.headers.get("x-ratelimit-bucket");
    if (newRateLimitBucketKey !== null && newRateLimitBucketKey !== rateLimitBucketKey) {
        rateLimitBucketKey = newRateLimitBucketKey;
        rateLimitBucketKeys.set(rateLimitKey, rateLimitBucketKey);
    }

    // If we have a bucket key, update the rate limit info too.
    const newLimitRemaining = response.headers.get("x-ratelimit-remaining");
    const newLimitResetAt = response.headers.get("x-ratelimit-reset");
    if (rateLimitBucketKey !== undefined && newLimitRemaining !== null && newLimitResetAt !== null) {
        const remaining = parseInt(newLimitRemaining);
        // Add an extra 500ms to the reset time to account for jitter.
        const resetAt = (parseFloat(newLimitResetAt) * 1000) + 500;

        // If the bucket has the same reset time as the current bucket, only update it if the remaining requests are lower.
        // This avoids a problem with multiple responses racing in-flight.
        if (rateLimitBucket === undefined || resetAt !== rateLimitBucket.resetAt || remaining < rateLimitBucket.remaining) {
            rateLimitBuckets.set(rateLimitBucketKey, { remaining, resetAt });
        }
    }

    // for (const [name, value] of response.headers) {
    //     if (name.startsWith("x-ratelimit-")) {
    //         console.log(pathname, name, value);
    //     }
    // }

    const body = await response.json();

    // Due to how rate limits are implemented, it is possible to be rate limited without warning, handle that too.
    // This works quite well because we queue up identical requests prior to rate limit handling,
    // otherwise this would fight with the buckets.
    if (response.status === 429) {
        console.log(`[${pathname}] Rate limit hit, retrying in ${body.retry_after} seconds`);

        await new Promise(resolve => {
            setTimeout(resolve, (body.retry_after * 1000) + 500);
        });

        // Not a server-side error, so maintain the attempt count.
        return makeDiscordRequestInner(rateLimitKey, authorizationHeader, pathname, attempt);
    }

    // We'll retry after 0.1s, then again after 1s, then give up.
    if (response.status >= 500 && response.status < 600 && (attempt + 1) < 3) {
        const retryAfter = (1 / 10) * (10 ** attempt);
        console.log(`[${pathname}] Server error, retrying in ${retryAfter} seconds`);

        await new Promise(resolve => {
            setTimeout(resolve, retryAfter * 1000);
        });

        return makeDiscordRequestInner(rateLimitKey, authorizationHeader, pathname, attempt + 1);
    }

    setTimeout(() => {
        // Use this time to clean up any expired rate limit buckets.
        // We could do this less often than every request.
        // Keep expired buckets around for 30 minutes.
        const expireFrom = Date.now() - (1000 * 60 * 30);
        const expiredBucketKeys = new Set<string>();
        for (const [bucketKey, bucket] of rateLimitBuckets) {
            if (bucket.resetAt < expireFrom) {
                expiredBucketKeys.add(bucketKey);
            }
        }

        // console.log("Expiring buckets", expiredBucketKeys);
        for (const [requestKey, bucketKey] of rateLimitBucketKeys) {
            if (expiredBucketKeys.has(bucketKey)) {
                rateLimitBucketKeys.delete(requestKey);
            }
        }
    }, 0);

    if (!response.ok) {
        const error: Error & { discordStatusCode?: number } = new Error(`${response.status} error from discord for ${pathname}: ${JSON.stringify(body)}`);
        error.discordStatusCode = response.status;

        throw error;
    }

    return body;
}

const pendingRequests = new Map<string, Promise<any>>();

function makeDiscordRequest<T>(authorizationHeader: string, pathname: string, rateLimitPath: string): Promise<T> {
    const requestKey = `${authorizationHeader} ${pathname}`;
    const pendingRequest = pendingRequests.get(requestKey);
    if (pendingRequest) {
        // console.log(`Request for ${pathname} already in-flight, queueing`);
        return pendingRequest;
    }

    console.log(`New request for ${pathname}`);
    const rateLimitKey = `${authorizationHeader} ${rateLimitPath}`;
    const newRequest = makeDiscordRequestInner<T>(rateLimitKey, authorizationHeader, pathname, 0);

    pendingRequests.set(requestKey, newRequest);

    // This is alright to set unconditionally as we're selective about accessing it instead.
    headOfLineRequests.set(rateLimitKey, newRequest);

    newRequest
        .then(() => true, () => false)
        .then(async (succeeded: boolean) => {
            headOfLineRequests.delete(rateLimitKey);

            // We add a short delay to successful requests to debounce repeated calls - we get a lot of requests on login.
            if (succeeded) {
                await new Promise(resolve => {
                    setTimeout(resolve, 5000);
                });
            }

            // Mark this request as done so future calls re-request.
            pendingRequests.delete(requestKey);
        });

    return newRequest;
}

export function makeDiscordRequestAsUser<T>(token: JWT, pathname: string, rateLimitPath: string): Promise<T> {
    const authorizationHeader = `${token.token_type} ${token.access_token}`;

    return makeDiscordRequest(authorizationHeader, pathname, rateLimitPath);
}

export interface GuildInfo {
    id: string,
    name: string,
    icon: string | null,
    owner: boolean,
    permissions: string,
    features: string[],
}

export async function getUserGuilds(token: JWT): Promise<GuildInfo[]> {
    return makeDiscordRequestAsUser(token, "/users/@me/guilds", "/users/@me/guilds");
}

// This should be avoided where possible, as it shares rate limits with the live bot.
export function makeDiscordRequestAsApp<T>(pathname: string, rateLimitPath: string): Promise<T> {
    const authorizationHeader = `Bot ${process.env.DISCORD_TOKEN}`;

    return makeDiscordRequest(authorizationHeader, pathname, rateLimitPath);
}

export interface UserInfo {
    id: string,
    bot?: boolean,
    username: string,
    discriminator: string,
    avatar: string | null,
}

export interface ApplicationInfo {
    id: string,
    name: string,
    team: {
        members: {
            user: Pick<UserInfo, "id" | "username" | "discriminator" | "avatar">,
        }[],
    } | null,
}

export async function getApplicationInfo(): Promise<ApplicationInfo> {
    return makeDiscordRequestAsApp("/oauth2/applications/@me", "/oauth2/applications/@me");
}

export async function getUser(user: string): Promise<UserInfo | null> {
    try {
        return await makeDiscordRequestAsApp(`/users/${user}`, `/users/_`);
    } catch (error: any) {
        if (error.discordStatusCode !== 404) {
            throw error;
        }

        return null;
    }
}

export interface MemberInfo {
    user: UserInfo,
    nick?: string | null,
    avatar?: string | null,
}

export async function getGuildMember(guild: string, user: string): Promise<MemberInfo | null> {
    try {
        return await makeDiscordRequestAsApp(`/guilds/${guild}/members/${user}`, `/guilds/${guild}/members/_`);
    } catch (error: any) {
        if (error.discordStatusCode !== 404) {
            throw error;
        }

        return null;
    }
}