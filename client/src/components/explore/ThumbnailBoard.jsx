import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import StickerInterface from '../stickerInterface/StickerInterface.jsx';

/**
 * ThumbnailBoard Component
 * Read-only thumbnail rendering of a stickerboard.
 * 
 * @param {Object} props - Component properties
 * @param {Object} props.board - The stickerboard object to render
 */
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

ThumbnailBoard.propTypes = {
  board: PropTypes.shape({
    _id: PropTypes.string,
    id: PropTypes.string,
    photo: PropTypes.string,
    stickers: PropTypes.arrayOf(PropTypes.object),
  }).isRequired,
};
