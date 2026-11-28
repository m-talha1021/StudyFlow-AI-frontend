import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";

// ============================================================
// MIND MAP — interactive concept tree
// Renders a horizontal tree: central topic on the left, concepts
// branching to the right. Nodes expand/collapse on click, the
// canvas pans by dragging and zooms with buttons or the wheel.
// Pure layout helpers are exported so they can be unit-tested.
// Download PNG: the component exposes downloadPng() through its
// ref. The export renders the FULL tree (every branch open) onto
// a 2x canvas, reading computed styles from a temporary
// off-screen fully-expanded copy, so the PNG matches the screen
// in light and dark mode without touching the visible map.
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

// PNG export: rendered at 2x so text stays sharp, with a margin
// around the map so no node sits flush against the image edge.
const EXPORT_SCALE = 2;
const EXPORT_PAD = 24;

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

// --- PNG export helpers (module scope, no DOM) ----------------

function parseFirstColor(value) {
  if (!value) return null;
  const match = value.match(/rgba?\([^)]+\)|#[0-9a-fA-F]{3,8}/);
  return match ? match[0] : null;
}

function parseGradientColors(value) {
  if (!value) return [];
  return value.match(/rgba?\([^)]+\)|#[0-9a-fA-F]{3,8}/g) || [];
}

function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(x, y, w, h, r);
    return;
  }
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Word-wrap like the DOM node does (overflow-wrap: anywhere):
// words wrap at spaces, and a single word longer than the line
// is broken character by character.
function wrapText(ctx, text, maxWidth) {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width <= maxWidth) {
      line = test;
      continue;
    }
    if (line) {
      lines.push(line);
      line = "";
    }
    if (ctx.measureText(word).width <= maxWidth) {
      line = word;
      continue;
    }
    let chunk = "";
    for (const ch of word) {
      if (chunk && ctx.measureText(chunk + ch).width > maxWidth) {
        lines.push(chunk);
        chunk = ch;
      } else {
        chunk += ch;
      }
    }
    line = chunk;
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

const MindMap = forwardRef(function MindMap({ tree, collapsedOverride = null }, ref) {
  const viewportRef = useRef(null);
  const dragRef = useRef(null);
  const [collapsed, setCollapsed] = useState(() => collectDefaultCollapsed(tree));
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 16, y: 16 });
  const [compact, setCompact] = useState(
    () => typeof window !== "undefined" && window.innerWidth <= 560
  );

  // The export clone passes collapsedOverride (an empty set) so the
  // PNG shows the whole tree; the visible map always uses its own
  // collapsed state.
  const effectiveCollapsed = collapsedOverride ?? collapsed;

  const layout = useMemo(
    () => layoutMindMap(tree, effectiveCollapsed, compact),
    [tree, effectiveCollapsed, compact]
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

  // --- Download PNG: full tree, always fully expanded -----------
  // Renders a temporary off-screen copy of this map with an empty
  // collapsed set, reads that copy's computed styles (so light and
  // dark mode export exactly as shown), draws the whole tree onto
  // a 2x canvas, and triggers a browser download. The visible map
  // is never touched: its collapsed state, zoom and pan are left
  // exactly as they were.
  const downloadPng = useCallback(
    async (filename) => {
      if (!tree || typeof tree !== "object" || !tree.topic) {
        throw new Error("No mind map to download.");
      }
      // Let the caller's "Downloading…" state paint before the work.
      await new Promise((resolve) => setTimeout(resolve, 30));

      const fullLayout = layoutMindMap(tree, new Set(), compact);
      const host = document.createElement("div");
      host.setAttribute("aria-hidden", "true");
      host.style.cssText =
        "position:fixed;left:-10000px;top:0;width:1200px;pointer-events:none;opacity:0;";
      document.body.appendChild(host);
      let cloneRoot = null;
      try {
        cloneRoot = createRoot(host);
        flushSync(() => {
          cloneRoot.render(
            <MindMap tree={tree} collapsedOverride={new Set()} />
          );
        });
        const viewportEl = host.querySelector(".mindmap-viewport");
        const linkEl = host.querySelector(".mindmap-links path");
        const nodeEls = [...host.querySelectorAll(".mindmap-node")];
        if (
          !viewportEl ||
          nodeEls.length !== fullLayout.nodes.length
        ) {
          throw new Error("Could not render the mind map for download.");
        }

        const width = fullLayout.contentWidth + EXPORT_PAD * 2;
        const height = fullLayout.contentHeight + EXPORT_PAD * 2;
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(width * EXPORT_SCALE);
        canvas.height = Math.round(height * EXPORT_SCALE);
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Canvas is not available.");
        ctx.scale(EXPORT_SCALE, EXPORT_SCALE);
        ctx.translate(EXPORT_PAD, EXPORT_PAD);

        // Background: the viewport's own background colour, plus its
        // dot grid (same 22px grid as on screen).
        const viewportCs = getComputedStyle(viewportEl);
        ctx.fillStyle = viewportCs.backgroundColor || "#f8fafc";
        ctx.fillRect(-EXPORT_PAD, -EXPORT_PAD, width, height);
        const dotColor = parseFirstColor(viewportCs.backgroundImage);
        if (dotColor) {
          ctx.fillStyle = dotColor;
          for (let gy = -EXPORT_PAD + 1; gy < height - EXPORT_PAD; gy += 22) {
            for (let gx = -EXPORT_PAD + 1; gx < width - EXPORT_PAD; gx += 22) {
              ctx.beginPath();
              ctx.arc(gx, gy, 1, 0, Math.PI * 2);
              ctx.fill();
            }
          }
        }

        // Connector curves.
        const linkCs = linkEl ? getComputedStyle(linkEl) : null;
        ctx.strokeStyle = (linkCs && linkCs.stroke) || "#a5b4fc";
        ctx.lineWidth = parseFloat((linkCs && linkCs.strokeWidth) || "2") || 2;
        ctx.lineCap = "round";
        for (const link of fullLayout.links) {
          const mx = (link.x1 + link.x2) / 2;
          ctx.beginPath();
          ctx.moveTo(link.x1, link.y1);
          ctx.bezierCurveTo(mx, link.y1, mx, link.y2, link.x2, link.y2);
          ctx.stroke();
        }

        // Nodes, in layout order (same order as the clone's DOM).
        fullLayout.nodes.forEach((node, index) => {
          const el = nodeEls[index];
          const cs = getComputedStyle(el);
          const labelEl = el.querySelector(".mindmap-node-label");
          const detailEl = el.querySelector(".mindmap-node-detail");
          const toggleEl = el.querySelector(".mindmap-node-toggle");
          const labelCs = labelEl ? getComputedStyle(labelEl) : cs;
          const detailCs = detailEl ? getComputedStyle(detailEl) : null;
          const borderWidth = parseFloat(cs.borderWidth) || 1.5;
          const family = cs.fontFamily || "inherit";

          // Fill (solid, or the root node's indigo gradient).
          ctx.save();
          ctx.shadowColor = "rgba(30, 27, 75, 0.08)";
          ctx.shadowBlur = 8;
          ctx.shadowOffsetY = 2;
          roundRectPath(ctx, node.x, node.y, node.width, NODE_HEIGHT, 12);
          const bgImage = cs.backgroundImage || "";
          if (bgImage.includes("linear-gradient")) {
            const stops = parseGradientColors(bgImage);
            if (stops.length >= 2) {
              const gradient = ctx.createLinearGradient(
                node.x + node.width,
                node.y,
                node.x,
                node.y + NODE_HEIGHT
              );
              gradient.addColorStop(0, stops[0]);
              gradient.addColorStop(1, stops[stops.length - 1]);
              ctx.fillStyle = gradient;
            } else {
              ctx.fillStyle = cs.backgroundColor;
            }
          } else {
            ctx.fillStyle = cs.backgroundColor;
          }
          ctx.fill();
          ctx.restore();

          // Border.
          roundRectPath(ctx, node.x, node.y, node.width, NODE_HEIGHT, 12);
          ctx.strokeStyle = cs.borderColor;
          ctx.lineWidth = borderWidth;
          ctx.stroke();

          // Text: label, then detail (max 2 lines), vertically
          // centred like the DOM node's justify-content: center.
          const textMaxWidth = node.width - 42; // 12px left + 30px right pad
          const labelSize = parseFloat(labelCs.fontSize) || 13.5;
          const labelLineHeight = labelSize * 1.25;
          ctx.font = `${labelCs.fontWeight || "700"} ${labelSize}px ${family}`;
          const labelLines = wrapText(ctx, node.label, textMaxWidth);
          let detailLines = [];
          let detailSize = 11.5;
          let detailLineHeight = 15;
          if (detailEl && node.detail && detailCs) {
            detailSize = parseFloat(detailCs.fontSize) || 11.5;
            detailLineHeight = detailSize * 1.3;
            ctx.font = `${detailCs.fontWeight || "400"} ${detailSize}px ${family}`;
            detailLines = wrapText(ctx, node.detail, textMaxWidth).slice(0, 2);
          }
          const blockHeight =
            labelLines.length * labelLineHeight +
            (detailLines.length
              ? 2 + detailLines.length * detailLineHeight
              : 0);
          let textY = node.y + (NODE_HEIGHT - blockHeight) / 2;
          ctx.textAlign = "left";
          ctx.textBaseline = "top";
          ctx.fillStyle = labelCs.color || cs.color;
          ctx.font = `${labelCs.fontWeight || "700"} ${labelSize}px ${family}`;
          for (const line of labelLines) {
            ctx.fillText(line, node.x + 12, textY);
            textY += labelLineHeight;
          }
          if (detailLines.length && detailCs) {
            textY += 2;
            ctx.fillStyle = detailCs.color;
            ctx.font = `${detailCs.fontWeight || "400"} ${detailSize}px ${family}`;
            for (const line of detailLines) {
              ctx.fillText(line, node.x + 12, textY);
              textY += detailLineHeight;
            }
          }

          // Expand/collapse badge, as shown in the full tree.
          if (node.hasChildren && toggleEl) {
            const toggleCs = getComputedStyle(toggleEl);
            const cx = node.x + node.width - 18;
            const cy = node.y + NODE_HEIGHT / 2;
            ctx.beginPath();
            ctx.arc(cx, cy, 10, 0, Math.PI * 2);
            ctx.fillStyle = toggleCs.backgroundColor;
            ctx.fill();
            ctx.fillStyle = toggleCs.color;
            ctx.font = `700 14px ${family}`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(node.collapsed ? "+" : "−", cx, cy + 0.5);
          }
        });

        const blob = await new Promise((resolve, reject) => {
          canvas.toBlob(
            (result) =>
              result
                ? resolve(result)
                : reject(new Error("Could not encode the PNG.")),
            "image/png"
          );
        });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = filename || "studyque-mindmap.png";
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        return true;
      } finally {
        if (cloneRoot) cloneRoot.unmount();
        host.remove();
      }
    },
    [tree, compact]
  );

  useImperativeHandle(ref, () => ({ downloadPng }), [downloadPng]);

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
});

export default MindMap;
