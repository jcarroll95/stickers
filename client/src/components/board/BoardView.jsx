import React, { useCallback, useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { toast } from 'react-hot-toast';
import DOMPurify from 'dompurify';
import StickerInterface from '../stickerInterface/StickerInterface.jsx'
import AddStickForm from '../stix/AddStickForm.jsx';
import styles from './BoardView.module.css';
import CommentList from '../comments/CommentList.jsx';
import AddCommentForm from '../comments/AddCommentForm.jsx';
import apiClient from '../../services/apiClient';
import LoadingSpinner from '../common/LoadingSpinner.jsx';
import { parseError } from '../../utils/errorUtils';

/**
 * BoardView Component
 * Displays a specific stickerboard given a token (id or slug).
 * 
 * @param {Object} props - Component properties
 * @param {string} props.token - The board ID or slug to fetch
 */
export default function BoardView({ token }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [board, setBoard] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [me, setMe] = useState(null);
  const [commentsVersion, setCommentsVersion] = useState(0); // bump to refresh list after add

  // Fetch the current logged-in user (to determine ownership)
  const loadMe = useCallback(async () => {
    try {
      const response = await apiClient.get('/auth/me');
      // apiClient.get returns response.data
      const userData = response.data || response;
      setMe(userData || null);
    } catch (err) {
      console.warn('[BoardView] Could not load user profile:', err.message);
      setMe(null);
    }
  }, []);

  const loadBoard = useCallback(async () => {
    let cancelled = false;
    try {
      setLoading(true);
      setError('');
      setBoard(null);

      // First attempt: treat token as an id
      try {
        const response = await apiClient.get(`/stickerboards/${encodeURIComponent(token)}`);
        const boardData = response.data || response;
        if (!cancelled) setBoard(boardData || null);
      } catch (err) {
        if (err.response?.status === 404) {
          // Fallback: try slug query
          const qResponse = await apiClient.get(`/stickerboards?slug=${encodeURIComponent(token)}&limit=1`);
          // advancedResults returns { success: true, count: X, data: [...] }
          const list = qResponse.data || qResponse;
          const first = Array.isArray(list) ? list[0] : (list?.data?.[0] || null);
          if (!cancelled) setBoard(first);
        } else {
          throw err;
        }
      }
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setLoading(false);
    }
    return () => { cancelled = true; };
  }, [token]);

  useEffect(() => {
    // call and ignore the cleanup return of loadBoard
    loadBoard();
    loadMe();
  }, [loadBoard, loadMe]);

  // Reload board after a sticker is finalized from the interface
  useEffect(() => {
    const handler = (e) => {
      if (!e?.detail?.boardId) return;
      if ((board?._id || board?.id) === e.detail.boardId) {
        loadBoard();
      }
    };
    window.addEventListener('stickerboard:finalized', handler);
    return () => window.removeEventListener('stickerboard:finalized', handler);
  }, [board?._id, board?.id, loadBoard]);

    // Determine the next stick number: 1 + highest valid numeric stickNumber on this board
    const nextStickNumber = useMemo(() => {
        if (!Array.isArray(board?.stix) || board.stix.length === 0) return 1;
        let max = 0;
        for (const s of board.stix) {
            const n = (typeof s?.stickNumber === 'number' && !isNaN(s.stickNumber)) ? s.stickNumber : null;
            if (n != null && n > max) max = n;
        }
        return max + 1;
    }, [board?.stix]);

  if (loading) return <LoadingSpinner message="Loading board…" />;
  if (error) return (
    <div className={`${styles.container} ${styles.error}`}>
      <p>Error: {error}</p>
      <button onClick={() => loadBoard()} className={styles.retryButton}>Retry</button>
    </div>
  );
  if (!board) return <p className={styles.container}>No board found.</p>;

  // Determine ownership
  const meId = me?._id || me?.id || me?.data?._id || me?.data?.id || me?.__id || null;
  const boardUser = board?.user;
  const boardOwnerId = typeof boardUser === 'string' ? boardUser : (boardUser?._id || boardUser?.id || null);
  const isOwner = !!(meId && boardOwnerId && String(meId) === String(boardOwnerId));

  //  presentation of the stickerboard
  return (
    <div className={styles.container}>
      {/* Header with title and action */}
      <div className={styles.headerRow}>
        <h1 
          className={styles.title}
          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(board.name || 'Stickerboard') }}
        />
        {isOwner && (
          <button type="button" className={styles.addButton} onClick={() => setShowAddModal(true)}>
            + Add Stick
          </button>
        )}
      </div>

      {/* Description */}
      {board.description && (
        <p 
          className={styles.description}
          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(board.description) }}
        />
      )}

      {/* Tags */}
      {Array.isArray(board.tags) && board.tags.length > 0 && (
        <div className={styles.tags}>
          {board.tags.map((tag, i) => (
            <span
              key={`${tag}-${i}`}
              className={styles.tag}
            >
              {String(tag)}
            </span>
          ))}
        </div>
      )}

      {/* Main board interface */}
      {(() => {
        // Determine Konva background image source from board.photo
        // If photo is one of our predefined files (e.g., "sb0.png".."sb8.png"), serve from /assets
        // If photo looks like a full URL, use as-is. Otherwise fallback to a default asset.
        const p = String(board?.photo || '').trim();
        const isHttp = /^https?:\/\//i.test(p);
        const isSbPng = /^sb[0-9]+\.png$/i.test(p);
        const boardSrc = isHttp ? p : (isSbPng ? `/assets/${p}` : '/assets/sb0.png');
        const sharedProps = {
          board,
          boardId: board._id || board.id,
          boardSrc,
          stickers: Array.isArray(board.stickers) ? board.stickers : [],
          persistedStickers: Array.isArray(board.stickers) ? board.stickers : [],
        };
        if (isOwner) {
          return (
            <StickerInterface
              {...sharedProps}
              onPlaceSticker={async (next /* full array */, placed, index) => {
                const saveToast = toast.loading('Saving sticker placement...');
                try {
                  await apiClient.put(`/stickerboards/${encodeURIComponent(board._id || board.id)}`, {
                    stickers: next
                  });
                  try {
                    window.dispatchEvent(new CustomEvent('stickerboard:finalized', { detail: { boardId: board._id || board.id, sticker: placed, index } }));
                  } catch (e) {
                    console.error('[BoardView] Failed to dispatch finalized event:', e);
                  }
                  await loadBoard();
                  toast.success('Sticker placement saved!', { id: saveToast });
                } catch (err) {
                  const errorMsg = parseError(err);
                  toast.error(`Failed to save sticker placement: ${errorMsg}`, { id: saveToast });
                }
              }}
              onClearStickers={async (next /* full array with stuck=false */) => {
                const clearToast = toast.loading('Clearing stickers...');
                try {
                  await apiClient.put(`/stickerboards/${encodeURIComponent(board._id || board.id)}`, {
                    stickers: next
                  });
                  try {
                    window.dispatchEvent(new CustomEvent('stickerboard:cleared', { detail: { boardId: board._id || board.id } }));
                  } catch (e) {
                    console.error('[BoardView] Failed to dispatch cleared event:', e);
                  }
                  await loadBoard();
                  toast.success('Stickers cleared!', { id: clearToast });
                } catch (err) {
                  const errorMsg = parseError(err);
                  toast.error(`Failed to clear stickers: ${errorMsg}`, { id: clearToast });
                }
              }}
            />
          );
        }
        // Non-owner: read-only view
        return (
          <StickerInterface
            {...sharedProps}
            readonly
          />
        );
      })()}

      {/* Owner-only: Render reverse-populated stix for this board (sorted by descending stickNumber) */}
      {isOwner && Array.isArray(board.stix) && (
        <section>
          <h2>Stix</h2>
          {board.stix.length === 0 ? (
            <p>No stix have been added to this board yet.</p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {[...board.stix]
                .sort((a, b) => {
                  const aNum = (typeof a?.stickNumber === 'number' && !isNaN(a.stickNumber)) ? a.stickNumber : -Infinity;
                  const bNum = (typeof b?.stickNumber === 'number' && !isNaN(b.stickNumber)) ? b.stickNumber : -Infinity;
                  // Descending order; items without a stickNumber fall to the end
                  return bNum - aNum;
                })
                .map((s) => {
                const created = s.createdAt ? new Date(s.createdAt) : null;
                return (
                  <li key={s._id || s.id} style={{
                    border: '1px solid #e5e7eb',
                    borderRadius: 8,
                    padding: 12,
                    marginBottom: 12
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <strong>
                        {s.stickNumber != null ? `#${s.stickNumber} ` : ''}
                        {s.stickMed ? `${s.stickMed}` : 'Stick'}
                        {s.stickDose != null ? ` — ${s.stickDose}` : ''}
                      </strong>
                      <span style={{ color: '#6b7280', fontSize: 12 }}>
                        {created ? created.toLocaleString() : ''}
                      </span>
                    </div>
                    <div style={{ color: '#374151', marginTop: 4 }}>
                      {(s.stickLocation || s.stickLocMod) && (
                        <span>
                          Location: {s.stickLocMod ? `${s.stickLocMod} ` : ''}
                          {s.stickLocation || ''}
                        </span>
                      )}
                    </div>
                    {s.description && (
                      <p style={{ marginTop: 8 }}>{s.description}</p>
                    )}
                    <div style={{ color: '#374151', marginTop: 4 }}>
                      {s.cost != null && (
                        <span>Cost: ${Number(s.cost).toFixed(2)}</span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      {/* Owner-only: Modal for adding a stick */}
      {isOwner && showAddModal && (
        <div className={styles.modalOverlay} role="dialog" aria-modal="true" aria-labelledby="add-stick-title">
          <div className={styles.modalDialog}>
            <div className={styles.modalHeader}>
              <h3 id="add-stick-title" style={{ margin: 0 }}>Add a new Stick</h3>
              <button className={styles.modalClose} aria-label="Close" onClick={() => setShowAddModal(false)}>&times;</button>
            </div>
            <div className={styles.modalBody}>
              <AddStickForm
                title={null}
                boardId={board._id || board.id}
                nextStickNumber={nextStickNumber}
                onCreated={() => {
                  setShowAddModal(false);
                  loadBoard();
                }}
                onCancel={() => setShowAddModal(false)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Non-owner: Comments section */}
      {!isOwner && (
        <section style={{ marginTop: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ margin: 0 }}>Comments</h2>
            <AddCommentForm
              boardId={board._id || board.id}
              onSubmitted={() => setCommentsVersion((v) => v + 1)}
            />
          </div>
          <CommentList key={`comments-${commentsVersion}`} boardId={board._id || board.id} />
        </section>
      )}

    </div>
  );
}

BoardView.propTypes = {
  token: PropTypes.string.isRequired,
};
