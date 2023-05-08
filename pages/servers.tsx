import { ChevronDownIcon, ChevronRightIcon } from "@heroicons/react/24/outline";
import { useSession } from "next-auth/react";
import { useEffect, useRef, useState } from "react";
import useSWR from "swr";

import { Callout } from "@/components/core";
import { GuildCard, GuildCardInteraction } from "@/components/guildCard";
import { ClientDiscordGuildInfo, ServersResponse } from "@/pages/api/servers";

interface GuildCardListProps {
    title: string;
    subtitle: string;
    guilds: ClientDiscordGuildInfo[];
    initialExpanded?: boolean,
    interaction?: GuildCardInteraction,
}

function GuildCardList({ guilds, subtitle, title, initialExpanded = false, interaction }: GuildCardListProps) {
    const [expanded, setExpanded] = useState(initialExpanded);

    return <div className="mb-3">
        <div className="text-lg cursor-pointer" onClick={() => setExpanded(expanded => !expanded)}>
            {expanded ? <ChevronDownIcon className="inline h-6 w-6 mr-1" /> : <ChevronRightIcon className="inline h-6 w-6 mr-1" />}
            {title}
        </div>
        {expanded && <div className="mx-7">
            <p className="opacity-60">{subtitle}</p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 mt-3 mb-6">
                {guilds.map(guild => <GuildCard key={guild.id} guild={guild} interaction={interaction} />)}
            </div>
        </div>}
    </div>;
}

// This is the client-side counterpart to the hackery detailed in /api/servers.
export function useServersAndHandleTokenRefresh() {
    const { update } = useSession();

    const tokenNeededRefresh = useRef(false);
    const { data, error } = useSWR<ServersResponse>("/api/servers");

    const tokenNeedsRefresh = data?.tokenNeedsRefresh;
    useEffect(() => {
        if (tokenNeedsRefresh === undefined) {
            return;
        }

        if (tokenNeedsRefresh && !tokenNeededRefresh.current) {
            update({ tokenNeedsRefresh });
        }

        tokenNeededRefresh.current = tokenNeedsRefresh;
    }, [update, tokenNeedsRefresh]);

    return { data, error };
}

export default function Servers() {
    let placeholderGuild: ClientDiscordGuildInfo = {
        id: "",
        name: "Loading ...",
        can_manage: false,
        icon_url: null,
        hover_icon_url: null,
    };

    let guilds: ServersResponse = {
        added: [placeholderGuild],
        managed: [],
        other: [],
        tokenNeedsRefresh: false,
    };

    const { data, error } = useServersAndHandleTokenRefresh();
    if (data) {
        guilds = data;
    } else if (error) {
        // We'll only display an error if we've never loaded data - guilds don't change often.
        return <div className="flex-grow flex items-center justify-center p-6">
            <Callout intent="danger">
                Failed to load server information, please try again later.
            </Callout>
        </div>;
    }

    return <div className="container mx-auto">
        <GuildCardList initialExpanded={true} title="Active Servers"
            subtitle="These servers have DiscoGraph installed and active."
            guilds={guilds.added} interaction="view" />
        {guilds.managed.length > 0 && <GuildCardList initialExpanded={true} title="Your Servers"
            subtitle="These are servers you could (and should) add DiscoGraph to."
            guilds={guilds.managed} interaction="add" />}
        <GuildCardList title="Other Servers"
            subtitle="All the other (much more boring) servers that you are in."
            guilds={guilds.other} interaction="disabled" />
    </div>;
}
