import {
    ChevronDoubleLeftIcon,
    ChevronDoubleRightIcon,
    ChevronLeftIcon,
    ChevronRightIcon,
} from "@heroicons/react/20/solid";
import { GetServerSideProps } from "next";
import { getToken } from "next-auth/jwt";
import { signIn } from "next-auth/react";
import dynamic from "next/dynamic";
import Head from "next/head";
import { useRouter } from "next/router";
import { ParsedUrlQuery, ParsedUrlQueryInput } from "querystring";
import { Fragment, useCallback, useEffect, useRef, useState } from "react";

import { Button, Callout, CheckboxInput, RangeInput } from "@/components/core";
import { SmallStepIcon } from "@/components/icons";
import { db } from "@/lib/db";
import {
    decodeGraphConfig,
    DEFAULT_ENCODED_GRAPH_CONFIG,
    DEFAULT_GRAPH_CONFIG,
    encodeGraphConfig,
    GraphConfig,
    GraphStats,
} from "@/lib/guildGraphConfig";
import { avatarToHash } from "@/pages/api/server/[id]/events";
import { ClientDiscordGuildInfo } from "@/pages/api/servers";
import { useServersAndHandleTokenRefresh } from "@/pages/servers";

const GuildGraph = dynamic(() => import("@/components/guildGraph"), {
    ssr: false,
});

interface ServerParams extends ParsedUrlQuery {
    id: string,
    timestamp: string[] | undefined,
}

interface ServerProps {
    id: string,
    guild: ClientDiscordGuildInfo | null,
    authenticationRequired: boolean,
}

export const getServerSideProps: GetServerSideProps<ServerProps, ServerParams> = async (context) => {
    const id = context.params!.id;
    if (!id.match(/^\d+$/)) {
        return {
            notFound: true,
        };
    }

    if (context.params?.timestamp && (context.params.timestamp.length > 1 || Number.isNaN(parseInt(context.params.timestamp[0], 10)))) {
        return {
            notFound: true,
        };
    }

    const guild = (await db.query<[{
        name: string | null,
        icon: Buffer | null,
        animated: number,
        flags: number,
    } | undefined]>(
        "SELECT name, icon, animated, flags FROM guilds WHERE id = ? AND departed IS NULL",
        [id]))[0];

    if (!guild) {
        return {
            notFound: true,
        };
    }

    const icon = guild.icon && avatarToHash(guild.icon,  guild.animated !== 0);
    const iconFormat = (guild.animated !== 0) ? "gif" : "png";

    const clientGuild = {
        id,
        name: guild.name ?? id,
        can_manage: false,
        icon_url: icon ? `https://cdn.discordapp.com/icons/${id}/${icon}.png` : null,
        hover_icon_url: icon ? `https://cdn.discordapp.com/icons/${id}/${icon}.${iconFormat}` : null,
    };

    const isDiscoverable = (guild.flags & (1 << 0)) !== 0;

    const token = await getToken({ req: context.req });
    const authenticationRequired = token === null;

    const includeGuild = (authenticationRequired && isDiscoverable);

    return {
        props: {
            id: id,
            guild: includeGuild ? clientGuild : null,
            authenticationRequired,
        },
    };
};

function useGuildInfo(id: string | null) {
    let { data: guilds, error } = useServersAndHandleTokenRefresh(id !== null);

    let guild;
    if (guilds) {
        guild = guilds.added.find(guild => guild.id === id);
        if (!guild) {
            error = new Error("User doesn't have access to guild.");
        }
    }

    return { data: guild, error }
}

function padTwoZeros(n: number): string {
    return n.toString(10).padStart(2, '0');
}

function Timestamp({ timestamp, separator = " " }: { timestamp: number, separator?: any }) {
    const date = new Date(timestamp);

    const dateString = `${date.getFullYear()}-${padTwoZeros(date.getMonth() + 1)}-${padTwoZeros(date.getDate())}`;
    const timeString = `${padTwoZeros(date.getHours())}:${padTwoZeros(date.getMinutes())}`;

    return <>{dateString}{separator}{timeString}</>;
}

function GraphStatsDisplay({ stats }: { stats: GraphStats | null }) {
    const display = [
        ["Number of Users", stats?.nodeCount],
        ["Oldest Event", stats?.oldestEvent && <Timestamp timestamp={stats.oldestEvent} />],
        ["Latest Event", stats?.newestEvent && <Timestamp timestamp={stats.newestEvent} />],
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

function roundTimestamp(timestamp: number, roundTo: number): number {
    return timestamp - (timestamp % roundTo);
}

// TODO: The state and logic in here is getting quite hairy, it'd be nice to break it up a bit.
export default function Server({ id, guild: guildProp, authenticationRequired }: ServerProps) {
    useEffect(() => {
        if (authenticationRequired) {
            signIn("discord");
        }
    }, [authenticationRequired]);

    const router = useRouter();
    let { timestamp: routeTimestamp, config: routeConfigString } = router.query;

    // We mostly make this request to refresh the user token on a direct link to this page.
    const { data: guildRequest, error: guildError } = useGuildInfo((authenticationRequired || guildProp) ? null : id);
    const guild = guildProp ?? guildRequest;

    let timestamp: number | undefined = undefined;
    if (routeTimestamp !== undefined) {
        if (Array.isArray(routeTimestamp)) {
            routeTimestamp = routeTimestamp[0];
        }

        if (routeTimestamp !== undefined) {
            timestamp = parseInt(routeTimestamp, 10);

            if (isNaN(timestamp)) {
                timestamp = undefined;
            } else {
                timestamp *= 1000;
            }
        }
    }

    const [graphConfig, innerSetGraphConfig] = useState<GraphConfig>(DEFAULT_GRAPH_CONFIG);
    const [graphStats, setGraphStats] = useState<GraphStats | null>(null);

    useEffect(() => {
        if (routeConfigString === undefined) {
            innerSetGraphConfig(DEFAULT_GRAPH_CONFIG);
            return;
        }

        const routeConfig = decodeGraphConfig(routeConfigString as string);
        if (routeConfig !== undefined) {
            innerSetGraphConfig(routeConfig);
        } else {
            innerSetGraphConfig(DEFAULT_GRAPH_CONFIG);
        }
    }, [routeConfigString]);

    const debounceRef = useRef<any>();
    useEffect(() => {
        return () => {
            if (debounceRef.current) {
                clearTimeout(debounceRef.current);
            }
        }
    }, []);

    const pushNextRouteChange = useRef(true);

    const setGraphConfig = useCallback((newConfig: (config: GraphConfig) => GraphConfig) => {
        if (id === undefined) {
            return;
        }

        const config = newConfig(graphConfig);
        innerSetGraphConfig(config);

        if (debounceRef.current) {
            clearTimeout(debounceRef.current);
        }

        debounceRef.current = setTimeout(() => {
            const newTimestamp = timestamp !== undefined ?
                roundTimestamp(timestamp, 1000) / 1000 :
                undefined;

            const query: ParsedUrlQueryInput = { id, timestamp: newTimestamp };

            const encodedConfig = encodeGraphConfig(config);
            if (encodedConfig !== DEFAULT_ENCODED_GRAPH_CONFIG) {
                query.config = encodedConfig;
            }

            const routeChangeFunction = pushNextRouteChange.current ? router.push : router.replace;
            routeChangeFunction({ query }, undefined, { shallow: true });
            pushNextRouteChange.current = false;
        }, 200);
    }, [router, id, timestamp, graphConfig]);

    const [mountTimestamp, setMountTimestamp] = useState(Date.now());
    const renderTimestamp = roundTimestamp(timestamp ?? mountTimestamp, 1000 * 60);

    const adjustTimestamp = useCallback((offset: number) => {
        if (id === undefined) {
            return;
        }

        const offsetTimestamp = renderTimestamp + offset;

        const now = Date.now();
        const newTimestamp = (offsetTimestamp < now) ? offsetTimestamp : undefined;
        if (newTimestamp === undefined) {
            setMountTimestamp(now);
        }

        const newRouteTimestamp = newTimestamp !== undefined ?
            roundTimestamp(newTimestamp, 1000) / 1000 :
            undefined;

        const query: ParsedUrlQueryInput = { id, timestamp: newRouteTimestamp };

        const encodedConfig = encodeGraphConfig(graphConfig);
        if (encodedConfig !== DEFAULT_ENCODED_GRAPH_CONFIG) {
            query.config = encodedConfig;
        }

        const routeChangeFunction = pushNextRouteChange.current ? router.push : router.replace;
        routeChangeFunction({ query }, undefined, { shallow: true });
        pushNextRouteChange.current = false;
    }, [router, id, graphConfig, renderTimestamp]);

    const guildErrorCallout = (guildError && !guild) && <div className="flex-grow flex items-center justify-center p-6">
        <Callout intent="danger">
            Failed to load server information, please try again later.
        </Callout>
    </div>;

    const baseUrl = (typeof window !== "undefined") ? window.location.href : (process.env.NEXTAUTH_URL || "http://localhost:3000");
    const canonicalUrl = id && (new URL(`/server/${id}`, baseUrl)).href;

    return <div className="flex flex-col lg:flex-row flex-grow justify-end">
        <Head>
            {guild && <title>{`${guild.name} - DiscoGraph`}</title>}
            {guild && <meta key="og-title" property="og:title" content={`${guild.name} - DiscoGraph`} />}
            {guild && <meta key="description" name="description" content={`A relationship graph of ${guild.name}, produced by DiscoGraph - A Discord Bot that infers conversations between users and draws pretty graphs.`} />}
            {guild && <meta key="og-description" property="og:description" content={`A relationship graph of ${guild.name}, produced by DiscoGraph - A Discord Bot that infers conversations between users and draws pretty graphs.`} />}
            {canonicalUrl && <link rel="canonical" href={canonicalUrl} />}
            {canonicalUrl && <meta key="og-url" property="og:url" content={canonicalUrl} />}
        </Head>
        <div className="flex-grow border rounded-lg flex z-10 lg:-mb-12 max-lg:min-h-[calc(100vh-9.5rem)]">
            {(guild && !authenticationRequired) ? <GuildGraph key={guild.id} guild={guild.id} timestamp={renderTimestamp} graphConfig={graphConfig} setGraphStats={setGraphStats} /> : guildErrorCallout}
        </div>
        <div className="max-lg:mt-6 lg:w-80 lg:ms-6 lg:max-h-[calc(100vh-18.75rem)]">
            <h2 className="text-center text-2xl">{guild?.name ?? <>&nbsp;</>}</h2>
            <div className="pt-2 pb-3 space-x-1 flex items-center">
                <Button onClick={adjustTimestamp.bind(null, -(1000 * 60 * 60 * 24 * 30))} size="xs" title="-1 month">
                    <ChevronDoubleLeftIcon className="w-5" />
                </Button>
                <Button onClick={adjustTimestamp.bind(null, -(1000 * 60 * 60 * 24))} size="xs" title="-1 day">
                    <ChevronLeftIcon className="w-5" />
                </Button>
                <Button onClick={adjustTimestamp.bind(null, -(1000 * 60 * 60))} size="xs" title="-1 hour">
                    <SmallStepIcon className="w-5 -scale-x-100" />
                </Button>
                <span className="p-1 h-12 flex-1 text-center text-sm" suppressHydrationWarning={true}>
                    <Timestamp timestamp={renderTimestamp} separator={<br />} />
                </span>
                <Button onClick={adjustTimestamp.bind(null, (1000 * 60 * 60))} size="xs" title="+1 hour">
                    <SmallStepIcon className="w-5" />
                </Button>
                <Button onClick={adjustTimestamp.bind(null, (1000 * 60 * 60 * 24))} size="xs" title="+1 day">
                    <ChevronRightIcon className="w-5" />
                </Button>
                <Button onClick={adjustTimestamp.bind(null, (1000 * 60 * 60 * 24 * 30))} size="xs" title="+1 month">
                    <ChevronDoubleRightIcon className="w-5" />
                </Button>
            </div>
            <div className="h-full overflow-y-auto border-y flex flex-col">
                <div className="space-y-3 my-3">
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
                    <div className="space-y-1">
                        <CheckboxInput label="Include Bots" checked={!graphConfig.excludeBots} onChange={ev => {
                            const checked = ev.currentTarget.checked;
                            setGraphConfig(config => ({ ...config, excludeBots: !checked }))
                        }} />
                        <CheckboxInput label="Only Current Members" checked={graphConfig.excludeDeparted} onChange={ev => {
                            const checked = ev.currentTarget.checked;
                            setGraphConfig(config => ({ ...config, excludeDeparted: checked }))
                        }} />
                    </div>
                </div>
                <div className="grow" />
                <div className="flex space-x-2 mb-3.5">
                    <Button className="grow basis-1/2" onClick={async () => {
                        pushNextRouteChange.current = true;
                        setGraphConfig(() => DEFAULT_GRAPH_CONFIG);
                    }} disabled={encodeGraphConfig(graphConfig) === DEFAULT_ENCODED_GRAPH_CONFIG}>Reset Settings</Button>
                    <Button className="grow basis-1/2" onClick={async () => {
                        pushNextRouteChange.current = true;
                        adjustTimestamp(Infinity);
                    }}>Jump to Now</Button>
                </div>
                <GraphStatsDisplay stats={graphStats} />
            </div>
        </div>
    </div>;
}
