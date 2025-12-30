import React, { useCallback, useEffect, useMemo, useState } from 'react';
import styles from './Explore.module.css';
import ThumbnailBoard from './ThumbnailBoard.jsx';

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
      // Public endpoint; include credentials if cookies are used but not required.
      const res = await fetch(`/api/v1/stickerboards?limit=${limit}&page=${p}`, {
        headers: { 'Accept': 'application/json' },
        credentials: 'include'
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text}`);
      }
      const json = await res.json();
      if (!cancelled) {
        setItems(Array.isArray(json?.data) ? json.data : []);
        const pag = json?.pagination || {};
        setHasNext(!!pag.next);
        setHasPrev(!!pag.prev);
      }
    } catch (e) {
      if (!cancelled) setError(e.message || String(e));
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
