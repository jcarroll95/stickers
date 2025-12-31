import React from "react";
import PropTypes from "prop-types";

/**
 * BoardSidebar Component
 * Renders auxiliary controls and debug information.
 * 
 * @param {Object} props - Component properties
 */
export default function BoardSidebar({
  isControlled,
  placements,
  onClear,
  onFinalize,
  canFinalize,
}) {
  if (isControlled) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
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
        title={canFinalize ? "Save the most recently placed sticker to the board" : "Place a sticker first"}
      >
        Finalize last sticker
      </button>
      <details style={{ fontSize: 12 }}>
        <summary>Debug placements</summary>
        <pre style={{ maxWidth: 240, whiteSpace: "pre-wrap" }}>
          {JSON.stringify(placements, null, 2)}
        </pre>
      </details>
    </div>
  );
}

BoardSidebar.propTypes = {
  isControlled: PropTypes.bool.isRequired,
  placements: PropTypes.arrayOf(PropTypes.object),
  onClear: PropTypes.func.isRequired,
  onFinalize: PropTypes.func.isRequired,
  canFinalize: PropTypes.bool.isRequired,
};