import React, { useState, useEffect, useCallback } from 'react';
import styles from './StickerPicker.module.css';
import apiClient from '../../services/apiClient.jsx';
import LoadingSpinner from '../common/LoadingSpinner.jsx';

const StickerPicker = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [userData, setUserData] = useState(null);
  const [inventory, setInventory] = useState([]);
  const [catalog, setCatalog] = useState({ packs: [], stickers: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchUserInventory = useCallback(async (identifier) => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.get(`/admin/inventory/${identifier}`);
      setUserData(response.data.user);
      setInventory(response.data.inventory);
      setCatalog(response.data.catalog);
      console.log(response.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to fetch inventory');
      setUserData(null);
      setInventory([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      fetchUserInventory(searchTerm.trim());
    }
  };

  const performAction = async (endpoint, payload) => {
    setActionLoading(true);
    try {
      await apiClient.post(`/admin/inventory/${endpoint}`, { ...payload, userId: userData._id });
      await fetchUserInventory(userData._id);
    } catch (err) {
      alert(err.response?.data?.error || 'Action failed');
    } finally {
      setActionLoading(false);
    }
  };

  // Group inventory by pack
  const groupedInventory = inventory.reduce((acc, item) => {
    const packId = item.stickerId?.packId || 'none';
    if (!acc[packId]) acc[packId] = [];
    acc[packId].push(item);
    return acc;
  }, {});

  const getPackName = (packId) => {
    if (packId === 'none') return 'Unassigned';
    const pack = catalog.packs.find(p => p._id === packId);
    return pack ? pack.name : 'Unknown Pack';
  };

  return (
    <div className={styles.container}>
      <h1>Sticker Inventory Manager</h1>

      <form onSubmit={handleSearch} className={styles.searchForm}>
        <input
          type="text"
          placeholder="User ID or Email"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className={styles.searchInput}
        />
        <button type="submit" disabled={loading} className={styles.searchButton}>
          {loading ? 'Searching...' : 'Search'}
        </button>
      </form>

      {error && <div className={styles.errorMessage}>{error}</div>}

      {userData && (
        <div className={styles.content}>
          <section className={styles.userSection}>
            <h2>Inventory for {userData.name} ({userData.email})</h2>
            {Object.keys(groupedInventory).length === 0 ? (
              <p>User has no stickers.</p>
            ) : (
              Object.entries(groupedInventory).map(([packId, items]) => (
                <div key={packId} className={styles.packGroup}>
                  <div className={styles.packHeader}>
                    <h3>{getPackName(packId)}</h3>
                    {packId !== 'none' && (
                      <button
                        onClick={() => performAction('remove-pack', { packId })}
                        disabled={actionLoading}
                        className={styles.removePackBtn}
                      >
                        Remove Entire Pack
                      </button>
                    )}
                  </div>
                  <div className={styles.stickerGrid}>
                    {items.map((item) => (
                      <div key={item._id} className={styles.stickerCard}>
                        <img src={item.stickerId.imageUrl} alt={item.stickerId.name} className={styles.stickerImg} />
                        <div className={styles.stickerInfo}>
                          <span className={styles.stickerName}>{item.stickerId.name}</span>
                          <span className={styles.stickerQty}>Qty: {item.quantity}</span>
                        </div>
                        <button
                          onClick={() => performAction('remove-sticker', { stickerId: item.stickerId._id })}
                          disabled={actionLoading}
                          className={styles.deleteBtn}
                        >
                          Delete
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </section>

          <section className={styles.catalogSection}>
            <h2>Add to Inventory</h2>

            <div className={styles.catalogSubsection}>
              <h3>Packs</h3>
              <div className={styles.catalogGrid}>
                {catalog.packs.map(pack => (
                  <div key={pack._id} className={styles.catalogCard}>
                    <strong>{pack.name}</strong>
                    <button
                      onClick={() => performAction('add-pack', { packId: pack._id })}
                      disabled={actionLoading}
                      className={styles.addBtn}
                    >
                      Add Pack
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className={styles.catalogSubsection}>
              <h3>Individual Stickers</h3>
              <div className={styles.stickerGrid}>
                {catalog.stickers.map(sticker => (
                  <div key={sticker._id} className={styles.stickerCard}>
                    <img src={sticker.imageUrl} alt={sticker.name} className={styles.stickerImg} />
                    <span className={styles.stickerName}>{sticker.name}</span>
                    <button
                      onClick={() => performAction('add-sticker', { stickerId: sticker._id })}
                      disabled={actionLoading}
                      className={styles.addBtn}
                    >
                      Add
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
};

export default StickerPicker;
