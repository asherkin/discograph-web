// These have to be defined outside guildGraph.tsx, as that file is client only.

export interface GraphConfig {
    excludeBots?: boolean,
    excludeDeparted?: boolean,
    decayAmount?: number,
    decayThreshold?: number,
    linkThreshold?: number,
    nodeThreshold?: number,
    weights?: { [key: string]: number | undefined },
}

export const DEFAULT_GRAPH_CONFIG: Required<GraphConfig> = {
    excludeBots: true,
    excludeDeparted: false,
    decayAmount: 0.001,
    decayThreshold: 0.6,
    linkThreshold: 2.0,
    nodeThreshold: 4.0,
    weights: {
        "reaction": 0.1,
        "message-direct-mention": 2.0,
        "message-indirect-mention": 1.0,
        "message-adjacency": 0.5,
        "message-binary-sequence": 0.5,
    },
};

export interface GraphStats {
    nodeCount: number,
    oldestEvent: number | undefined,
    newestEvent: number | undefined,
    eventsLoaded: number,
    eventsProcessed: number,
    eventsIncluded: number,
}