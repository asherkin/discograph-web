import NextAuth, { Account, DefaultSession } from "next-auth";
import { DefaultJWT } from "next-auth/jwt";
import DiscordProvider from "next-auth/providers/discord";

import { getApplicationInfo, getUserGuilds } from "@/lib/discord";

export default NextAuth({
    pages: {
        signIn: "/auth/login",
    },
    callbacks: {
        async jwt({ token, account, session }) {
            if (account) {
                if (!isDiscordAccount(account)) {
                    throw new Error("Expected a Discord login");
                }

                if (!(account.scope ?? "").split(" ").includes("guilds")) {
                    throw new Error("Discord token missing 'guilds' scope");
                }

                token = {
                    ...token,
                    access_token: account.access_token,
                    refresh_token: account.refresh_token,
                    token_type: account.token_type,
                    expires_at: account.expires_at * 1000,
                    auth_expires_at: 0,
                    role: "user",
                    guild_ids: [],
                };
            } else if (!token.expires_at || token.expires_at <= Date.now()) {
                const response = await fetch("https://discord.com/api/oauth2/token", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/x-www-form-urlencoded",
                    },
                    body: new URLSearchParams({
                        client_id: process.env.NEXT_PUBLIC_DISCORD_ID!,
                        client_secret: process.env.DISCORD_SECRET!,
                        grant_type: "refresh_token",
                        refresh_token: token.refresh_token,
                    }),
                });

                const tokens: DiscordTokenSet = await response.json();

                if (!response.ok) {
                    throw tokens;
                }

                token = {
                    ...token,
                    access_token: tokens.access_token,
                    refresh_token: tokens.refresh_token,
                    token_type: tokens.token_type,
                    expires_at: Date.now() + (tokens.expires_in * 1000),
                };
            }

            const authExpired = !token.auth_expires_at || token.auth_expires_at <= Date.now();
            const authNeedsRefresh = session?.tokenNeedsRefresh;
            if (authExpired || authNeedsRefresh) {
                const [application, guilds] = await Promise.all([
                    getApplicationInfo(),
                    getUserGuilds(token),
                ]);

                const adminIds = new Set(application.team ? application.team.members.map(member => member.user.id) : []);

                token = {
                    ...token,
                    auth_expires_at: Date.now() + (10 * 60 * 1000),
                    role: adminIds.has(token.sub) ? "admin" : "user",
                    guild_ids: guilds.map(guild => guild.id),
                };
            }

            return token;
        },
        async session({ session, token }) {
            return {
                ...session,
                role: token.role,
            };
        }
    },
    providers: [
        DiscordProvider({
            clientId: process.env.NEXT_PUBLIC_DISCORD_ID!,
            clientSecret: process.env.DISCORD_SECRET!,
            authorization: {
                params: {
                    prompt: "none",
                    scope: "identify guilds",
                },
            },
            profile(profile) {
                if (profile.avatar === null) {
                    const defaultAvatarNumber = parseInt(profile.discriminator) % 5;
                    profile.image_url = `https://cdn.discordapp.com/embed/avatars/${defaultAvatarNumber}.png`;
                } else {
                    profile.image_url = `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png`;
                }

                return {
                    id: profile.id,
                    name: `${profile.username}#${profile.discriminator}`,
                    email: profile.email,
                    image: profile.image_url,
                };
            },
        }),
    ],
});

declare module "next-auth/core/types" {
    interface Session extends DefaultSession {
        role: "admin" | "user"
    }
}

declare module "next-auth/jwt/types" {
    interface JWT extends DefaultJWT {
        // Discord user ID
        sub: string,
        access_token: string
        refresh_token: string
        token_type: string
        expires_at: number
        auth_expires_at: number
        role: "admin" | "user"
        guild_ids: string[]
    }
}

interface DiscordTokenSet {
    access_token: string
    token_type: string
    expires_in: number
    refresh_token: string
    scope: string
}

interface DiscordAccount extends Account {
    provider: "discord"
    access_token: string
    token_type: string
    expires_at: number
    refresh_token: string
    scope: string
}

function isDiscordAccount(account: Account): account is DiscordAccount {
    return account.provider === "discord";
}
