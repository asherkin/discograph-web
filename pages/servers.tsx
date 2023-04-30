import { ChevronDownIcon, ChevronRightIcon } from "@heroicons/react/24/outline";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import useSWR from "swr";

import { ClientDiscordGuildInfo, ServersResponse } from "@/pages/api/servers";

interface GuildCardProps {
    guild: ClientDiscordGuildInfo;
}

function GuildCard({ guild }: GuildCardProps) {
    const [isHovered, setIsHovered] = useState(false);
    const iconUrl = isHovered ? guild.hover_icon_url : guild.icon_url;

    return <div onMouseOver={() => setIsHovered(true)} onMouseOut={() => setIsHovered(false)} className="w-full h-full flex items-center cursor-pointer p-3 rounded-xl ring-indigo-500 hover:ring-1 bg-white active:bg-slate-100 dark:bg-slate-900 dark:active:bg-slate-800">
        {iconUrl ? <Image src={iconUrl} width={64} height={64} alt="" className="mr-4 rounded-lg" /> : <div style={{ width: 64, height: 64 }} className="mr-4" />}
        <span>{guild.name}</span>
    </div>;
}

interface GuildCardListProps {
    title: string;
    subtitle: string;
    guilds: ClientDiscordGuildInfo[];
    initialExpanded?: boolean,
}

function GuildCardList({ guilds, subtitle, title, initialExpanded }: GuildCardListProps) {
    const [expanded, setExpanded] = useState(initialExpanded ?? false);

    return <div className="mb-3">
        <div className="text-lg cursor-pointer" onClick={() => setExpanded(expanded => !expanded)}>
            {expanded ? <ChevronDownIcon className="inline h-6 w-6 mr-1" /> : <ChevronRightIcon className="inline h-6 w-6 mr-1" />}
            {title}
        </div>
        {expanded && <div className="mx-7">
            <p className="opacity-60">{subtitle}</p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 mt-3 mb-6">
                {guilds.map(guild => <Link key={guild.id} href={{ pathname: "/server/[id]", query: { id: guild.id } }}>
                    <GuildCard guild={guild} />
                </Link>)}
            </div>
        </div>}
    </div>;
}

const fetcher = (...args: Parameters<typeof fetch>) => fetch(...args).then((res) => res.json());

export default function Servers() {
    let placeholderGuild: ClientDiscordGuildInfo = {
        id: "",
        name: "Loading ...",
        can_manage: false,
        icon_url: "",
        hover_icon_url: "",
    };

    let guilds: ServersResponse = {
        added: [placeholderGuild],
        managed: [],
        other: [],
    };

    const { data, error } = useSWR<ServersResponse>('/api/servers', fetcher);
    if (data) {
        guilds = data;
    }

    if (error) {
        return <div className="flex-grow flex items-center justify-center p-6">
            <div className="bg-red-50 text-red-950 border-red-700 dark:bg-red-950 dark:text-red-100 border border-s-4 p-4 rounded-xl">
                Failed to load server information, please try again later.
            </div>
        </div>;
    }

    return <div className="container mx-auto">
        <GuildCardList initialExpanded={true} title="Active Servers"
            subtitle="These servers have DiscoGraph installed and active."
            guilds={guilds.added} />
        {guilds.managed.length > 0 && <GuildCardList initialExpanded={true} title="Your Servers"
            subtitle="These are servers you could (and should) add DiscoGraph to."
            guilds={guilds.managed} />}
        <GuildCardList title="Other Servers"
            subtitle="All the other (much more boring) servers that you are in."
            guilds={guilds.other} />
    </div>;
}
