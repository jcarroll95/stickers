import React from "react";
import PropTypes from "prop-types";

/**
 * BoardSidebar Component
 * Renders auxiliary controls and debug information.
 * 
 * @param {Object} props - Component properties
 */
const BoardSidebar = ({
  isControlled,
  placements,
  onClear,
  onFinalize,
  canFinalize,
  isCheersMode,
}) => {
  // If isControlled but NOT cheers mode, hide the sidebar (it's for demo mode usually)
  // In cheers mode, we want to see the "Finalize" button to save the cheers sticker.
  if (isControlled && !isCheersMode) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {!isCheersMode && (
        <button
          type="button"
          onClick={onClear}
          style={{
            padding: 6,
            border: "1px solid #ccc",
            background: "#fff",
            cursor: "pointer",
            borderRadius: 6,
          }}
        >
          Clear stickers
        </button>
      )}
      <button
        type="button"
        onClick={onFinalize}
        disabled={!canFinalize}
        style={{
          padding: 6,
          border: "1px solid #4f46e5",
          background: canFinalize ? "#eef2ff" : "#f3f4f6",
          color: "#111827",
          cursor: canFinalize ? "pointer" : "not-allowed",
          borderRadius: 6,
        }}
        title={canFinalize ? (isCheersMode ? "Send this Cheers! sticker" : "Save the most recently placed sticker to the board") : "Place a sticker first"}
      >
        {isCheersMode ? "Send Cheers!" : "Finalize last sticker"}
      </button>
      {!isCheersMode && (
        <details style={{ fontSize: 12 }}>
          <summary>Debug placements</summary>
          <pre style={{ maxWidth: 240, whiteSpace: "pre-wrap" }}>
            {JSON.stringify(placements, null, 2)}
          </pre>
        </details>
      )}
    </div>
  );
}

BoardSidebar.propTypes = {
  isControlled: PropTypes.bool.isRequired,
  placements: PropTypes.arrayOf(PropTypes.object),
  onClear: PropTypes.func.isRequired,
  onFinalize: PropTypes.func.isRequired,
  canFinalize: PropTypes.bool.isRequired,
  isCheersMode: PropTypes.bool,
};
export default React.memo(BoardSidebar);
