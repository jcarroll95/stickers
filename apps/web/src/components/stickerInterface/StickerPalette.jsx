import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useStickerInventory } from '../../hooks/useStickerInventory.js';
import styles from './StickerInterface.module.css';

const StickerPalette = ({ userId, onStickerSelect }) => {
  const [activeTab, setActiveTab] = useState(0);
  const [stickerPacks, setStickerPacks] = useState([]);
  const [userStickers, setUserStickers] = useState([]);
  const [loading, setLoading] = useState(true);

  const {
    fetchUserStickerInventory,
    awardSticker,
    revokeSticker
  } = useStickerInventory();

  useEffect(() => {
    const loadInventory = async () => {
      try {
        const inventory = await fetchUserStickerInventory(userId);
        setUserStickers(inventory);
        setLoading(false);
      } catch (error) {
        console.error('Failed to load sticker inventory:', error);
        setLoading(false);
      }
    };

    if (userId) {
      loadInventory();
    } else {
      setLoading(false);
    }
  }, [userId, fetchUserStickerInventory]);

  // Group stickers by pack for tabbed display
  useEffect(() => {
    if (userStickers.length > 0) {
      // Group stickers by packId
      const grouped = userStickers.reduce((acc, sticker) => {
        const packId = sticker.packId || 'default';
        if (!acc[packId]) {
          acc[packId] = {
            name: sticker.packName || 'Assorted',
            stickers: []
          };
        }
        acc[packId].stickers.push(sticker);
        return acc;
      }, {});

      // Convert to array of pack objects with sticker counts
      const packs = Object.entries(grouped).map(([packId, data]) => ({
        id: packId,
        name: data.name,
        stickers: data.stickers,
        count: data.stickers.length
      }));

      setStickerPacks(packs);
    } else {
      // Reset stickerPacks when userStickers is empty
      setStickerPacks([]);
    }
  }, [userStickers]);

  const handleStickerClick = (sticker) => {
    // Check if user has available quantity
    if (!sticker || sticker.quantity <= 0) return;

    // Trigger callback for parent component to enter placement mode
    if (onStickerSelect) {
      onStickerSelect(sticker);
    }
  };

  const renderStickerIcon = (sticker) => {
    return (
        <div
            key={sticker.id}
            className={`${styles.stickerIcon} ${sticker.quantity > 0 ? styles.available : styles.consumed}`}
            onClick={() => handleStickerClick(sticker)}
            title={sticker.name}
        >
          <img
              src={sticker.imageUrl}
              alt={sticker.name}
              className={styles.stickerImage}
          />
          <span className={styles.stickerName}>{sticker.name}</span>
          <span className={styles.stickerCount}>x{sticker.quantity}</span>
        </div>
    );
  };

  const renderTabs = () => {
    if (stickerPacks.length === 0) return null;

    return (
        <div className={styles.stickerPaletteTabs}>
          {stickerPacks.map((pack, index) => (
              <button
                  key={pack.id}
                  className={`${styles.tabButton} ${activeTab === index ? styles.active : ''}`}
                  onClick={() => setActiveTab(index)}
              >
                {pack.name} ({pack.count})
              </button>
          ))}
        </div>
    );
  };

  const renderStickers = () => {
    if (loading) {
      return <div className={styles.loading}>Loading stickers...</div>;
    }

    if (stickerPacks.length === 0) {
      return <div className={styles.noStickers}>No stickers available</div>;
    }

    const currentPack = stickerPacks[activeTab];
    if (!currentPack) return null;

    return (
        <div className={styles.stickerGrid}>
          {currentPack.stickers.map(sticker => renderStickerIcon(sticker))}
        </div>
    );
  };

  return (
      <div className={styles.stickerPalette}>
        <h3>Sticker Palette</h3>
        {renderTabs()}
        <div className={styles.stickerContent}>
          {renderStickers()}
        </div>
      </div>
  );
};

StickerPalette.propTypes = {
  userId: PropTypes.string,
  onStickerSelect: PropTypes.func
};

export default StickerPalette;
