import React, { useMemo } from "react";
import PropTypes from "prop-types";
import { Image as KonvaImage, Layer, Stage } from "react-konva";
import useImage from "use-image";

/**
 * StickerSprite Sub-component
 * Renders a single sticker on the Konva layer.
 */
const StickerSprite = React.memo(({ entry, boardSize, displayLongEdge, getStickerSrc, isValidStickerId }) => {
  const isValid = isValidStickerId(entry?.stickerId, entry?.isCheers);
  const src = isValid ? getStickerSrc(entry.stickerId, entry?.isCheers, entry) : null;
  const [img, status] = useImage(src, 'anonymous');

  // Log only if src is expected but img is not loading
  if (src && status === 'failed') {
    console.warn(`StickerSprite failed to load image: ${src}`, entry);
  }

  const scale = useMemo(() => {
    if (!isValid) return 1;
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
  }, [isValid, entry.scale, boardSize, img, displayLongEdge]);

  if (!isValid) return null;

  const halfW = (img?.width || 0) * scale * 0.5;
  const halfH = (img?.height || 0) * scale * 0.5;
  const x = (entry.x || 0) * boardSize.width;
  const y = (entry.y || 0) * boardSize.height;

  return (
    <KonvaImage
      image={img}
      x={x}
      y={y}
      offsetX={img?.width ? img.width / 2 : 0}
      offsetY={img?.height ? img.height / 2 : 0}
      scaleX={scale}
      scaleY={scale}
      rotation={entry.rotation || 0}
      listening={false}
    />
  );
});

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
const CanvasStage = ({
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
  placementStep,
  currentPlacement,
}) => {
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
      const x = p.xNorm * boardSize.width;
      const y = p.yNorm * boardSize.height;
      return (
        <KonvaImage
          key={p.id}
          image={legacyStickerImage}
          x={x}
          y={y}
          offsetX={legacyStickerImage?.width ? legacyStickerImage.width / 2 : 0}
          offsetY={legacyStickerImage?.height ? legacyStickerImage.height / 2 : 0}
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

    let img = isControlled ? placingImage : legacyStickerImage;
    if (!img) return null;

    let x, y, scale, rotation;

    if (currentPlacement) {
      // In SCALE or ROTATE step
      x = currentPlacement.x;
      y = currentPlacement.y;
      scale = currentPlacement.scale;
      rotation = currentPlacement.rotation || 0;
    } else {
      // In POSITION step
      const baseScale = isControlled ? placingDefaultScale : legacyDefaultScale;
      x = hoverPos.x;
      y = hoverPos.y;
      scale = baseScale;
      rotation = 0;
    }

    return (
      <KonvaImage
        image={img}
        x={x}
        y={y}
        offsetX={img.width / 2}
        offsetY={img.height / 2}
        scaleX={scale}
        scaleY={scale}
        rotation={rotation}
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
    currentPlacement,
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
};

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
  placementStep: PropTypes.string,
  currentPlacement: PropTypes.object,
};

export default React.memo(CanvasStage);