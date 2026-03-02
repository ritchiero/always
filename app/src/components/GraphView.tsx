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

const TYPE_NODE_COLORS: Record<string, string> = {
    person: '#3b82f6',
    company: '#a855f7',
    project: '#22c55e',
    product: '#f97316',
    topic: '#06b6d4',
    decision: '#ec4899',
    place: '#eab308',
    concept: '#8b5cf6',
    event: '#ef4444',
    tool: '#64748b',
  default: '#94a3b8',
};

interface GraphViewProps {
    entities: Entity[];
    relationships: Relationship[];
    onSelectEntity?: (entity: Entity) => void;
}

export default function GraphView({ entities, relationships, onSelectEntity }: GraphViewProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const nodesRef = useRef<GraphNode[]>([]);
    const linksRef = useRef<GraphLink[]>([]);
    const animationRef = useRef<number>(0);
    const dragNodeRef = useRef<GraphNode | null>(null);
    const hoveredNodeRef = useRef<GraphNode | null>(null);
    const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
    const offsetRef = useRef({ x: 0, y: 0 });
    const scaleRef = useRef(1);
    const isPanningRef = useRef(false);
    const lastMouseRef = useRef({ x: 0, y: 0 });

  // Initialize nodes and links
  useEffect(() => {
        if (entities.length === 0) return;

                const centerX = dimensions.width / 2;
        const centerY = dimensions.height / 2;

                // Create nodes with random positions around center
                const nodes: GraphNode[] = entities.map((entity, i) => {
                        const angle = (i / entities.length) * Math.PI * 2;
                        const dist = 100 + Math.random() * 150;
                        const maxMentions = Math.max(...entities.map(e => e.mentionCount || 1));
                        const normalizedSize = (entity.mentionCount || 1) / maxMentions;
                        return {
                                  id: entity.id,
                                  name: entity.name,
                                  type: entity.type,
                                  mentionCount: entity.mentionCount || 1,
                                  x: centerX + Math.cos(angle) * dist,
                                  y: centerY + Math.sin(angle) * dist,
                                  vx: 0,
                                  vy: 0,
                                  radius: 8 + normalizedSize * 20,
                        };
                });

                // Create links from relationships
                const links: GraphLink[] = relationships
          .filter(r => {
                    const hasSource = nodes.some(n => n.id === r.sourceEntityId);
                    const hasTarget = nodes.some(n => n.id === r.targetEntityId);
                    return hasSource && hasTarget;
          })
          .map(r => ({
                    source: r.sourceEntityId,
                    target: r.targetEntityId,
                    type: r.type,
                    strength: r.strength || 1,
          }));

                // If no relationships exist, create implicit connections based on co-occurrence
                if (links.length === 0 && nodes.length > 1) {
                        // Connect entities that share the same type with some probability
          for (let i = 0; i < nodes.length; i++) {
                    for (let j = i + 1; j < nodes.length; j++) {
                                if (nodes[i].type === nodes[j].type) {
                                              links.push({
                                                              source: nodes[i].id,
                                                              target: nodes[j].id,
                                                              type: 'same_type',
                                                              strength: 0.3,
                                              });
                                }
                    }
          }
                        // Also connect high-mention entities to others
          const sorted = [...nodes].sort((a, b) => b.mentionCount - a.mentionCount);
                        const topNodes = sorted.slice(0, Math.min(3, sorted.length));
                        for (const top of topNodes) {
                                  for (const node of nodes) {
                                              if (top.id !== node.id && !links.some(l =>
                                                            (l.source === top.id && l.target === node.id) ||
                                                            (l.source === node.id && l.target === top.id)
                                                                                              )) {
                                                            links.push({
                                                                            source: top.id,
                                                                            target: node.id,
                                                                            type: 'related',
                                                                            strength: 0.15,
                                                            });
                                              }
                                  }
                        }
                }

                nodesRef.current = nodes;
        linksRef.current = links;
  }, [entities, relationships, dimensions]);

  // Resize observer
  useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

                const observer = new ResizeObserver(entries => {
                        for (const entry of entries) {
                                  setDimensions({
                                              width: entry.contentRect.width,
                                              height: entry.contentRect.height,
                                  });
                        }
                });

                observer.observe(container);
        setDimensions({
                width: container.clientWidth,
                height: container.clientHeight,
        });

                return () => observer.disconnect();
  }, []);

  // Force simulation + render loop
  useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

                const dpr = window.devicePixelRatio || 1;
        canvas.width = dimensions.width * dpr;
        canvas.height = dimensions.height * dpr;
        ctx.scale(dpr, dpr);

                let alpha = 1; // simulation temperature

                function simulate() {
                        const nodes = nodesRef.current;
                        const links = linksRef.current;
                        if (nodes.length === 0) return;

          alpha *= 0.995;
                        if (alpha < 0.001) alpha = 0.001;

          const centerX = dimensions.width / 2;
                        const centerY = dimensions.height / 2;

          // Center gravity
          for (const node of nodes) {
                    node.vx += (centerX - node.x) * 0.001 * alpha;
                    node.vy += (centerY - node.y) * 0.001 * alpha;
          }

          // Repulsion between all nodes
          for (let i = 0; i < nodes.length; i++) {
                    for (let j = i + 1; j < nodes.length; j++) {
                                const dx = nodes[j].x - nodes[i].x;
                                const dy = nodes[j].y - nodes[i].y;
                                const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                                const force = (150 * alpha) / (dist * dist);
                                const fx = dx / dist * force;
                                const fy = dy / dist * force;
                                nodes[i].vx -= fx;
                                nodes[i].vy -= fy;
                                nodes[j].vx += fx;
                                nodes[j].vy += fy;
                    }
          }

          // Link attraction
          for (const link of links) {
                    const source = nodes.find(n => n.id === link.source);
                    const target = nodes.find(n => n.id === link.target);
                    if (!source || !target) continue;

                          const dx = target.x - source.x;
                    const dy = target.y - source.y;
                    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                    const idealDist = 120;
                    const force = (dist - idealDist) * 0.005 * alpha * (link.strength || 1);
                    const fx = dx / dist * force;
                    const fy = dy / dist * force;
                    source.vx += fx;
                    source.vy += fy;
                    target.vx -= fx;
                    target.vy -= fy;
          }

          // Apply velocity with damping
          for (const node of nodes) {
                    if (dragNodeRef.current && node.id === dragNodeRef.current.id) continue;
                    node.vx *= 0.6;
                    node.vy *= 0.6;
                    node.x += node.vx;
                    node.y += node.vy;
          }
                }

                function render() {
                        if (!ctx) return;
                        const nodes = nodesRef.current;
                        const links = linksRef.current;

          ctx.clearRect(0, 0, dimensions.width, dimensions.height);
                        ctx.save();
                        ctx.translate(offsetRef.current.x, offsetRef.current.y);
                        ctx.scale(scaleRef.current, scaleRef.current);

          // Draw links
          for (const link of links) {
                    const source = nodes.find(n => n.id === link.source);
                    const target = nodes.find(n => n.id === link.target);
                    if (!source || !target) continue;

                          ctx.beginPath();
                    ctx.moveTo(source.x, source.y);
                    ctx.lineTo(target.x, target.y);
                    ctx.strokeStyle = `rgba(148, 163, 184, ${0.1 + (link.strength || 0.3) * 0.3})`;
                    ctx.lineWidth = 0.5 + (link.strength || 0.3);
                    ctx.stroke();
          }

          // Draw nodes
          for (const node of nodes) {
                    const color = TYPE_NODE_COLORS[node.type] || TYPE_NODE_COLORS.default;
                    const isHovered = hoveredNodeRef.current?.id === node.id;
                    const isDragged = dragNodeRef.current?.id === node.id;

                          // Glow effect for hovered/dragged
                          if (isHovered || isDragged) {
                                      ctx.beginPath();
                                      ctx.arc(node.x, node.y, node.radius + 4, 0, Math.PI * 2);
                                      ctx.fillStyle = color + '40';
                                      ctx.fill();
                          }

                          // Node circle
                          ctx.beginPath();
                    ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
                    ctx.fillStyle = color + (isHovered ? 'ff' : 'cc');
                    ctx.fill();
                    ctx.strokeStyle = color;
                    ctx.lineWidth = 1.5;
                    ctx.stroke();

                          // Node label
                          const fontSize = Math.max(10, Math.min(14, node.radius));
                    ctx.font = `${isHovered ? 'bold ' : ''}${fontSize}px -apple-system, BlinkMacSystemFont, sans-serif`;
                    ctx.fillStyle = '#e2e8f0';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'top';
                    ctx.fillText(node.name, node.x, node.y + node.radius + 4);
          }

          ctx.restore();
                }

                function tick() {
                        simulate();
                        render();
                        animationRef.current = requestAnimationFrame(tick);
                }

                tick();

                return () => {
                        cancelAnimationFrame(animationRef.current);
                };
  }, [dimensions]);

  // Screen to world coordinates
  const screenToWorld = useCallback((sx: number, sy: number) => {
        return {
                x: (sx - offsetRef.current.x) / scaleRef.current,
                y: (sy - offsetRef.current.y) / scaleRef.current,
        };
  }, []);

  // Find node at position
  const findNodeAt = useCallback((wx: number, wy: number): GraphNode | null => {
        const nodes = nodesRef.current;
        for (let i = nodes.length - 1; i >= 0; i--) {
                const n = nodes[i];
                const dx = wx - n.x;
                const dy = wy - n.y;
                if (dx * dx + dy * dy < (n.radius + 4) * (n.radius + 4)) {
                          return n;
                }
        }
        return null;
  }, []);

  // Mouse handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;

                                          const sx = e.clientX - rect.left;
        const sy = e.clientY - rect.top;
        const { x: wx, y: wy } = screenToWorld(sx, sy);
        const node = findNodeAt(wx, wy);

                                          if (node) {
                                                  dragNodeRef.current = node;
                                          } else {
                                                  isPanningRef.current = true;
                                          }
        lastMouseRef.current = { x: e.clientX, y: e.clientY };
  }, [screenToWorld, findNodeAt]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;

                                          const sx = e.clientX - rect.left;
        const sy = e.clientY - rect.top;
        const { x: wx, y: wy } = screenToWorld(sx, sy);

                                          if (dragNodeRef.current) {
                                                  dragNodeRef.current.x = wx;
                                                  dragNodeRef.current.y = wy;
                                                  dragNodeRef.current.vx = 0;
                                                  dragNodeRef.current.vy = 0;
                                          } else if (isPanningRef.current) {
                                                  const dx = e.clientX - lastMouseRef.current.x;
                                                  const dy = e.clientY - lastMouseRef.current.y;
                                                  offsetRef.current.x += dx;
                                                  offsetRef.current.y += dy;
                                                  lastMouseRef.current = { x: e.clientX, y: e.clientY };
                                          } else {
                                                  const node = findNodeAt(wx, wy);
                                                  hoveredNodeRef.current = node;
                                                  if (canvasRef.current) {
                                                            canvasRef.current.style.cursor = node ? 'pointer' : 'grab';
                                                  }
                                          }
  }, [screenToWorld, findNodeAt]);

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
        if (dragNodeRef.current && onSelectEntity) {
                const rect = canvasRef.current?.getBoundingClientRect();
                if (rect) {
                          const sx = e.clientX - rect.left;
                          const sy = e.clientY - rect.top;
                          const { x: wx, y: wy } = screenToWorld(sx, sy);
                          const node = findNodeAt(wx, wy);
                          if (node && node.id === dragNodeRef.current.id) {
                                      const entity = entities.find(en => en.id === node.id);
                                      if (entity) onSelectEntity(entity);
                          }
                }
        }
        dragNodeRef.current = null;
        isPanningRef.current = false;
  }, [entities, onSelectEntity, screenToWorld, findNodeAt]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
        e.preventDefault();
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;

                                      const sx = e.clientX - rect.left;
        const sy = e.clientY - rect.top;

                                      const zoomFactor = e.deltaY > 0 ? 0.95 : 1.05;
        const newScale = Math.max(0.2, Math.min(5, scaleRef.current * zoomFactor));

                                      // Zoom toward mouse position
                                      offsetRef.current.x = sx - (sx - offsetRef.current.x) * (newScale / scaleRef.current);
        offsetRef.current.y = sy - (sy - offsetRef.current.y) * (newScale / scaleRef.current);
        scaleRef.current = newScale;
  }, []);

  if (entities.length === 0) {
        return (
                <div className="flex items-center justify-center h-96 text-gray-500">
                        <p>No hay entidades para mostrar en el grafo</p>p>
                </div>div>
              );
  }
  
    return (
          <div ref={containerRef} className="w-full h-[500px] md:h-[600px] rounded-lg border border-gray-700/50 bg-gray-800/30 overflow-hidden relative">
                <canvas
                          ref={canvasRef}
                          width={dimensions.width}
                          height={dimensions.height}
                          style={{ width: dimensions.width, height: dimensions.height, cursor: 'grab' }}
                          onMouseDown={handleMouseDown}
                          onMouseMove={handleMouseMove}
                          onMouseUp={handleMouseUp}
                          onMouseLeave={() => { dragNodeRef.current = null; isPanningRef.current = false; hoveredNodeRef.current = null; }}
                          onWheel={handleWheel}
                        />
            {/* Legend */}
                <div className="absolute bottom-3 left-3 bg-gray-900/80 backdrop-blur rounded-lg p-2 text-xs">
                        <div className="flex flex-wrap gap-2">
                          {Object.entries(TYPE_NODE_COLORS).filter(([k]) => k !== 'default').map(([type, color]) => (
                        <div key={type} className="flex items-center gap-1">
                                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                                      <span className="text-gray-400 capitalize">{type}</span>span>
                        </div>div>
                      ))}
                        </div>div>
                </div>div>
            {/* Zoom controls */}
                <div className="absolute top-3 right-3 flex flex-col gap-1">
                        <button
                                    onClick={() => { scaleRef.current = Math.min(5, scaleRef.current * 1.2); }}
                                    className="w-8 h-8 bg-gray-900/80 backdrop-blur rounded text-gray-300 hover:text-white hover:bg-gray-700/80 flex items-center justify-center text-lg"
                                  >+</button>button>
                        <button
                                    onClick={() => { scaleRef.current = Math.max(0.2, scaleRef.current * 0.8); }}
                                    className="w-8 h-8 bg-gray-900/80 backdrop-blur rounded text-gray-300 hover:text-white hover:bg-gray-700/80 flex items-center justify-center text-lg"
                                  >-</button>button>
                        <button
                                    onClick={() => { scaleRef.current = 1; offsetRef.current = { x: 0, y: 0 }; }}
                                    className="w-8 h-8 bg-gray-900/80 backdrop-blur rounded text-gray-300 hover:text-white hover:bg-gray-700/80 flex items-center justify-center text-xs"
                                  >Fit</button>button>
                </div>div>
          </div>div>
        );
}</div>
