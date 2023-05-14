import {
    ChevronDoubleLeftIcon,
    ChevronDoubleRightIcon,
    ChevronLeftIcon,
    ChevronRightIcon,
} from "@heroicons/react/24/outline";
import dynamic from "next/dynamic";
import { useRouter } from "next/router";
import { Fragment, useCallback, useState } from "react";

import { Button, Callout, CheckboxInput, RangeInput } from "@/components/core";
import { DEFAULT_GRAPH_CONFIG, GraphConfig, GraphStats } from "@/lib/guildGraphConfig";
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

function formatTimestamp(timestamp: number): string {
    function padTwoZeros(n: number): string {
        return n.toString(10).padStart(2, '0');
    }

    const date = new Date(timestamp);
    return `${date.getFullYear()}-${padTwoZeros(date.getMonth() + 1)}-${padTwoZeros(date.getDate())} ${padTwoZeros(date.getHours())}:${padTwoZeros(date.getMinutes())}`;
}

function GraphStatsDisplay({ stats }: { stats: GraphStats | null }) {
    const display = [
        ["Number of Users", stats?.nodeCount],
        ["Oldest Event", stats?.oldestEvent && formatTimestamp(stats.oldestEvent)],
        ["Latest Event", stats?.newestEvent && formatTimestamp(stats.newestEvent)],
        ["Events Loaded", stats?.eventsLoaded],
        ["Events Processed", stats?.eventsProcessed],
        ["Events Included", stats?.eventsIncluded],
    ] as const;

    return <dl className="flow-root border-t pl-0.5 py-3 text-sm">
        {display.map(([ label, value ]) => <Fragment key={label}>
            <dt className="float-left w-1/2 opacity-60">{label}</dt>
            <dd className="float-left w-1/2 text-right opacity-60">{value ?? <>&nbsp;</>}</dd>
        </Fragment>)}
    </dl>;
}

export default function Server() {
    const router = useRouter();
    const { id } = router.query;

    // We mostly make this request to refresh the user token on a direct link to this page.
    const { data: guild, error: guildError } = useGuildInfo(id);

    const [timestamp, setTimestamp] = useState(Date.now());
    const [graphConfig, setGraphConfig] = useState<GraphConfig>(DEFAULT_GRAPH_CONFIG);
    const [graphStats, setGraphStats] = useState<GraphStats | null>(null);

    const adjustTimestamp = useCallback((offset: number) => {
        setTimestamp(timestamp => Math.min(timestamp + offset, Date.now()));
    }, []);

    const guildErrorCallout = (guildError && !guild) && <div className="flex-grow flex items-center justify-center p-6">
        <Callout intent="danger">
            Failed to load server information, please try again later.
        </Callout>
    </div>;

    return <div className="flex flex-col lg:flex-row flex-grow justify-end">
        <div className="flex-grow border rounded-lg flex z-10 lg:-mb-12 max-lg:min-h-[calc(100vh-9.5rem)]">
            {guild ? <GuildGraph key={guild.id} guild={guild.id} timestamp={timestamp} graphConfig={graphConfig} setGraphStats={setGraphStats} /> : guildErrorCallout}
        </div>
        <div className="max-lg:mt-6 lg:w-80 lg:ms-6 lg:max-h-[calc(100vh-17.75rem)]">
            <h2 className="text-center text-2xl">{guild?.name ?? <>&nbsp;</>}</h2>
            <div className="pt-2 pb-3 flex">
                <Button onClick={adjustTimestamp.bind(null, -(1000 * 60 * 60 * 24 * 30))} size="xs"><ChevronDoubleLeftIcon className="w-5" /></Button>
                <Button onClick={adjustTimestamp.bind(null, -(1000 * 60 * 60 * 24))} size="xs" className="mx-1"><ChevronLeftIcon className="w-5" /></Button>
                <span className="p-1 flex-1 text-center" suppressHydrationWarning={true}>{formatTimestamp(timestamp)}</span>
                <Button onClick={adjustTimestamp.bind(null, (1000 * 60 * 60 * 24))} size="xs" className="mx-1"><ChevronRightIcon className="w-5" /></Button>
                <Button onClick={adjustTimestamp.bind(null, (1000 * 60 * 60 * 24 * 30))} size="xs"><ChevronDoubleRightIcon className="w-5" /></Button>
            </div>
            <div className="h-full overflow-y-auto border-y pt-4 flex flex-col">
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
                <div className="flex-1" />
                <GraphStatsDisplay stats={graphStats} />
            </div>
        </div>
    </div>;
}
