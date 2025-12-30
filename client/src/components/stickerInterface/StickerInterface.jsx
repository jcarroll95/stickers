import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Image as KonvaImage, Layer, Stage } from "react-konva";
import useImage from "use-image";

/**
 * StickerInterface
 *
 * Interactive stickerboard using Konva.
 * - Loads a background board image and supports multiple sticker assets (sticker0.png - sticker9.png).
 * - Clicking a sticker in the palette enters placement mode: the sticker follows the cursor over the board.
 * - Clicking on the board places the sticker and records its 0..1 normalized coordinates.
 * - Persisting:
 *   - Controlled mode: pass `stickers` from backend and handle `onPlaceSticker` to persist.
 *   - Fallback demo mode: uses localStorage placements (backward compatible with earlier version).
 *
 * Props (all optional for now):
 * - boardSrc: string — background image path. Default: "/sb5.png"
 * - boardId: string — identifier for persistence key. Default: "default"
 * - stickers?: Array<StickerRecord> — authoritative stickers array (schema-compatible). If provided, component runs in controlled mode.
 * - readonly?: boolean — if true, hides palette and disables placement (good for listings/search).
 * - onPlaceSticker?: (updated: StickerRecord[], placed: StickerRecord, index: number) => void — notify host after placement.
 * - onAddSticker?: (placement) => void — legacy callback from demo mode.
 */
export default function StickerInterface({
  boardSrc = "/assets/sb0.png",
  boardId = "default",
  onAddSticker,
  // New props for controlled mode
  stickers,
  // New: allow passing persisted stickers while staying in demo mode
  persistedStickers = [],
  readonly = false,
  onPlaceSticker,
  // optional: external clear callback (if parent wants to control clearing)
  onClearStickers,
  // New: allow callers to control rendered long edge size (thumbnails, etc.)
  displayLongEdge = 600,
}) {
  const [bgImage] = useImage(boardSrc);
  // Demo mode: legacy single-sticker image (kept for backward compatibility only when stickers prop is absent)
  const [legacyStickerImage] = useImage("/assets/sticker0.png");

  const stageRef = useRef(null);
  const [isPlacing, setIsPlacing] = useState(false);
  const [hoverPos, setHoverPos] = useState({ x: 0, y: 0 });

  // Helper: map stickerId (0..9) to asset path
  const getStickerSrc = useCallback((stickerId) => `/assets/sticker${stickerId}.png`, []);
  // Validate stickerId is within known assets range
  const isValidStickerId = useCallback((id) => Number.isInteger(id) && id >= 0 && id <= 9, []);

  // Internal unified stickers state for controlled mode (optimistic updates)
  const isControlled = Array.isArray(stickers);
  const [internalStickers, setInternalStickers] = useState(() => (isControlled ? stickers : []));
  useEffect(() => {
    if (isControlled) setInternalStickers(stickers || []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isControlled, Array.isArray(stickers) ? stickers.length : 0, stickers]);

  // Selection (for controlled mode): which sticker entry (by index in internalStickers) is being placed
  const [placingIndex, setPlacingIndex] = useState(null);
  const placingSticker = useMemo(() => {
    if (!isControlled || placingIndex == null) return null;
    return internalStickers?.[placingIndex] || null;
  }, [isControlled, placingIndex, internalStickers]);
  const placingStickerId = placingSticker?.stickerId;
  const [placingImage] = useImage(
    placingStickerId != null && isValidStickerId(placingStickerId)
      ? getStickerSrc(placingStickerId)
      : null
  );

  // Board render dimensions (display): render with configurable long edge (default 600px).
  // Background image scales to fit entirely inside Stage so the whole image is visible.
  const boardSize = useMemo(() => {
    const TARGET_LONG_EDGE = Math.max(1, Number(displayLongEdge) || 600);
    if (bgImage && bgImage.width && bgImage.height) {
      const iw = bgImage.width;
      const ih = bgImage.height;
      const long = Math.max(iw, ih);
      const scale = TARGET_LONG_EDGE / long;
      return { width: Math.round(iw * scale), height: Math.round(ih * scale) };
    }
    // Fallback square while loading
    return { width: TARGET_LONG_EDGE, height: TARGET_LONG_EDGE };
  }, [bgImage]);

  // Default scale for legacy demo sticker: ensure long axis <= 10% of board short axis
  const legacyDefaultScale = useMemo(() => {
    if (!legacyStickerImage) return 1;
    const boardShort = Math.min(boardSize.width, boardSize.height);
    const stickerLong = Math.max(legacyStickerImage.width, legacyStickerImage.height);
    if (!boardShort || !stickerLong) return 1;
    const s = 0.35 * (boardShort / stickerLong);
    return Math.min(1, s);
  }, [boardSize.width, boardSize.height, legacyStickerImage]);

  // Default scale for currently placing sticker (controlled mode)
  const placingDefaultScale = useMemo(() => {
    if (!placingImage) return 1;
    const boardShort = Math.min(boardSize.width, boardSize.height);
    const stickerLong = Math.max(placingImage.width, placingImage.height);
    if (!boardShort || !stickerLong) return 1;
    const s = 0.25 * (boardShort / stickerLong);
    return Math.min(1, s);
  }, [boardSize.width, boardSize.height, placingImage]);

  // Persistence key for this board
  const storageKey = useMemo(
    () => `stickerboard:${boardId}:placements`,
    [boardId]
  );

  // Demo mode placements state (used only when not controlled)
  const [placements, setPlacements] = useState([]);
  const lastPlacement = useMemo(() => (placements.length > 0 ? placements[placements.length - 1] : null), [placements]);
  // Load persisted placements (localStorage placeholder) — only for demo mode
  useEffect(() => {
    if (isControlled) return;
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setPlacements(parsed);
      }
    } catch (_) {
      // ignore
    }
  }, [storageKey, isControlled]);

  const persistPlacements = useCallback(
    (next) => {
      if (isControlled) return; // not used in controlled mode
      setPlacements(next);
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch (_) {
        // ignore
      }
    },
    [storageKey, isControlled]
  );

  // Finalize the most recent locally-placed (demo mode) sticker by sending it to the backend
  const finalizeLatestPlacement = useCallback(async () => {
    if (isControlled) return; // finalize only applies to demo mode flow
    if (!lastPlacement) return;
    try {
      // Compute next zIndex: one higher than any currently placed (persisted) sticker
      const persisted = Array.isArray(persistedStickers) ? persistedStickers : [];
      const maxZ = persisted
        .filter((s) => s && s.stuck)
        .reduce((m, s) => (typeof s.zIndex === 'number' ? Math.max(m, s.zIndex) : m), 0);
      const nextZ = (Number.isFinite(maxZ) ? maxZ : 0) + 1;

      // Map demo placement to API schema
      const stickerDoc = {
        stickerId: 0, // demo uses sticker0.png
        x: lastPlacement.xNorm,
        y: lastPlacement.yNorm,
        scale: typeof lastPlacement.scale === 'number' ? lastPlacement.scale : legacyDefaultScale,
        rotation: lastPlacement.rotation || 0,
        zIndex: nextZ,
        stuck: true,
        createdAt: new Date().toISOString(),
      };

      const tokenStr = localStorage.getItem('token');
      const headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...(tokenStr ? { Authorization: `Bearer ${tokenStr}` } : {}),
      };

      // Use MongoDB $push operator to append a sticker into the array
      const res = await fetch(`/api/v1/stickerboards/${encodeURIComponent(boardId)}`, {
        method: 'PUT',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          $push: { stickers: stickerDoc },
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text}`);
      }

      // On success, clear local demo placements (optional) and log
      persistPlacements([]);
      // eslint-disable-next-line no-console
      console.log('Finalized sticker to backend:', stickerDoc);
      // Optionally dispatch a custom event so a parent can listen and refresh
      try {
        window.dispatchEvent(new CustomEvent('stickerboard:finalized', { detail: { boardId, sticker: stickerDoc } }));
      } catch (_) {
        // ignore
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Failed to finalize sticker:', err);
      alert(`Failed to finalize sticker: ${err.message || String(err)}`);
    }
  }, [isControlled, lastPlacement, legacyDefaultScale, boardId, persistPlacements]);

  // Enter placement mode from palette
  const enterPlacementMode = useCallback(
    (indexFromPalette) => {
      if (readonly) return;
      if (isControlled) {
        if (indexFromPalette == null) return;
        setPlacingIndex(indexFromPalette);
        setIsPlacing(true);
      } else {
        // demo mode uses legacy sticker image
        if (!legacyStickerImage) return;
        setIsPlacing(true);
      }
    },
    [isControlled, legacyStickerImage, readonly]
  );

  const onStageMouseMove = useCallback(
    (e) => {
      if (!isPlacing) return;
      const stage = e.target.getStage();
      const pos = stage?.getPointerPosition();
      if (!pos) return;
      // Clamp to board bounds
      const x = Math.max(0, Math.min(pos.x, boardSize.width));
      const y = Math.max(0, Math.min(pos.y, boardSize.height));
      setHoverPos({ x, y });
    },
    [isPlacing, boardSize.width, boardSize.height]
  );

  const placeSticker = useCallback(
    (e) => {
      if (!isPlacing) return;
      const stage = e.target.getStage();
      const pos = stage?.getPointerPosition();
      if (!pos) return;
      const withinX = pos.x >= 0 && pos.x <= boardSize.width;
      const withinY = pos.y >= 0 && pos.y <= boardSize.height;
      if (!withinX || !withinY) {
        // Click outside board - cancel placement
        setIsPlacing(false);
        setPlacingIndex(null);
        return;
      }
      const xNorm = pos.x / boardSize.width;
      const yNorm = pos.y / boardSize.height;

      if (isControlled) {
        if (placingIndex == null || !Array.isArray(internalStickers)) return;
        const original = internalStickers[placingIndex];
        if (!original) return;
        // Compute next zIndex so later placements render on top
        const maxZ = (internalStickers || [])
          .filter((s) => s && s.stuck)
          .reduce((m, s) => (typeof s.zIndex === 'number' ? Math.max(m, s.zIndex) : m), 0);
        const nextZ = (Number.isFinite(maxZ) ? maxZ : 0) + 1;
        const placedSticker = {
          ...original,
          x: xNorm,
          y: yNorm,
          scale: placingDefaultScale,
          rotation: original.rotation || 0,
          zIndex: nextZ,
          stuck: true,
          createdAt: original.createdAt || new Date().toISOString(),
        };
        const next = internalStickers.map((s, i) => (i === placingIndex ? placedSticker : s));
        setInternalStickers(next); // optimistic update
        setIsPlacing(false);
        setPlacingIndex(null);
        // notify parent
        if (typeof onPlaceSticker === "function") {
          try {
            onPlaceSticker(next, placedSticker, placingIndex);
          } catch (_) {
            // ignore
          }
        }
        // eslint-disable-next-line no-console
        console.log("Placed sticker (controlled):", placedSticker);
      } else {
        // Demo mode (legacy)
        const placement = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          xNorm,
          yNorm,
          // default scale so long axis of sticker <= 10% of board short axis
          scale: legacyDefaultScale,
          rotation: 0,
          asset: "/assets/sticker0.png",
        };
        const next = [...placements, placement];
        persistPlacements(next);
        setIsPlacing(false);
        if (typeof onAddSticker === "function") {
          try {
            onAddSticker(placement);
          } catch (_) {
            // ignore
          }
        }
        // eslint-disable-next-line no-console
        console.log("Placed sticker (demo):", placement);
      }
    },
    [isPlacing, boardSize.width, boardSize.height, isControlled, internalStickers, placingIndex, placingDefaultScale, placements, persistPlacements, onAddSticker, legacyDefaultScale]
  );

  // Compute legacy sticker render size (demo)
  const stickerDims = useMemo(() => {
    if (!legacyStickerImage) return { width: 0, height: 0 };
    return { width: legacyStickerImage.width, height: legacyStickerImage.height };
  }, [legacyStickerImage]);

  // Subcomponent: Render a placed sticker from model entry (controlled mode)
  const StickerSprite = ({ entry }) => {
    // Guard against invalid sticker ids to avoid broken images
    if (!isValidStickerId(entry?.stickerId)) return null;
    const src = getStickerSrc(entry.stickerId);
    const [img] = useImage(src);
    const scale = useMemo(() => {
      // Base scale: prefer stored scale; otherwise compute proportional default
      let base = 1;
      if (typeof entry.scale === "number") {
        base = entry.scale;
      } else if (img) {
        const boardShort = Math.min(boardSize.width, boardSize.height);
        const stickerLong = Math.max(img.width || 0, img.height || 0);
        if (boardShort && stickerLong) {
          // Match placement rule: s = 0.25 * (boardShort / stickerLong)
          base = Math.min(1, 0.25 * (boardShort / stickerLong));
        }
      }

      // Adjust for current display long edge so thumbnails (300) render at half the size of 600 view
      const targetLong = Math.max(1, Number(displayLongEdge) || 600);
      const ratio = targetLong / 600; // 300 → 0.5, 600 → 1
      return base * ratio;
    }, [entry.scale, boardSize.width, boardSize.height, img, displayLongEdge]);
    const halfW = (img?.width || 0) * scale * 0.5;
    const halfH = (img?.height || 0) * scale * 0.5;
    const x = (entry.x || 0) * boardSize.width - halfW;
    const y = (entry.y || 0) * boardSize.height - halfH;
    return (
      <KonvaImage
        image={img}
        x={x}
        y={y}
        scaleX={scale}
        scaleY={scale}
        rotation={entry.rotation || 0}
        listening={false}
      />
    );
  };

  // Render helpers
  const renderPlacedStickers = useMemo(() => {
    if (isControlled) {
      const placed = (internalStickers || []).filter((s) => !!s.stuck);
      // Optional: zIndex ordering
      placed.sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));
      return placed.map((entry, idx) => <StickerSprite key={`ps-${idx}`} entry={entry} />);
    }
    // Demo mode using legacy single sticker
    const persisted = Array.isArray(persistedStickers) ? persistedStickers : [];
    const persistedNodes = persisted
      .filter((s) => s && typeof s.x === 'number' && typeof s.y === 'number')
      .map((entry, idx) => <StickerSprite key={`persist-${idx}`} entry={entry} />);

    const localNodes = placements.map((p) => {
      const scale = typeof p.scale === "number" ? p.scale : legacyDefaultScale;
      const halfW = (stickerDims.width * scale) / 2;
      const halfH = (stickerDims.height * scale) / 2;
      const x = p.xNorm * boardSize.width - halfW; // center on click using scaled size
      const y = p.yNorm * boardSize.height - halfH;
      return (
        <KonvaImage
          key={p.id}
          image={legacyStickerImage}
          x={x}
          y={y}
          scaleX={scale}
          scaleY={scale}
          rotation={p.rotation}
          listening={false}
        />
      );
    });
    return [...persistedNodes, ...localNodes];
  }, [isControlled, internalStickers, placements, boardSize.width, boardSize.height, stickerDims.width, stickerDims.height, legacyStickerImage, legacyDefaultScale, persistedStickers]);

  const renderHoverSticker = useMemo(() => {
    if (!isPlacing) return null;
    if (isControlled) {
      if (!placingImage) return null;
      const halfW = ((placingImage?.width || 0) * placingDefaultScale) / 2;
      const halfH = ((placingImage?.height || 0) * placingDefaultScale) / 2;
      const x = hoverPos.x - halfW;
      const y = hoverPos.y - halfH;
      return (
        <KonvaImage
          image={placingImage}
          x={x}
          y={y}
          scaleX={placingDefaultScale}
          scaleY={placingDefaultScale}
          opacity={0.7}
          listening={false}
        />
      );
    }
    // Demo
    if (!legacyStickerImage) return null;
    const halfW = (stickerDims.width * legacyDefaultScale) / 2;
    const halfH = (stickerDims.height * legacyDefaultScale) / 2;
    const x = hoverPos.x - halfW;
    const y = hoverPos.y - halfH;
    return (
      <KonvaImage
        image={legacyStickerImage}
        x={x}
        y={y}
        scaleX={legacyDefaultScale}
        scaleY={legacyDefaultScale}
        opacity={0.7}
        listening={false}
      />
    );
  }, [isPlacing, isControlled, placingImage, placingDefaultScale, hoverPos.x, hoverPos.y, legacyStickerImage, stickerDims.width, stickerDims.height, legacyDefaultScale]);

  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
      {/* Left: Konva Stage with background and stickers */}
      <Stage
        width={boardSize.width}
        height={boardSize.height}
        ref={stageRef}
        onMouseMove={onStageMouseMove}
        onClick={placeSticker}
        style={{ border: "1px solid #ddd", background: "#f7f7f7" }}
      >
        <Layer>
          {/* Background board */}
          <KonvaImage image={bgImage} x={0} y={0} width={boardSize.width} height={boardSize.height} />
          {/* Existing stickers */}
          {renderPlacedStickers}
          {/* Hover ghost sticker while placing */}
          {renderHoverSticker}
        </Layer>
      </Stage>

      {/* Right: sticker palette — hidden entirely in readonly contexts (e.g., Explore) */}
      {!readonly && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 140 }}>
          <div style={{ fontSize: 14, color: "#444" }}>Sticker palette</div>
          {isControlled ? (() => {
            const available = (internalStickers || [])
              .map((s, i) => ({ entry: s, index: i }))
              .filter(({ entry }) => !entry.stuck && isValidStickerId(entry?.stickerId));

            if (available.length === 0) {
              return (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#9ca3af",
                    border: "1px dashed #e5e7eb",
                    borderRadius: 6,
                    height: 96,
                    fontSize: 13,
                  }}
                  aria-label="Sticker palette empty"
                >
                  Empty
                </div>
              );
            }

            return (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
                {available.map(({ entry, index }) => (
                  <button
                    key={`avail-${index}`}
                    type="button"
                    onClick={() => enterPlacementMode(index)}
                    style={{
                      padding: 6,
                      border: "1px solid #ccc",
                      background: isPlacing && placingIndex === index ? "#eef7ff" : "#fff",
                      cursor: "pointer",
                      borderRadius: 6,
                    }}
                    title={isPlacing && placingIndex === index ? "Click on the board to place" : "Click to place this sticker"}
                  >
                    <div style={{ fontSize: 12, marginBottom: 6 }}>Sticker {entry.stickerId}</div>
                    {/* eslint-disable-next-line jsx-a11y/alt-text */}
                    <img
                      src={getStickerSrc(entry.stickerId)}
                      alt={`sticker ${entry.stickerId}`}
                      style={{ display: "block", maxWidth: "100%", height: "auto" }}
                    />
                  </button>
                ))}
              </div>
            );
          })() : (
            <>
              {/* Demo mode single-sticker palette (fallback) */}
              <button
                type="button"
                onClick={() => enterPlacementMode(null)}
                style={{
                  padding: 6,
                  border: "1px solid #ccc",
                  background: isPlacing ? "#eef7ff" : "#fff",
                  cursor: "pointer",
                  borderRadius: 6,
                  width: 120,
                }}
                title={isPlacing ? "Click on the board to place" : "Click to place this sticker"}
              >
                <div style={{ fontSize: 12, marginBottom: 6 }}>
                  {isPlacing ? "Placing… click board" : "Sticker 0"}
                </div>
                {/* eslint-disable-next-line jsx-a11y/alt-text */}
                <img
                  src="/assets/sticker0.png"
                  alt="sticker"
                  style={{ display: "block", maxWidth: "100%", height: "auto" }}
                />
              </button>

              {/* Simple controls for debugging/clear — demo mode only */}
              <button
                type="button"
                onClick={() => persistPlacements([])}
                style={{ padding: 6, border: "1px solid #ccc", background: "#fff", cursor: "pointer", borderRadius: 6 }}
              >
                Clear stickers
              </button>
              <button
                type="button"
                onClick={finalizeLatestPlacement}
                disabled={!lastPlacement}
                style={{ padding: 6, border: "1px solid #4f46e5", background: lastPlacement ? "#eef2ff" : "#f3f4f6", color: "#111827", cursor: lastPlacement ? "pointer" : "not-allowed", borderRadius: 6 }}
                title={lastPlacement ? "Save the most recently placed sticker to the board" : "Place a sticker first"}
              >
                Finalize last sticker
              </button>
              <details style={{ fontSize: 12 }}>
                <summary>Debug placements</summary>
                <pre style={{ maxWidth: 240, whiteSpace: "pre-wrap" }}>{JSON.stringify(placements, null, 2)}</pre>
              </details>
            </>
          )}
        </div>
      )}
    </div>
  );
}


/*

<Image
  image={image}
  x={x * width}
  y={y * height}
  scaleX={scale}
  scaleY={scale}
  rotation={rotation}
/>




 */