import React, { useMemo } from 'react';
import StickerInterface from '../stickerInterface/StickerInterface.jsx';

// Read-only thumbnail rendering of a stickerboard using StickerInterface.
// Long edge is capped at 300px for compact grid display.
export default function ThumbnailBoard({ board }) {
  const boardSrc = useMemo(() => {
    const p = String(board?.photo || '').trim();
    const isHttp = /^https?:\/\//i.test(p);
    const isSbPng = /^sb[0-9]+\.png$/i.test(p);
    return isHttp ? p : (isSbPng ? `/assets/${p}` : '/assets/sb0.png');
  }, [board?.photo]);

  return (
    <div style={{ maxWidth: 300 }}>
      <StickerInterface
        board={board}
        boardId={board?._id || board?.id || 'board'}
        boardSrc={boardSrc}
        stickers={Array.isArray(board?.stickers) ? board.stickers : []}
        persistedStickers={Array.isArray(board?.stickers) ? board.stickers : []}
        readonly
        displayLongEdge={300}
      />
    </div>
  );
}
