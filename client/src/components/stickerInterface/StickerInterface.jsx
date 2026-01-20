import React, { useRef, useEffect } from "react";
import PropTypes from "prop-types";
import useStickerCanvas from "../../hooks/useStickerCanvas";
import CanvasStage from "./CanvasStage";
import StickerPalette from "./StickerPalette";
import BoardSidebar from "./BoardSidebar";
import styles from "./StickerInterface.module.css";

export default function StickerInterface(props) {
  const { readonly = false, forwardStageRef } = props;
  const stageRef = forwardStageRef || useRef(null);

  const {
    bgImage,
    legacyStickerImage,
    placingImage,
    isPlacing,
    hoverPos,
    boardSize,
    internalStickers,
    placingIndex,
    placingDefaultScale,
    legacyDefaultScale,
    placements,
    isControlled,
    getStickerSrc,
    isValidStickerId,
    enterPlacementMode,
    onStageMouseMove,
    placeSticker,
    resetPlacement,
    persistPlacements,
    finalizeLatestPlacement,
    placementStep,
    currentPlacement,
    isCheersMode,
    cheersStickers,
  } = useStickerCanvas(props);

  useEffect(() => {
    const handleGlobalClick = (e) => {
      if (!isPlacing) return;
      if (stageRef.current && !stageRef.current.content.contains(e.target)) {
        resetPlacement();
      }
    };

    window.addEventListener("mousedown", handleGlobalClick);
    return () => window.removeEventListener("mousedown", handleGlobalClick);
  }, [isPlacing, resetPlacement, stageRef]);

  return (
    <div className={styles.container}>
      <CanvasStage
        stageRef={stageRef}
        boardSize={boardSize}
        bgImage={bgImage}
        isControlled={isControlled}
        internalStickers={internalStickers}
        placements={placements}
        persistedStickers={props.persistedStickers}
        legacyDefaultScale={legacyDefaultScale}
        legacyStickerImage={legacyStickerImage}
        isPlacing={isPlacing}
        placingImage={placingImage}
        placingDefaultScale={placingDefaultScale}
        hoverPos={hoverPos}
        displayLongEdge={props.displayLongEdge}
        getStickerSrc={getStickerSrc}
        isValidStickerId={isValidStickerId}
        onMouseMove={onStageMouseMove}
        onClick={placeSticker}
        placementStep={placementStep}
        currentPlacement={currentPlacement}
      />

      {!readonly && (
        <div className={styles.controls}>
          <StickerPalette
            isControlled={isControlled}
            internalStickers={internalStickers}
            isValidStickerId={isValidStickerId}
            isPlacing={isPlacing}
            placingIndex={placingIndex}
            getStickerSrc={getStickerSrc}
            onSelectSticker={enterPlacementMode}
            isCheersMode={isCheersMode}
            cheersStickers={cheersStickers}
          />
          <BoardSidebar
            isControlled={isControlled}
            placements={placements}
            onClear={() => persistPlacements([])}
            onFinalize={finalizeLatestPlacement}
            canFinalize={placements.length > 0}
          />
        </div>
      )}
    </div>
  );
}

StickerInterface.propTypes = {
  board: PropTypes.object,
  boardId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  boardSrc: PropTypes.string.isRequired,
  stickers: PropTypes.arrayOf(PropTypes.object),
  persistedStickers: PropTypes.arrayOf(PropTypes.object),
  readonly: PropTypes.bool,
  displayLongEdge: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  onPlaceSticker: PropTypes.func,
  onAddSticker: PropTypes.func,
  isOwner: PropTypes.bool,
  cheersStickers: PropTypes.arrayOf(PropTypes.number),
  forwardStageRef: PropTypes.oneOfType([
    PropTypes.func,
    PropTypes.shape({ current: PropTypes.any })
  ]),
};
