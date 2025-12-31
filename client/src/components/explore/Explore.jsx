import React, { useCallback, useEffect, useState } from 'react';
import styles from './Explore.module.css';
import ThumbnailBoard from './ThumbnailBoard.jsx';
import apiClient from '../../services/apiClient';

/**
 * Explore Component
 * Public explore page: paginated grid of stickerboard thumbnails.
 */
export default function Explore() {
  const [page, setPage] = useState(1);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasNext, setHasNext] = useState(false);
  const [hasPrev, setHasPrev] = useState(false);

  const limit = 9; // 9 at a time

  const loadPage = useCallback(async (p) => {
    let cancelled = false;
    try {
      setLoading(true);
      setError('');
      
      const response = await apiClient.get(`/stickerboards?limit=${limit}&page=${p}`);
      
      if (!cancelled) {
        // apiClient interceptor returns response.data
        // The structure of advancedResults is { success: true, count: X, data: [...], pagination: {...} }
        const data = response.data || response;
        setItems(Array.isArray(data) ? data : []);
        
        const pag = response.pagination || {};
        setHasNext(!!pag.next);
        setHasPrev(!!pag.prev);
      }
    } catch (e) {
      if (!cancelled) {
        const errorMsg = e.response?.data?.error || e.message || String(e);
        setError(errorMsg);
      }
    } finally {
      if (!cancelled) setLoading(false);
    }
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    loadPage(page);
  }, [page, loadPage]);

  const onPrev = useCallback(() => {
    setPage((p) => Math.max(1, p - 1));
  }, []);
  const onNext = useCallback(() => {
    setPage((p) => p + 1);
  }, []);

  const cardClick = useCallback((board) => {
    const token = board?.slug || board?._id || board?.id;
    if (token) {
      window.location.hash = `#/board/${token}`;
    }
  }, []);

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>Explore Stickerboards</h2>
      {loading && <p>Loading…</p>}
      {error && <p style={{ color: 'crimson' }}>Error: {error}</p>}

      <div className={styles.grid}>
        {items.map((b) => (
          <div key={b._id || b.id} className={styles.card}>
            <h3 className={styles.cardTitle} title={b.name || 'Untitled'}>
              {b.name || 'Untitled'}
            </h3>
            <div className={styles.thumb} onClick={() => cardClick(b)} role="button" tabIndex={0}
                 onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); cardClick(b); } }}>
              <ThumbnailBoard board={b} />
            </div>
          </div>
        ))}
      </div>

      <div className={styles.pagination}>
        <button className={styles.button} onClick={onPrev} disabled={!hasPrev || page === 1}>Prev</button>
        <div>Page {page}</div>
        <button className={styles.button} onClick={onNext} disabled={!hasNext}>Next</button>
      </div>
    </div>
  );
}
