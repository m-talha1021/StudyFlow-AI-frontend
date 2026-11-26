import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// ============================================================
// MIND MAP — interactive concept tree
// Renders a horizontal tree: central topic on the left, concepts
// branching to the right. Nodes expand/collapse on click, the
// canvas pans by dragging and zooms with buttons or the wheel.
// Pure layout helpers are exported so they can be unit-tested.
// ============================================================

const NODE_WIDTH = 200;
const NODE_WIDTH_COMPACT = 150;
const NODE_HEIGHT = 60;
const ROW_PITCH = 76;
const ROW_PITCH_COMPACT = 68;
const DEPTH_GAP = 56;
const DEPTH_GAP_COMPACT = 32;
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 1.8;

export function mindmapNodeCount(tree) {
  if (!tree || typeof tree !== "object") return 0;
  let count = 0;
  const walk = (node) => {
    count += 1;
    (node.children || []).forEach(walk);
  };
  walk(tree);
  return count;
}

export function mindmapToText(tree) {
  if (!tree || typeof tree !== "object") return "";
  const lines = [];
  const walk = (node, depth) => {
    const label = node.topic || node.label || "";
    if (!label) return;
    lines.push(`${"  ".repeat(depth)}- ${label}${node.detail ? `: ${node.detail}` : ""}`);
    (node.children || []).forEach((child) => walk(child, depth + 1));
  };
  walk(tree, 0);
  return lines.join("\n");
}

// Tidy horizontal layout. Every visible leaf gets its own row;
// a parent sits halfway between its first and last visible child.
export function layoutMindMap(tree, collapsed = new Set(), compact = false) {
  const nodeWidth = compact ? NODE_WIDTH_COMPACT : NODE_WIDTH;
  const depthGap = compact ? DEPTH_GAP_COMPACT : DEPTH_GAP;
  const rowPitch = compact ? ROW_PITCH_COMPACT : ROW_PITCH;
  const nodes = [];
  const links = [];
  let leafSlot = 0;

  const place = (node, depth, parentId, id) => {
    const hasChildren = Array.isArray(node.children) && node.children.length > 0;
    const isCollapsed = collapsed.has(id);
    const entry = {
      id,
      label: node.topic || node.label || "",
      detail: node.detail || "",
      depth,
      parentId,
      hasChildren,
      collapsed: isCollapsed,
      width: nodeWidth,
      height: NODE_HEIGHT,
      x: depth * (nodeWidth + depthGap),
      y: 0,
    };
    nodes.push(entry);
    if (hasChildren && !isCollapsed) {
      const childEntries = node.children.map((child, index) =>
        place(child, depth + 1, id, `${id}-${index}`)
      );
      entry.y =
        (childEntries[0].y + childEntries[childEntries.length - 1].y) / 2;
      for (const child of childEntries) {
        links.push({
          id: `${id}>${child.id}`,
          x1: entry.x + nodeWidth,
          y1: entry.y + NODE_HEIGHT / 2,
          x2: child.x,
          y2: child.y + NODE_HEIGHT / 2,
        });
      }
    } else {
      entry.y = leafSlot * rowPitch;
      leafSlot += 1;
    }
    return entry;
  };

  if (tree && typeof tree === "object") place(tree, 0, null, "0");

  const contentWidth =
    nodes.reduce((max, node) => Math.max(max, node.x + node.width), 0) || 0;
  const contentHeight =
    leafSlot > 0 ? (leafSlot - 1) * rowPitch + NODE_HEIGHT : NODE_HEIGHT;

  return { nodes, links, contentWidth, contentHeight };
}

function collectNodeIdsWithChildren(tree) {
  const ids = new Set();
  const walk = (node, id) => {
    if (Array.isArray(node.children) && node.children.length > 0) {
      ids.add(id);
      node.children.forEach((child, index) => walk(child, `${id}-${index}`));
    }
  };
  if (tree && typeof tree === "object") walk(tree, "0");
  return ids;
}

function collectDefaultCollapsed(tree) {
  // Start readable: main concepts and their children visible,
  // deeper levels collapsed until the student opens them.
  const ids = new Set();
  const walk = (node, depth, id) => {
    if (depth === 2 && Array.isArray(node.children) && node.children.length > 0) {
      ids.add(id);
    }
    (node.children || []).forEach((child, index) =>
      walk(child, depth + 1, `${id}-${index}`)
    );
  };
  if (tree && typeof tree === "object") walk(tree, 0, "0");
  return ids;
}

export default function MindMap({ tree }) {
  const viewportRef = useRef(null);
  const dragRef = useRef(null);
  const [collapsed, setCollapsed] = useState(() => collectDefaultCollapsed(tree));
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 16, y: 16 });
  const [compact, setCompact] = useState(
    () => typeof window !== "undefined" && window.innerWidth <= 560
  );

  const layout = useMemo(
    () => layoutMindMap(tree, collapsed, compact),
    [tree, collapsed, compact]
  );

  const fitView = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const rect = viewport.getBoundingClientRect();
    const nextZoom = Math.min(
      1,
      Math.max(MIN_ZOOM, (rect.width - 32) / Math.max(1, layout.contentWidth))
    );
    setZoom(nextZoom);
    setPan({
      x: Math.max(8, (rect.width - layout.contentWidth * nextZoom) / 2),
      y: Math.max(
        8,
        (rect.height - layout.contentHeight * nextZoom) / 2
      ),
    });
  }, [layout]);

  // Reset the view whenever a new map is generated or reopened.
  useEffect(() => {
    setCollapsed(collectDefaultCollapsed(tree));
    setZoom(1);
    setPan({ x: 16, y: 16 });
    const frame = requestAnimationFrame(fitView);
    return () => cancelAnimationFrame(frame);
    // fitView is intentionally re-created per layout; run once per tree.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tree]);

  useEffect(() => {
    const onResize = () => setCompact(window.innerWidth <= 560);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Wheel zoom (native listener so preventDefault works and the page
  // does not scroll while the pointer is over the map).
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const onWheel = (event) => {
      event.preventDefault();
      const factor = event.deltaY < 0 ? 1.12 : 1 / 1.12;
      setZoom((previous) =>
        Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, previous * factor))
      );
    };
    viewport.addEventListener("wheel", onWheel, { passive: false });
    return () => viewport.removeEventListener("wheel", onWheel);
  }, []);

  const toggleNode = useCallback((id) => {
    setCollapsed((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const expandAll = useCallback(() => setCollapsed(new Set()), []);
  const collapseAll = useCallback(() => {
    // Collapse every branch except the root itself, so the central
    // topic and its main concepts stay visible.
    const ids = collectNodeIdsWithChildren(tree);
    ids.delete("0");
    setCollapsed(ids);
  }, [tree]);

  const onPointerDown = (event) => {
    // Drag-to-pan starts on the canvas background only; node buttons
    // keep their click-to-toggle behaviour.
    if (event.target.closest(".mindmap-node")) return;
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      panX: pan.x,
      panY: pan.y,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    setPan({
      x: drag.panX + (event.clientX - drag.startX),
      y: drag.panY + (event.clientY - drag.startY),
    });
  };

  const onPointerUp = (event) => {
    if (dragRef.current?.pointerId === event.pointerId) {
      dragRef.current = null;
    }
  };

  if (!tree || typeof tree !== "object" || !tree.topic) {
    return (
      <p className="mindmap-empty">No mind map to show yet.</p>
    );
  }

  const totalNodes = mindmapNodeCount(tree);

  return (
    <div className="mindmap">
      <div className="mindmap-toolbar">
        <span className="mindmap-count">
          {totalNodes} concepts • Tap a node to expand or collapse it
        </span>
        <div className="mindmap-controls">
          <button type="button" className="mindmap-control-button" onClick={expandAll}>
            Expand all
          </button>
          <button type="button" className="mindmap-control-button" onClick={collapseAll}>
            Collapse all
          </button>
          <button
            type="button"
            className="mindmap-control-button"
            onClick={() => setZoom((previous) => Math.max(MIN_ZOOM, previous - 0.15))}
            aria-label="Zoom out"
          >
            −
          </button>
          <span className="mindmap-zoom-label">{Math.round(zoom * 100)}%</span>
          <button
            type="button"
            className="mindmap-control-button"
            onClick={() => setZoom((previous) => Math.min(MAX_ZOOM, previous + 0.15))}
            aria-label="Zoom in"
          >
            +
          </button>
          <button type="button" className="mindmap-control-button" onClick={fitView}>
            Fit
          </button>
        </div>
      </div>

      <div
        ref={viewportRef}
        className="mindmap-viewport"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div
          className="mindmap-canvas"
          style={{
            width: layout.contentWidth,
            height: layout.contentHeight,
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          }}
        >
          <svg
            className="mindmap-links"
            width={layout.contentWidth}
            height={layout.contentHeight}
            aria-hidden="true"
          >
            {layout.links.map((link) => {
              const mx = (link.x1 + link.x2) / 2;
              return (
                <path
                  key={link.id}
                  d={`M ${link.x1} ${link.y1} C ${mx} ${link.y1}, ${mx} ${link.y2}, ${link.x2} ${link.y2}`}
                />
              );
            })}
          </svg>

          {layout.nodes.map((node) => (
            <button
              key={node.id}
              type="button"
              className={
                `mindmap-node mindmap-node-depth-${Math.min(node.depth, 3)}` +
                (node.depth === 0 ? " mindmap-node-root" : "") +
                (node.hasChildren ? " mindmap-node-branch" : "")
              }
              style={{ left: node.x, top: node.y, width: node.width }}
              onClick={() => {
                if (node.hasChildren) toggleNode(node.id);
              }}
              aria-expanded={node.hasChildren ? !node.collapsed : undefined}
              aria-label={`${node.label}${node.hasChildren ? (node.collapsed ? " (collapsed, tap to expand)" : " (expanded, tap to collapse)") : ""}`}
            >
              <span className="mindmap-node-label">{node.label}</span>
              {node.detail && (
                <span className="mindmap-node-detail">{node.detail}</span>
              )}
              {node.hasChildren && (
                <span className="mindmap-node-toggle" aria-hidden="true">
                  {node.collapsed ? "+" : "−"}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <p className="mindmap-hint">Drag the map to pan • Scroll over it to zoom</p>
    </div>
  );
}
