import React, { useMemo, useState, useEffect, useRef, lazy, Suspense } from 'react';
import PropTypes from 'prop-types';
const StickerInterface = lazy(() => import('../stickerInterface/StickerInterface.jsx'));

/**
 * ThumbnailBoard Component
 * Read-only thumbnail rendering of a stickerboard.
 * Lazy-loads the actual canvas when it enters the viewport.
 * 
 * @param {Object} props - Component properties
 * @param {Object} props.board - The stickerboard object to render
 */
export default function ThumbnailBoard({ board }) {
  const [isVisible, setIsVisible] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, []);

  const boardSrc = useMemo(() => {
    const p = String(board?.photo || '').trim();
    const isHttp = /^https?:\/\//i.test(p);
    const isSbPng = /^sb[0-9]+\.png$/i.test(p);
    return isHttp ? p : (isSbPng ? `/assets/${p}` : '/assets/sb0.png');
  }, [board?.photo]);

  return (
    <div ref={containerRef} style={{ maxWidth: 300, minHeight: 200 }}>
        {isVisible ? (
            <Suspense fallback={<div style={{ minHeight: 200 }}>Loading...</div>}>
                <StickerInterface
                    board={board}
                    boardId={board?._id || board?.id || 'board'}
                    boardSrc={boardSrc}
                    stickers={Array.isArray(board?.stickers) ? board.stickers : []}
                    persistedStickers={Array.isArray(board?.stickers) ? board.stickers : []}
                    readonly
                    isOwner={false}
                    displayLongEdge={300}
                />
            </Suspense>
        ) : (
        <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f3f4f6', borderRadius: 8 }}>
          Loading thumbnail...
        </div>
      )}
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
