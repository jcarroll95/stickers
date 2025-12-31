import React, { useMemo } from "react";
import PropTypes from "prop-types";
import { Image as KonvaImage, Layer, Stage } from "react-konva";
import useImage from "use-image";

/**
 * StickerSprite Sub-component
 * Renders a single sticker on the Konva layer.
 */
const StickerSprite = ({ entry, boardSize, displayLongEdge, getStickerSrc, isValidStickerId }) => {
  if (!isValidStickerId(entry?.stickerId)) return null;
  const src = getStickerSrc(entry.stickerId);
  const [img] = useImage(src);

  const scale = useMemo(() => {
    let base = 1;
    if (typeof entry.scale === "number") {
      base = entry.scale;
    } else if (img) {
      const boardShort = Math.min(boardSize.width, boardSize.height);
      const stickerLong = Math.max(img.width || 0, img.height || 0);
      if (boardShort && stickerLong) {
        base = Math.min(1, 0.25 * (boardShort / stickerLong));
      }
    }
    const targetLong = Math.max(1, Number(displayLongEdge) || 600);
    const ratio = targetLong / 600;
    return base * ratio;
  }, [entry.scale, boardSize, img, displayLongEdge]);

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

StickerSprite.propTypes = {
  entry: PropTypes.shape({
    stickerId: PropTypes.number,
    x: PropTypes.number,
    y: PropTypes.number,
    scale: PropTypes.number,
    rotation: PropTypes.number,
  }).isRequired,
  boardSize: PropTypes.shape({
    width: PropTypes.number.isRequired,
    height: PropTypes.number.isRequired,
  }).isRequired,
  displayLongEdge: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  getStickerSrc: PropTypes.func.isRequired,
  isValidStickerId: PropTypes.func.isRequired,
};

/**
 * CanvasStage Component
 * Pure presentation component for the Konva Stage.
 * 
 * @param {Object} props - Component properties
 */
export default function CanvasStage({
  boardSize,
  bgImage,
  isControlled,
  internalStickers,
  placements,
  persistedStickers,
  legacyDefaultScale,
  legacyStickerImage,
  isPlacing,
  placingImage,
  placingDefaultScale,
  hoverPos,
  displayLongEdge,
  getStickerSrc,
  isValidStickerId,
  onMouseMove,
  onClick,
  stageRef,
}) {
  const renderPlacedStickers = useMemo(() => {
    if (isControlled) {
      const placed = (internalStickers || []).filter((s) => !!s.stuck);
      placed.sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));
      return placed.map((entry, idx) => (
        <StickerSprite
          key={`ps-${idx}`}
          entry={entry}
          boardSize={boardSize}
          displayLongEdge={displayLongEdge}
          getStickerSrc={getStickerSrc}
          isValidStickerId={isValidStickerId}
        />
      ));
    }

    const persisted = Array.isArray(persistedStickers) ? persistedStickers : [];
    const persistedNodes = persisted
      .filter((s) => s && typeof s.x === "number" && typeof s.y === "number")
      .map((entry, idx) => (
        <StickerSprite
          key={`persist-${idx}`}
          entry={entry}
          boardSize={boardSize}
          displayLongEdge={displayLongEdge}
          getStickerSrc={getStickerSrc}
          isValidStickerId={isValidStickerId}
        />
      ));

    const localNodes = placements.map((p) => {
      const scale = typeof p.scale === "number" ? p.scale : legacyDefaultScale;
      // We don't have stickerDims easily here, but we can use the legacyStickerImage
      const imgW = legacyStickerImage?.width || 0;
      const imgH = legacyStickerImage?.height || 0;
      const halfW = (imgW * scale) / 2;
      const halfH = (imgH * scale) / 2;
      const x = p.xNorm * boardSize.width - halfW;
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
  }, [
    isControlled,
    internalStickers,
    boardSize,
    displayLongEdge,
    getStickerSrc,
    isValidStickerId,
    persistedStickers,
    placements,
    legacyDefaultScale,
    legacyStickerImage,
  ]);

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

    if (!legacyStickerImage) return null;
    const imgW = legacyStickerImage?.width || 0;
    const imgH = legacyStickerImage?.height || 0;
    const halfW = (imgW * legacyDefaultScale) / 2;
    const halfH = (imgH * legacyDefaultScale) / 2;
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
  }, [
    isPlacing,
    isControlled,
    placingImage,
    placingDefaultScale,
    hoverPos,
    legacyStickerImage,
    legacyDefaultScale,
  ]);

    return (
    <Stage
      width={boardSize.width}
      height={boardSize.height}
      ref={stageRef}
      onMouseMove={onMouseMove}
      onClick={onClick}
      style={{ border: "1px solid #ddd", background: "#f7f7f7" }}
    >
      <Layer>
        <KonvaImage image={bgImage} x={0} y={0} width={boardSize.width} height={boardSize.height} />
        {renderPlacedStickers}
        {renderHoverSticker}
      </Layer>
    </Stage>
  );
}

CanvasStage.propTypes = {
  boardSize: PropTypes.shape({
    width: PropTypes.number.isRequired,
    height: PropTypes.number.isRequired,
  }).isRequired,
  bgImage: PropTypes.any,
  isControlled: PropTypes.bool.isRequired,
  internalStickers: PropTypes.arrayOf(PropTypes.object),
  placements: PropTypes.arrayOf(PropTypes.object),
  persistedStickers: PropTypes.arrayOf(PropTypes.object),
  legacyDefaultScale: PropTypes.number,
  legacyStickerImage: PropTypes.any,
  isPlacing: PropTypes.bool.isRequired,
  placingImage: PropTypes.any,
  placingDefaultScale: PropTypes.number,
  hoverPos: PropTypes.shape({
    x: PropTypes.number.isRequired,
    y: PropTypes.number.isRequired,
  }).isRequired,
  displayLongEdge: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  getStickerSrc: PropTypes.func.isRequired,
  isValidStickerId: PropTypes.func.isRequired,
  onMouseMove: PropTypes.func.isRequired,
  onClick: PropTypes.func.isRequired,
  stageRef: PropTypes.oneOfType([
    PropTypes.func,
    PropTypes.shape({ current: PropTypes.any })
  ]),
};