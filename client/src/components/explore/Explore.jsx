import React, { Suspense } from 'react';
import DOMPurify from 'dompurify';
import LoadingSpinner from '../common/LoadingSpinner.jsx';
import ThumbnailBoard from './ThumbnailBoard.jsx';
import { useExplore } from '../../hooks/useExplore';
import styles from './Explore.module.css';

export default function Explore() {
  const { items, loading, error, page, setPage, hasPrev, hasNext, loadPage } = useExplore();

  const onPrev = () => setPage((p) => Math.max(1, p - 1));
  const onNext = () => setPage((p) => p + 1);

  const cardClick = (board) => {
    const token = board?._id || board?.id || board?.slug;
    if (token) {
      window.location.hash = `#/board/${token}`;
    }
  };

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>Explore Stickerboards</h2>
      {loading && <LoadingSpinner message="Loading stickerboards…" />}
      {error && (
        <div className={styles.errorContainer}>
          <p>Error: {error}</p>
          <button onClick={() => loadPage(page)} className={styles.retryButton}>Retry</button>
        </div>
      )}

      <div className={styles.grid}>
        {items.map((b) => (
          <div key={b._id || b.id} className={styles.card}>
            <h3 
              className={styles.cardTitle} 
              title={b.name || 'Untitled'}
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(b.name || 'Untitled') }}
            />
            <div className={styles.thumb} onClick={() => cardClick(b)} role="button" tabIndex={0}
                 onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); cardClick(b); } }}>
              <Suspense fallback={<div className={styles.thumbLoading}>Loading thumbnail...</div>}>
                <ThumbnailBoard board={b} />
              </Suspense>
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
