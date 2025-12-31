import React from "react";
import PropTypes from "prop-types";

/**
 * StickerPalette Component
 * Renders the sticker selection UI.
 * 
 * @param {Object} props - Component properties
 */
const StickerPalette = ({
  isControlled,
  internalStickers,
  isValidStickerId,
  isPlacing,
  placingIndex,
  getStickerSrc,
  onSelectSticker,
}) => {
  return (
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
                onClick={() => onSelectSticker(index)}
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
        <button
          type="button"
          onClick={() => onSelectSticker(null)}
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
          <img
            src="/assets/sticker0.png"
            alt="sticker"
            style={{ display: "block", maxWidth: "100%", height: "auto" }}
          />
        </button>
      )}
    </div>
  );
}

StickerPalette.propTypes = {
  isControlled: PropTypes.bool.isRequired,
  internalStickers: PropTypes.arrayOf(PropTypes.object),
  isValidStickerId: PropTypes.func.isRequired,
  isPlacing: PropTypes.bool.isRequired,
  placingIndex: PropTypes.number,
  getStickerSrc: PropTypes.func.isRequired,
  onSelectSticker: PropTypes.func.isRequired,
};
export default React.memo(StickerPalette);
