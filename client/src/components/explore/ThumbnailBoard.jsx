import React from 'react';
import PropTypes from 'prop-types';

/**
 * ThumbnailBoard Component
 * Displays a static thumbnail image for a stickerboard in the Explore view.
 * Falls back to a placeholder if no thumbnail is available.
 *
 * @param {Object} props - Component properties
 * @param {Object} props.board - The stickerboard object to render
 */
export default function ThumbnailBoard({ board }) {
  const thumbnailUrl = board?.thumbnail?.url;
  const placeholderUrl = '/assets/placeholder-thumbnail.svg';

  const imageUrl = thumbnailUrl || placeholderUrl;
  const altText = board?.name || 'Stickerboard thumbnail';

  return (
    <div style={{ maxWidth: 300, minHeight: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <img
        src={imageUrl}
        alt={altText}
        style={{
          maxWidth: '100%',
          height: 'auto',
          borderRadius: 8,
          objectFit: 'contain',
        }}
        onError={(e) => {
          // Fallback to placeholder if thumbnail fails to load
          if (e.target.src !== placeholderUrl) {
            e.target.src = placeholderUrl;
          }
        }}
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
