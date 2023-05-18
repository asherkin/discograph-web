// These have to be defined outside guildGraph.tsx, as that file is client only.

import { Buffer } from "buffer";

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

const ENCODE_VERSION = 0;

export const DEFAULT_ENCODED_GRAPH_CONFIG = encodeGraphConfig(DEFAULT_GRAPH_CONFIG);

export function encodeGraphConfig(config: GraphConfig): string {
    const buffer = new ArrayBuffer(1 + 1 + (4 * 4));
    const dataView = new DataView(buffer);

    dataView.setUint8(0, ENCODE_VERSION);
    const excludeBotsFlag = ((config.excludeBots ?? DEFAULT_GRAPH_CONFIG.excludeBots) ? 1 : 0) << 0;
    const excludeDepartedFlag = ((config.excludeDeparted ?? DEFAULT_GRAPH_CONFIG.excludeDeparted) ? 1 : 0) << 1;
    dataView.setUint8(1, excludeBotsFlag | excludeDepartedFlag);
    dataView.setFloat32(2, config.decayAmount ?? DEFAULT_GRAPH_CONFIG.decayAmount);
    dataView.setFloat32(6, config.decayThreshold ?? DEFAULT_GRAPH_CONFIG.decayThreshold);
    dataView.setFloat32(10, config.linkThreshold ?? DEFAULT_GRAPH_CONFIG.linkThreshold);
    dataView.setFloat32(14, config.nodeThreshold ?? DEFAULT_GRAPH_CONFIG.nodeThreshold);

    if (typeof window !== 'undefined') {
        let encoded = "";
        const view = new Uint8Array(buffer);
        for (const byte of view) {
            encoded += String.fromCharCode(byte);
        }

        return window.btoa(encoded)
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');
    } else {
        return Buffer.from(buffer).toString("base64url");
    }
}

export function decodeGraphConfig(encoded: string): GraphConfig | undefined {
    const buffer = new ArrayBuffer(1 + 1 + (4 * 4));
    const dataView = new DataView(buffer);

    if (typeof window !== 'undefined') {
        let base64 = encoded
            .replace(/-/g, '+')
            .replace(/_/g, '/');

        base64 = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');

        const byteString = window.atob(base64);

        const byteLength = byteString.length;
        if (byteLength !== buffer.byteLength) {
            return undefined;
        }

        for (let i = 0; i <byteLength; ++i) {
            dataView.setUint8(i, byteString.charCodeAt(i));
        }
    } else {
        const nodeBuffer = Buffer.from(encoded, "base64url");
        if (nodeBuffer.length !== buffer.byteLength) {
            return undefined;
        }

        const view = new Uint8Array(buffer);
        nodeBuffer.copy(view);
    }

    if (dataView.getUint8(0) !== ENCODE_VERSION) {
        return undefined;
    }

    const config: GraphConfig = {};
    const flags = dataView.getUint8(1);
    config.excludeBots = (flags & (1 << 0)) !== 0;
    config.excludeDeparted = (flags & (1 << 1)) !== 0;
    config.decayAmount = dataView.getFloat32(2);
    config.decayThreshold = dataView.getFloat32(6);
    config.linkThreshold = dataView.getFloat32(10);
    config.nodeThreshold = dataView.getFloat32(14);

    return config;
}

export interface GraphStats {
    nodeCount: number,
    oldestEvent: number | undefined,
    newestEvent: number | undefined,
    eventsLoaded: number,
    eventsProcessed: number,
    eventsIncluded: number,
}