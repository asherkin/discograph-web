import dynamic from "next/dynamic";
import { useRouter } from "next/router";
import { useState } from "react";

import { Callout, CheckboxInput, RangeInput } from "@/components/core";
import { DEFAULT_GRAPH_CONFIG, GraphConfig } from "@/lib/guildGraphConfig";
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

    const [graphConfig, setGraphConfig] = useState<GraphConfig>(DEFAULT_GRAPH_CONFIG);

    const guildErrorCallout = (guildError && !guild) && <div className="flex-grow flex items-center justify-center p-6">
        <Callout intent="danger">
            Failed to load server information, please try again later.
        </Callout>
    </div>;

    return <div className="flex flex-col lg:flex-row flex-grow justify-end">
        <div className="flex-grow border rounded-lg flex z-10 lg:-mb-12 max-lg:min-h-[calc(100vh-9.5rem)]">
            {guild ? <GuildGraph key={guild.id} guild={guild.id} graphConfig={graphConfig} /> : guildErrorCallout}
        </div>
        <div className="max-lg:mt-6 lg:w-80 lg:ms-6 lg:max-h-[calc(100vh-15.5rem)]">
            <h2 className="lg:text-right text-2xl border-b mb-4">{guild?.name ?? <>&nbsp;</>}</h2>
            <div className="h-full overflow-y-auto">
                <Callout intent="warning" className="mb-4">
                    This page is very much a work in progress. More coming soon.
                </Callout>
                <RangeInput label="Decay Amount" min={0.0001} max={0.01} step={0.00001} value={graphConfig.decayAmount} onChange={ev => {
                    const value = parseFloat(ev.currentTarget.value);
                    setGraphConfig(config => ({ ...config, decayAmount: value }));
                }} help="Increase to prefer newer events." />
                <RangeInput label="Decay Threshold" min={0.01} max={1} step={0.01} value={graphConfig.decayThreshold} onChange={ev => {
                    const value = parseFloat(ev.currentTarget.value);
                    setGraphConfig(config => ({ ...config, decayThreshold: value }));
                }} help="Increase to only include newer events." />
                <RangeInput label="Link Threshold" min={0} max={20} step={0.01} value={graphConfig.linkThreshold} onChange={ev => {
                    const value = parseFloat(ev.currentTarget.value);
                    setGraphConfig(config => ({ ...config, linkThreshold: value }));
                }} help="Increase to remove weaker links." />
                <RangeInput label="Node Threshold" min={0} max={40} step={0.01} value={graphConfig.nodeThreshold} onChange={ev => {
                    const value = parseFloat(ev.currentTarget.value);
                    setGraphConfig(config => ({ ...config, nodeThreshold: value }));
                }} help="Increase to remove weakly-connected users." />
                <CheckboxInput label="Exclude Bots" checked={graphConfig.excludeBots} onChange={ev => {
                    const checked = ev.currentTarget.checked;
                    setGraphConfig(config => ({ ...config, excludeBots: checked }))
                }} />
            </div>
        </div>
    </div>;
}
