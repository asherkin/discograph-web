import dynamic from "next/dynamic";
import { useRouter } from "next/router";

import { Callout } from "@/components/core";
import { useServersAndHandleTokenRefresh } from "@/pages/servers";

const GuildGraph = dynamic(() => import("@/components/guildGraph"), {
    ssr: false,
});

function useGuildInfo(id: string | string[] | undefined) {
    let { data: guilds, error } = useServersAndHandleTokenRefresh();

    let guild;
    if (guilds) {
        guild = guilds.added.find(guild => guild.id === id);
        if (!guild) {
            error = new Error("User doesn't have access to guild.");
        }
    }

    return { data: guild, error }
}

export default function Server() {
    const router = useRouter();
    const { id } = router.query;

    // We mostly make this request to refresh the user token on a direct link to this page.
    const { data: guild, error: guildError } = useGuildInfo(id);

    const guildErrorCallout = (guildError && !guild) && <div className="flex-grow flex items-center justify-center p-6">
        <Callout intent="danger">
            Failed to load server information, please try again later.
        </Callout>
    </div>;

    return <div className="flex flex-col lg:flex-row flex-grow justify-end">
        <div className="flex-grow border rounded-lg flex z-10 lg:-mb-12 max-lg:min-h-[calc(100vh-9.5rem)]">
            {guild ? <GuildGraph key={guild.id} guild={guild.id} /> : guildErrorCallout}
        </div>
        <div className="max-lg:mt-6 lg:w-80 lg:ms-6 lg:max-h-[calc(100vh-15.5rem)]">
            <h2 className="lg:text-right text-2xl border-b mb-4">{guild?.name ?? <>&nbsp;</>}</h2>
            <div className="h-full overflow-y-auto">
                <Callout intent="warning" className="mb-4">
                    This page is very much a work in progress. More coming soon.
                </Callout>
                <Callout intent="warning" className="mb-4">
                    Some users will be missing name and avatar information, this is expected.
                </Callout>
            </div>
        </div>
    </div>;
}
