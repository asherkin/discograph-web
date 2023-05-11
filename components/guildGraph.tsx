import { MutableRefObject, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import ForceGraph3D, {
    ForceGraphMethods,
    ForceGraphProps,
    GraphData,
    LinkObject,
    NodeObject,
} from "react-force-graph-3d";
import useSWRInfinite, { SWRInfiniteKeyLoader } from "swr/infinite";
import { Color, Mesh, Object3D, ShaderMaterial, SphereGeometry, Texture, TextureLoader } from "three";

import { Callout } from "@/components/core";
import { DEFAULT_GRAPH_CONFIG, GraphConfig } from "@/lib/guildGraphConfig";
import { ClientGuildMember, ServerResponse } from "@/pages/api/server/[id]";

interface GuildGraphProps {
    guild: string,
    graphConfig?: GraphConfig,
}

interface Node {
    id: string,
    weight: number,
    siblings: Set<string>,
    image_url: string | undefined,
    label: string | undefined,
}

interface Link {
    weight: number,
}

function useGuildEvents(id: string) {
    const getKey: SWRInfiniteKeyLoader<ServerResponse> = useCallback((pageIndex, previousPageData) => {
        if (previousPageData && previousPageData.events.length < previousPageData.limit) {
            return null;
        }

        const params = new URLSearchParams({
            limit: "1000",
        });

        const before = previousPageData?.events.at(-1)?.timestamp;
        if (before !== undefined) {
            params.set("before", before);
        }

        return `/api/server/${id}?${params.toString()}`;
    }, [id]);

    return useSWRInfinite<ServerResponse>(getKey, {
        // If this is true, we revalidate the first page every time we load a page,
        // which doesn't make sense with cursor-based paging.
        revalidateFirstPage: false,
        revalidateOnFocus: false,
        revalidateOnReconnect: false,
        // TODO: This isn't working without revalidateFirstPage, investigate.
        revalidateOnMount: true,
        // Use refreshInterval for periodic updates once we're stable.
    });
}

function subscribeDarkMode(callback: () => void) {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener("change", callback);
    return () => {
        mediaQuery.removeEventListener("change", callback);
    };
}

function getNodeThreeObject(cache: Map<string, Mesh<SphereGeometry, ShaderMaterial>>, selectedNode: string | null, node: Node): Object3D {
    const key = `${node.id}-${node.image_url}`;

    let object = cache.get(key);
    if (!object) {
        object = createNodeThreeObject(node);
        cache.set(key, object);
    }

    const transparent = selectedNode !== null && selectedNode !== node.id && !node.siblings.has(selectedNode);

    const material = object.material;
    material.transparent = transparent;
    material.needsUpdate = true;
    material.uniforms.scale.value = Math.sqrt(node.weight);
    material.uniforms.opacity.value = transparent ? 0.2 : 1.0;
    material.uniformsNeedUpdate = true;

    // This doesn't affect the visual rendering as we zero it out in the shader (to remove the rotation) and
    // use the uniform instead, but it has to be set otherwise mouse interaction uses the wrong node size.
    object.scale.setScalar(material.uniforms.scale.value);

    return object;
}

const OBJECT_MATERIAL = new ShaderMaterial({
    transparent: true,
    uniforms: {
        scale: { value: 1.0 },
        tex: { value: new Texture() },
        opacity: { value: 1.0 },
        background: { value: new Color(1.0, 1.0, 1.0) },
        borderWidth: { value: 2.0 },
        borderColor: { value: new Color(1.0, 0.0, 0.0) },
    },
    vertexShader: /* glsl */`
        #include <common>
        
        uniform float scale;

        varying vec3 vNormal;
        varying vec3 vPosition;
        
        #include <logdepthbuf_pars_vertex>

        void main() {
            vNormal = normal;
            vPosition = (modelViewMatrix * vec4(position.xyz * scale, 1.0)).xyz;
            gl_Position = projectionMatrix * (modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0) + vec4(position.xy * scale, (position.z * scale) / 4.0, 1.0));
            
            #include <logdepthbuf_vertex>
        }
    `,
    fragmentShader: /* glsl */`
        #include <common>

        #include <logdepthbuf_pars_fragment>
        
        uniform sampler2D tex;
        uniform float opacity;
        uniform vec3 background;
        uniform float borderWidth;
        uniform vec3 borderColor;

        varying vec3 vNormal;
        varying vec3 vPosition;
        
        void main() {
            #include <logdepthbuf_fragment>
        
            vec3 norm = normalize(vNormal);
            // gl_FragColor = vec4(norm.z, 0.0, 0.0, 1.0);
            
            vec2 uv = (norm.xy * 0.5) + 0.5;
            vec4 color = texture2D(tex, uv);
            // gl_FragColor = color;
            
            // vec3 cameraViewPos = mat3(transpose(inverse(viewMatrix))) * cameraPosition;
            // vec3 lightPos = cameraViewPos + vec3(200.0, 200.0, 200.0);
            // vec3 lightDir = normalize(lightPos - vPosition);
            vec3 lightDir = normalize(vec3(0.5, 0.5, 1.0));
            // gl_FragColor = vec4(lightDir, 1.0);
            
            float diffuse = max(dot(norm, lightDir), 0.0);
            vec3 light = vec3(0.4, 0.4, 0.4) + (diffuse * vec3(0.6, 0.6, 0.6));
            // gl_FragColor = vec4(light, 1.0);
            
            // float border = (norm.z < 0.4) ? 1.0 : 0.0;
            // gl_FragColor = vec4(border, 0.0, 0.0, 1.0);
            
            vec3 colorMul = color.rgb * color.a;
            vec3 backgroundMul = background * (1.0 - color.a);
            // vec3 notBorderMul = light * (backgroundMul + colorMul) * (1.0 - border);
            // vec3 borderMul = borderColor * border;
            gl_FragColor = vec4(light * (backgroundMul + colorMul), opacity);
        }
    `,
});

const OBJECT_GEOMETRY = new SphereGeometry(1, 12, 12);

function createNodeThreeObject({ image_url }: Node) {
    // Cache.enabled = true;

    const url = image_url ?? "https://cdn.discordapp.com/embed/avatars/1.png";
    const texture = new TextureLoader().load(url);
    texture.colorSpace = "srgb-linear";

    const material = OBJECT_MATERIAL.clone();
    material.uniforms.tex.value = texture;

    return new Mesh(OBJECT_GEOMETRY, material);
}

interface ComputedGraphData extends GraphData<Node, Link> {
    stats: {
        nodeCount: number,
        oldestEvent: number | undefined,
        newestEvent: number | undefined,
        eventsLoaded: number,
        eventsProcessed: number,
        eventsIncluded: number,
    },
}

// TODO: This needs a rewrite and tidy up now that we know what we're doing with it.
function computeGraphData(config: GraphConfig, events: ServerResponse[], setSize: (size: number) => void): ComputedGraphData {
    const WEIGHT_KEYS = [
        undefined,
        "reaction",
        "message-direct-mention",
        "message-indirect-mention",
        "message-adjacency",
        "message-binary-sequence",
    ] as const;

    const decayAmount = config.decayAmount ?? DEFAULT_GRAPH_CONFIG.decayAmount;
    const decayThreshold = config.decayThreshold ?? DEFAULT_GRAPH_CONFIG.decayThreshold;
    const linkThreshold = config.linkThreshold ?? DEFAULT_GRAPH_CONFIG.linkThreshold;
    const nodeThreshold = config.nodeThreshold ?? DEFAULT_GRAPH_CONFIG.nodeThreshold;

    const userInfo = new Map<string, ClientGuildMember>();

    const nodes = new Map<string, number>();
    const links = new Map<string, number>();

    let decay = 1.0;
    let oldestEvent: number | undefined = undefined;
    let newestEvent: number | undefined = undefined;
    let eventsLoaded = events.reduce((total, chunk) => total + chunk.events.length, 0);
    let eventsProcessed = 0;
    let eventsIncluded = 0;

    for (const chunk of events) {
        for (const user of chunk.users) {
            userInfo.set(user.id, user);
        }

        for (const event of chunk.events) {
            eventsProcessed += 1;

            oldestEvent = parseInt(event.timestamp, 10);

            if (newestEvent === undefined) {
                newestEvent = oldestEvent;
            }

            const eventType = WEIGHT_KEYS[event.reason];
            if (eventType === undefined) {
                continue;
            }

            const eventWeight = (config.weights && config.weights[eventType]) ?? DEFAULT_GRAPH_CONFIG.weights[eventType] ?? 0;
            if (eventWeight <= 0) {
                continue;
            }

            const weight = eventWeight * decay;

            if (config.excludeBots && (userInfo.get(event.source)?.bot || userInfo.get(event.target)?.bot)) {
                continue;
            }

            nodes.set(event.source, (nodes.get(event.source) ?? 0) + weight);
            nodes.set(event.target, (nodes.get(event.target) ?? 0) + weight);

            const key = [event.source, event.target].sort().join(':');
            links.set(key, (links.get(key) ?? 0) + weight);

            decay -= weight * decayAmount;

            eventsIncluded += 1;

            if (decay <= decayThreshold) {
                break;
            }
        }

        if (decay <= decayThreshold) {
            break;
        }
    }

    console.log(decay, events.length);

    // If we've still got room in decay, request another page of events.
    // TODO: Avoid reprocessing the events we've already looked at.
    // TODO: Ensure users can't set the graph settings to be pathological here.
    if (decay > decayThreshold) {
        const lastPage = events.at(-1);
        const lastPageFull = lastPage && lastPage.events.length === lastPage.limit;

        if (lastPageFull) {
            setSize(events.length + 1);
        }
    }

    const siblings = new Map<string, Set<string>>();

    const linksArray = Array.from(links.entries()).map(([key, weight]) => {
        const [source, target] = key.split(':');
        return { source, target, weight };
    }).filter(({ source, target, weight }) => {
        return weight >= linkThreshold && Math.min(nodes.get(source) ?? 0, nodes.get(target) ?? 0) >= nodeThreshold;
    }).map(link => {
        const { source, target } = link;
        siblings.set(source, (siblings.get(source) ?? new Set()).add(target));
        siblings.set(target, (siblings.get(target) ?? new Set()).add(source));

        return link;
    });

    const nodesArray = Array.from(nodes.entries())
        .map(([id, weight]) => ({
            id,
            weight,
            siblings: siblings.get(id) ?? new Set(),
            image_url: userInfo.get(id)?.avatar,
            label: userInfo.get(id)?.nickname ?? id,
        }))
        .filter(({ weight, siblings }) => weight >= nodeThreshold && siblings.size > 0);

    // console.log(nodesArray, linksArray);

    return {
        nodes: nodesArray,
        links: linksArray,
        stats: {
            nodeCount: nodesArray.length,
            oldestEvent,
            newestEvent,
            eventsLoaded,
            eventsProcessed,
            eventsIncluded,
        }
    };
}

// This is a wrapper around ForceGraph3D that sets up the node and link types and does our first-time configuration.
// If we try and do this directly in GuildGraph the ref assignment gets confused around the error handling,
function MyForceGraph3D({ graphRef, ...props }: ForceGraphProps<Node, Link> & { graphRef?: MutableRefObject<ForceGraphMethods<Node, Link> | undefined>; }) {
    const innerGraphRef = useRef<ForceGraphMethods<Node, Link>>();
    useEffect(() => {
        const graph = innerGraphRef.current;

        if (graphRef) {
            graphRef.current = graph;
        }

        if (!graph) {
            return;
        }

        graph.d3Force("charge")
            ?.distanceMax(150);

        let centerForceNodes: NodeObject[];

        const centerForce = function (alpha: number) {
            const k = alpha * 0.02;
            const n = centerForceNodes.length;
            for (let i = 0; i < n; ++i) {
                const node = centerForceNodes[i];
                node.vx! -= node.x! * k;
                node.vy! -= node.y! * k;
                node.vz! -= node.z! * k;
            }
        };

        centerForce.initialize = function (nodes: NodeObject[]) {
            centerForceNodes = nodes;
        };

        graph.d3Force("center", centerForce);

        graph.d3Force("link")
            ?.distance((link: LinkObject<Node, Link>) => {
                let minimumDistance = 0;
                if (typeof link.source === "object" && typeof link.target === "object") {
                    minimumDistance = 1.2 * (Math.sqrt(link.source.weight) + Math.sqrt(link.target.weight));
                }

                return Math.max(minimumDistance, 30 * Math.min(1 / Math.sqrt(link.weight), 1));
            });

        let timeout: any = setTimeout(() => {
            graph.zoomToFit(1000, 0);
            timeout = undefined;
        }, 1000);

        return () => {
            if (timeout) {
                clearTimeout(timeout);
            }
        }
    }, [graphRef]);

    return <ForceGraph3D ref={innerGraphRef} {...props} />;
}

export default function GuildGraph({ guild, graphConfig }: GuildGraphProps) {
    const { data: events, error: eventsError, setSize } = useGuildEvents(guild);
    // console.log(id, events, eventsError);

    const [ graphData, setGraphData ] = useState<ComputedGraphData | undefined>(undefined);
    useEffect(() => {
        if (events) {
            setGraphData(computeGraphData(graphConfig ?? {}, events, setSize));
        }
    }, [graphConfig, events, setSize]);

    // TODO: Pass this to the parent component for display.
    console.log(graphData?.stats);

    const graphRef = useRef<ForceGraphMethods<Node, Link> | undefined>();

    const [selectedNode, setSelectedNode] = useState<string | null>(null);

    const handleNodeClick = useCallback((node: NodeObject<Node>) => {
        setSelectedNode(node.id);

        if (node.x === undefined || node.y === undefined || node.z === undefined) {
            return;
        }

        // Aim at node from outside it
        const distance = Math.max(40, 60 * Math.sqrt(node.siblings.size));
        const distRatio = 1 + distance / Math.hypot(node.x, node.y, node.z);

        graphRef.current?.cameraPosition(
            { x: node.x * distRatio, y: node.y * distRatio, z: node.z * distRatio },
            { x: node.x, y: node.y, z: node.z },
            3000,
        );
    }, []);

    const handleBackgroundClick = useCallback(() => {
        setSelectedNode(null);

        graphRef.current?.zoomToFit(2000, 0);
    }, []);

    const containerObserver = useRef<ResizeObserver | null>(null);
    const [[containerWidth, containerHeight], setContainerSize] = useState<[number, number]>([0, 0]);
    const containerRef = useCallback((container: HTMLElement | null) => {
        if (containerObserver.current) {
            containerObserver.current.disconnect();
            containerObserver.current = null;
        }

        if (!container) {
            return;
        }

        const rect = container.getBoundingClientRect();
        setContainerSize([rect.width, rect.height]);

        containerObserver.current = new ResizeObserver(entries => {
            for (const entry of entries) {
                if (entry.target === container) {
                    const rect = entry.contentRect;
                    setContainerSize([rect.width, rect.height]);
                }
            }
        });

        containerObserver.current.observe(container);
    }, []);

    const isDarkMode = useSyncExternalStore(
        subscribeDarkMode,
        () => window.matchMedia('(prefers-color-scheme: dark)').matches);

    const linkColor = useCallback((link: LinkObject<Node, Link>) => {
        if (typeof link.source === "object" && typeof link.target === "object") {
            if (link.source.id === selectedNode || link.target.id === selectedNode) {
                return isDarkMode ? "#FFFFFF" : "rgb(79 70 229)";
            }
        }

        if (selectedNode !== null) {
            return isDarkMode ? "#FFFFFF33" : "#66666633";
        }

        return isDarkMode ? "#FFFFFF" : "#666666";
    }, [selectedNode, isDarkMode]);

    const threeObjectCache = useRef(new Map<string, Mesh<SphereGeometry, ShaderMaterial>>());
    const nodeThreeObject = useMemo(() => getNodeThreeObject.bind(null, threeObjectCache.current, selectedNode), [selectedNode]);

    if (eventsError) {
        return <div className="flex-grow flex items-center justify-center p-6">
            <Callout intent="danger">
                Failed to load graph information, please try again later.
            </Callout>
        </div>;
    }

    if (!graphData) {
        return <div className="flex-grow flex items-center justify-center p-6">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-20 w-20 flex-1 animate-spin stroke-current stroke-1" fill="none" viewBox="0 0 24 24">
                <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" className="stroke-current opacity-25" />
                <path d="M12 2C6.47715 2 2 6.47715 2 12C2 14.7255 3.09032 17.1962 4.85857 19" />
            </svg>
        </div>;
    }

    if (graphData.nodes.length === 0) {
        return <div className="flex-grow flex items-center justify-center p-6">
            <Callout intent="warning">
                Not enough data to display a graph, adjust settings or wait for more data.
            </Callout>
        </div>;
    }

    return <div className="flex-grow relative" ref={containerRef}>
        <div className="absolute inset-0">
            <MyForceGraph3D
                graphRef={graphRef}
                width={containerWidth}
                height={containerHeight}
                showNavInfo={false}
                rendererConfig={{ antialias: true, alpha: true, logarithmicDepthBuffer: true }}
                graphData={graphData}
                nodeLabel={node => `<span class="p-1 rounded bg-opacity-60 bg-indigo-50 text-indigo-950 dark:bg-slate-900 dark:text-slate-100">${node.label}</span>`}
                linkWidth={link => Math.sqrt(link.weight)}
                backgroundColor="#00000000"
                linkColor={linkColor}
                enableNodeDrag={false}
                onNodeClick={handleNodeClick}
                onBackgroundClick={handleBackgroundClick}
                nodeThreeObject={nodeThreeObject}
                warmupTicks={20}
                nodeResolution={12}
            />
        </div>
        <div className="absolute pointer-events-none bottom-1 inset-x-0 text-center text-xs opacity-40">
            Left-click: rotate, Mouse-wheel/middle-click: zoom, Right-click: pan
        </div>
    </div>;
}