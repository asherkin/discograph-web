import { ArrowTopRightOnSquareIcon } from "@heroicons/react/24/outline";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

import { ClientDiscordGuildInfo } from "@/pages/api/servers";

interface InnerGuildCardProps {
    guild: ClientDiscordGuildInfo,
    showExternalIcon?: boolean,
}

function InnerGuildCard({ guild, showExternalIcon = false }: InnerGuildCardProps) {
    const [isHovered, setIsHovered] = useState(false);
    const iconUrl = isHovered ? guild.hover_icon_url : guild.icon_url;

    return <div
        onMouseOver={() => setIsHovered(true)}
        onMouseOut={() => setIsHovered(false)}
        className="w-full h-full flex items-center p-3"
    >
        {iconUrl ?
            <Image src={iconUrl} width={64} height={64} alt="" className="mr-4 rounded-lg" /> :
            <div style={{ width: 64, height: 64 }} className="mr-4" />}
        <span className="flex-1">{guild.name}</span>
        {showExternalIcon && <ArrowTopRightOnSquareIcon className="h-5 w-5 mr-3" />}
    </div>;
}

export type GuildCardInteraction = "none" | "add" | "view" | "disabled";

interface GuildCardProps {
    guild: ClientDiscordGuildInfo,
    interaction?: GuildCardInteraction,
}

export function GuildCard({ guild, interaction = "none" }: GuildCardProps) {
    let className = "rounded-xl border border-slate-200 dark:bg-transparent";
    if (interaction !== "disabled") {
        className = `${className} bg-white`;

        if (interaction !== "none") {
            className = `${className} cursor-pointer hover:border-indigo-500 active:bg-slate-100 dark:active:bg-slate-800`;
        }
    } else {
        className = `${className} bg-slate-50 opacity-60 dark:opacity-50`;
    }

    if (interaction === "none" || interaction === "disabled") {
        return <div className={className}>
            <InnerGuildCard guild={guild} />
        </div>;
    } else if (interaction === "add") {
        return <Link key={guild.id} target="_blank" rel="noreferrer" href={{
            protocol: "https:",
            host: "discord.com",
            pathname: "/api/oauth2/authorize",
            query: {
                client_id: process.env.NEXT_PUBLIC_DISCORD_ID,
                scope: "bot applications.commands",
                permissions: "274878024768",
                guild_id: guild.id,
                disable_guild_select: "true",
            },
        }} className={className}>
            <InnerGuildCard guild={guild} showExternalIcon />
        </Link>;
    } else if (interaction === "view") {
        return <Link key={guild.id} href={{
            pathname: "/server/[id]",
            query: {
                id: guild.id,
            },
        }} className={className}>
            <InnerGuildCard guild={guild} />
        </Link>;
    }

    throw new Error(`Unknown InteractiveGuildCard interaction type '${interaction}'`);
}