import { JWT } from "next-auth/jwt";

const pendingRequests = new Map<string, Promise<any>>();

const rateLimitBucketKeys = new Map<string, string>();
const rateLimitBuckets = new Map<string, { resetAt: number, remaining: number }>();

async function makeDiscordRequestInner<T>(requestKey: string, authorizationHeader: string, pathname: string, attempt: number): Promise<T> {
    // Get the currently known rate limit bucket key from previous requests.
    let rateLimitBucketKey = rateLimitBucketKeys.get(requestKey);
    const rateLimitBucket = (rateLimitBucketKey !== undefined) ?
        rateLimitBuckets.get(rateLimitBucketKey) :
        undefined;

    // console.log(`[${pathname}] Known rate limit bucket: ${JSON.stringify(rateLimitBucket)}`);
    if (rateLimitBucket !== undefined) {
        // If we have an existing bucket, count this request against it.
        rateLimitBucket.remaining -= 1;

        // If we're out of requests in this period, wait for it to be reset.
        // There is still something a little off here as we're getting occasional 429s with ~0.3s retry times,
        // but it is completely obviated as long as we have our 5s debounce, so not worrying about it for now.
        const delayUntil = rateLimitBucket.resetAt - Date.now();
        if (delayUntil > 0 && rateLimitBucket.remaining <= 0) {
            // console.log(`[${pathname}] Rate limit would be exceeded, waiting for ${delayUntil / 1000} seconds`)

            await new Promise(resolve => {
                setTimeout(resolve, delayUntil);
            });
        }
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
        rateLimitBucketKeys.set(requestKey, rateLimitBucketKey);
    }

    // If we have a bucket key, update the rate limit info too.
    const newLimitRemaining = response.headers.get("x-ratelimit-remaining");
    const newLimitResetAt = response.headers.get("x-ratelimit-reset");
    if (rateLimitBucketKey !== undefined && newLimitRemaining !== null && newLimitResetAt !== null) {
        rateLimitBuckets.set(rateLimitBucketKey, {
            remaining: parseInt(newLimitRemaining),
            resetAt: parseFloat(newLimitResetAt) * 1000,
        })
    }

    // for (const [name, value] of response.headers) {
    //     if (name.startsWith("x-ratelimit-")) {
    //         console.log(name, value);
    //     }
    // }

    const body = await response.json();

    // Due to how rate limits are implemented, it is possible to be rate limited without warning, handle that too.
    // This works quite well because we queue up identical requests prior to rate limit handling,
    // otherwise this would fight with the buckets.
    if (response.status === 429) {
        console.log(`[${pathname}] Rate limit hit, retrying in ${body.retry_after} seconds`);

        await new Promise(resolve => {
            setTimeout(resolve, body.retry_after * 1000);
        });

        // Not a server-side error, so maintain the attempt count.
        return makeDiscordRequestInner(requestKey, authorizationHeader, pathname, attempt);
    }

    // We'll retry after 0.1s, then again after 1s, then give up.
    if (response.status >= 500 && response.status < 600 && (attempt + 1) < 3) {
        const retryAfter = (1 / 10) * (10 ** attempt);
        console.log(`[${pathname}] Server error, retrying in ${retryAfter} seconds`);

        await new Promise(resolve => {
            setTimeout(resolve, retryAfter * 1000);
        });

        return makeDiscordRequestInner(requestKey, authorizationHeader, pathname, attempt + 1);
    }

    // Mark this request as done so future calls re-request.
    // We add a short delay to successful requests to debounce repeated calls - we get a lot of requests on login.
    setTimeout(() => {
        pendingRequests.delete(requestKey);

        // Use this time to clean up any expired rate limit buckets.
        // We could do this less often than every request.
        const now = Date.now();
        const expiredBucketKeys = new Set<string>();
        for (const [bucketKey, bucket] of rateLimitBuckets) {
            if (bucket.resetAt < now) {
                expiredBucketKeys.add(bucketKey);
            }
        }

        // console.log("Expiring buckets", expiredBucketKeys);
        for (const [requestKey, bucketKey] of rateLimitBucketKeys) {
            if (expiredBucketKeys.has(bucketKey)) {
                rateLimitBucketKeys.delete(requestKey);
            }
        }
    }, response.ok ? 5000 : 0);

    if (!response.ok) {
        throw new Error(`${response.status} error from discord for ${pathname}: ${JSON.stringify(body)}`);
    }

    return body;
}

function makeDiscordRequest<T>(token: JWT, pathname: string): Promise<T> {
    const authorizationHeader = `${token.token_type} ${token.access_token}`;
    const requestKey = `${authorizationHeader} ${pathname}`;

    const pendingRequest = pendingRequests.get(requestKey);
    if (pendingRequest) {
        // console.log(`Request for ${pathname} already in-flight, queueing`);
        return pendingRequest;
    }

    // console.log(`New request for ${pathname}`);
    const newRequest = makeDiscordRequestInner<T>(requestKey, authorizationHeader, pathname, 0);
    pendingRequests.set(requestKey, newRequest);

    return newRequest;
}

export interface DiscordGuildInfo {
    id: string,
    name: string,
    icon: string | null,
    owner: boolean,
    permissions: string,
    features: string[],
}

export async function getUserDiscordGuilds(token: JWT): Promise<DiscordGuildInfo[]> {
    return makeDiscordRequest(token, "/users/@me/guilds");
}