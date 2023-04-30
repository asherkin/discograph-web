import NextAuth, { Account } from "next-auth";
import { DefaultJWT } from "next-auth/jwt";
import DiscordProvider from "next-auth/providers/discord";

export default NextAuth({
    pages: {
        signIn: "/auth/login",
    },
    callbacks: {
        async jwt({ token, account }) {
            if (account) {
                if (!isDiscordAccount(account)) {
                    throw new Error("Expected a Discord login");
                }

                if (!(account.scope ?? "").split(" ").includes("guilds")) {
                    throw new Error("Discord token missing 'guilds' scope");
                }

                return {
                    ...token,
                    access_token: account.access_token,
                    refresh_token: account.refresh_token,
                    token_type: account.token_type,
                    expires_at: account.expires_at * 1000,
                };
            }

            if (token.expires_at <= Date.now()) {
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

                return {
                    ...token, // Keep the previous token properties
                    access_token: tokens.access_token,
                    refresh_token: tokens.refresh_token,
                    token_type: tokens.token_type,
                    expires_at: Date.now() + (tokens.expires_in * 1000),
                };
            }

            return token;
        },
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
                    // const format = guild.icon.startsWith("a_") ? "gif" : "png";
                    const format = "png";
                    profile.image_url = `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.${format}`;
                }

                return {
                    id: profile.id,
                    name: `${profile.username}#${profile.discriminator.padStart(4, "0")}`,
                    email: profile.email,
                    image: profile.image_url,
                };
            },
        }),
    ],
});

declare module "next-auth/jwt/types" {
    interface JWT extends DefaultJWT {
        access_token: string
        refresh_token: string
        token_type: string
        expires_at: number
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
