'use client';

import { useRef, useEffect, useCallback, useState } from 'react';

interface Entity {
    id: string;
    name: string;
    type: string;
    mentionCount: number;
}

interface Relationship {
    id: string;
    sourceEntityId: string;
    targetEntityId: string;
    type: string;
    strength: number;
}

interface GraphNode {
    id: string;
    name: string;
    type: string;
    mentionCount: number;
    x: number;
    y: number;
    vx: number;
    vy: number;
    radius: number;
}

interface GraphLink {
    source: string;
    target: string;
    type: string;
    strength: number;
}

interface GraphViewProps {
    entities: Entity[];
    relationships: Relationship[];
    onSelectEntity?: (entity: Entity) => void;
}

const TYPE_COLORS: Record<string, string> = {
    person: '#3b82f6',
    company: '#a855f7',
    project: '#22c55e',
    product: '#f97316',
    place: '#eab308',
    concept: '#ec4899',
    event: '#ef4444',
    tool: '#06b6d4',
    default: '#6b7280',
};

export default function GraphView({ entities, relationships, onSelectEntity }: GraphViewProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const nodesRef = useRef<GraphNode[]>([]);
    const linksRef = useRef<GraphLink[]>([]);
    const animFrameRef = useRef<number>(0);
    const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
    const [dragNode, setDragNode] = useState<GraphNode | null>(null);
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const isPanningRef = useRef(false);
    const lastMouseRef = useRef({ x: 0, y: 0 });

    // Initialize nodes and links
    useEffect(() => {
        if (!entities.length) return;

        const nodes: GraphNode[] = entities.map((e, i) => {
            const angle = (2 * Math.PI * i) / entities.length;
            const radius = Math.min(300, entities.length * 20);
            return {
                id: e.id,
                name: e.name,
                type: e.type,
                mentionCount: e.mentionCount,
                x: 400 + radius * Math.cos(angle) + (Math.random() - 0.5) * 50,
                y: 300 + radius * Math.sin(angle) + (Math.random() - 0.5) * 50,
                vx: 0,
                vy: 0,
                radius: Math.max(8, Math.min(25, 5 + (e.mentionCount || 1) * 2)),
            };
        });

        const links: GraphLink[] = relationships.map(r => ({
            source: r.sourceEntityId,
            target: r.targetEntityId,
            type: r.type,
            strength: r.strength || 1,
        }));

        nodesRef.current = nodes;
        linksRef.current = links;
    }, [entities, relationships]);

    // Force simulation
    const simulate = useCallback(() => {
        const nodes = nodesRef.current;
        const links = linksRef.current;
        if (!nodes.length) return;

        // Repulsion between all nodes
        for (let i = 0; i < nodes.length; i++) {
            for (let j = i + 1; j < nodes.length; j++) {
                const dx = nodes[j].x - nodes[i].x;
                const dy = nodes[j].y - nodes[i].y;
                const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                const force = 800 / (dist * dist);
                const fx = (dx / dist) * force;
                const fy = (dy / dist) * force;
                nodes[i].vx -= fx;
                nodes[i].vy -= fy;
                nodes[j].vx += fx;
                nodes[j].vy += fy;
            }
        }

        // Attraction along links
        for (const link of links) {
            const source = nodes.find(n => n.id === link.source);
            const target = nodes.find(n => n.id === link.target);
            if (!source || !target) continue;
            const dx = target.x - source.x;
            const dy = target.y - source.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            const force = (dist - 150) * 0.01;
            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;
            source.vx += fx;
            source.vy += fy;
            target.vx -= fx;
            target.vy -= fy;
        }

        // Center gravity
        for (const node of nodes) {
            node.vx += (400 - node.x) * 0.001;
            node.vy += (300 - node.y) * 0.001;
        }

        // Apply velocities with damping
        for (const node of nodes) {
            if (dragNode && node.id === dragNode.id) continue;
            node.vx *= 0.9;
            node.vy *= 0.9;
            node.x += node.vx;
            node.y += node.vy;
        }
    }, [dragNode]);

    // Draw
    const draw = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const nodes = nodesRef.current;
        const links = linksRef.current;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.save();
        ctx.translate(pan.x + canvas.width / 2, pan.y + canvas.height / 2);
        ctx.scale(zoom, zoom);
        ctx.translate(-canvas.width / 2, -canvas.height / 2);

        // Draw links
        for (const link of links) {
            const source = nodes.find(n => n.id === link.source);
            const target = nodes.find(n => n.id === link.target);
            if (!source || !target) continue;
            ctx.beginPath();
            ctx.moveTo(source.x, source.y);
            ctx.lineTo(target.x, target.y);
            ctx.strokeStyle = 'rgba(107, 114, 128, 0.3)';
            ctx.lineWidth = 1;
            ctx.stroke();
        }

        // Draw nodes
        for (const node of nodes) {
            const color = TYPE_COLORS[node.type] || TYPE_COLORS.default;
            const isHovered = hoveredNode?.id === node.id;

            // Node circle
            ctx.beginPath();
            ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
            ctx.fillStyle = color + (isHovered ? 'ff' : '99');
            ctx.fill();
            if (isHovered) {
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 2;
                ctx.stroke();
            }

            // Label
            ctx.fillStyle = '#e5e7eb';
            ctx.font = isHovered ? 'bold 12px sans-serif' : '10px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(node.name, node.x, node.y + node.radius + 14);
        }

        ctx.restore();
    }, [pan, zoom, hoveredNode]);

    // Animation loop
    useEffect(() => {
        let running = true;
        const tick = () => {
            if (!running) return;
            simulate();
            draw();
            animFrameRef.current = requestAnimationFrame(tick);
        };
        tick();
        return () => {
            running = false;
            cancelAnimationFrame(animFrameRef.current);
        };
    }, [simulate, draw]);

    // Resize canvas
    useEffect(() => {
        const resize = () => {
            const canvas = canvasRef.current;
            const container = containerRef.current;
            if (!canvas || !container) return;
            canvas.width = container.clientWidth;
            canvas.height = container.clientHeight;
        };
        resize();
        window.addEventListener('resize', resize);
        return () => window.removeEventListener('resize', resize);
    }, []);

    // Mouse handlers
    const getMousePos = (e: React.MouseEvent) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        const x = ((e.clientX - rect.left - pan.x - canvas.width / 2) / zoom) + canvas.width / 2;
        const y = ((e.clientY - rect.top - pan.y - canvas.height / 2) / zoom) + canvas.height / 2;
        return { x, y };
    };

    const findNode = (mx: number, my: number) => {
        return nodesRef.current.find(n => {
            const dx = n.x - mx;
            const dy = n.y - my;
            return Math.sqrt(dx * dx + dy * dy) < n.radius + 5;
        });
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        const pos = getMousePos(e);
        const node = findNode(pos.x, pos.y);
        if (node) {
            setDragNode(node);
            setOffset({ x: node.x - pos.x, y: node.y - pos.y });
        } else {
            isPanningRef.current = true;
            lastMouseRef.current = { x: e.clientX, y: e.clientY };
        }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        const pos = getMousePos(e);
        if (dragNode) {
            dragNode.x = pos.x + offset.x;
            dragNode.y = pos.y + offset.y;
            dragNode.vx = 0;
            dragNode.vy = 0;
        } else if (isPanningRef.current) {
            setPan(p => ({
                x: p.x + e.clientX - lastMouseRef.current.x,
                y: p.y + e.clientY - lastMouseRef.current.y,
            }));
            lastMouseRef.current = { x: e.clientX, y: e.clientY };
        } else {
            const node = findNode(pos.x, pos.y);
            setHoveredNode(node || null);
        }
    };

    const handleMouseUp = () => {
        if (dragNode && onSelectEntity) {
            const entity = entities.find(e => e.id === dragNode.id);
            if (entity) onSelectEntity(entity);
        }
        setDragNode(null);
        isPanningRef.current = false;
    };

    const handleWheel = (e: React.WheelEvent) => {
        e.preventDefault();
        setZoom(z => Math.max(0.3, Math.min(3, z - e.deltaY * 0.001)));
    };

    if (!entities.length) {
        return (
            <div className="flex items-center justify-center h-96 text-gray-500">
                <p>No hay entidades para mostrar en el grafo</p>
            </div>
        );
    }

    return (
        <div ref={containerRef} className="relative w-full h-[600px] bg-gray-900/50 rounded-xl border border-gray-700/50 overflow-hidden">
            <canvas
                ref={canvasRef}
                className="w-full h-full cursor-grab active:cursor-grabbing"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onWheel={handleWheel}
            />
            {hoveredNode && (
                <div className="absolute top-4 left-4 bg-gray-800/90 rounded-lg px-3 py-2 text-sm border border-gray-700/50">
                    <span className="font-medium text-white">{hoveredNode.name}</span>
                    <span className="text-gray-400 ml-2">{hoveredNode.type}</span>
                    <span className="text-gray-500 ml-2">({hoveredNode.mentionCount} menciones)</span>
                </div>
            )}
            <div className="absolute bottom-4 right-4 flex gap-2">
                <button onClick={() => setZoom(z => Math.min(3, z + 0.2))} className="bg-gray-800/90 text-white w-8 h-8 rounded-lg border border-gray-700/50 text-lg">+</button>
                <button onClick={() => setZoom(z => Math.max(0.3, z - 0.2))} className="bg-gray-800/90 text-white w-8 h-8 rounded-lg border border-gray-700/50 text-lg">-</button>
                <button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} className="bg-gray-800/90 text-white px-3 h-8 rounded-lg border border-gray-700/50 text-xs">Reset</button>
            </div>
        </div>
    );
}
