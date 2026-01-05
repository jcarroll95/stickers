import React, { useMemo, useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { toast } from 'react-hot-toast';
import DOMPurify from 'dompurify';
import StickerInterface from '../stickerInterface/StickerInterface.jsx'
import AddStickForm from '../stix/AddStickForm.jsx';
import CommentList from '../comments/CommentList.jsx';
import AddCommentForm from '../comments/AddCommentForm.jsx';
import LoadingSpinner from '../common/LoadingSpinner.jsx';
import { useBoardData, useMe } from '../../hooks/useBoardData';
import apiClient from '../../services/apiClient';
import { parseError } from '../../utils/errorUtils';
import StixList from './subcomponents/StixList';
import styles from './BoardView.module.css';
import formStyles from '../stix/AddStickForm.module.css';

export default function BoardView({ token }) {
  const { board, loading, error, refreshBoard } = useBoardData(token);
  const { me, refreshMe } = useMe();
  const [showAddModal, setShowAddModal] = useState(false);
  const [commentsVersion, setCommentsVersion] = useState(0);

  useEffect(() => {
    const handler = (e) => {
      if (e?.detail?.boardId === (board?._id || board?.id)) {
        refreshBoard();
        refreshMe();
      }
    };
    window.addEventListener('stickerboard:finalized', handler);
    window.addEventListener('stickerboard:cleared', handler);
    return () => {
      window.removeEventListener('stickerboard:finalized', handler);
      window.removeEventListener('stickerboard:cleared', handler);
    };
  }, [board?._id, board?.id, refreshBoard, refreshMe]);

  const nextStickNumber = useMemo(() => {
    if (!board?.stix?.length) return 1;
    return Math.max(...board.stix.map(s => s.stickNumber || 0)) + 1;
  }, [board?.stix]);

  if (loading) return <LoadingSpinner message="Loading board…" />;
  if (error) return <div className={styles.error}>Error: {error}</div>;
  if (!board) return <div className={styles.error}>Board not found</div>;

  const isOwner = me && (board.user?._id || board.user) === (me._id || me.id);

  return (
    <div className={styles.container}>
      <header className={styles.headerRow}>
        <h1 className={styles.title} dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(board.name || 'Stickerboard') }} />
        {isOwner && (
          <button className={styles.addButton} onClick={() => setShowAddModal(true)}>
            + Add Stick
          </button>
        )}
      </header>

      {board.description && (
        <p className={styles.description} dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(board.description) }} />
      )}

      {Array.isArray(board.tags) && board.tags.length > 0 && (
        <div className={styles.tags}>
          {board.tags.map((tag, i) => (
            <span key={`${tag}-${i}`} className={styles.tag}>{String(tag)}</span>
          ))}
        </div>
      )}

      {(() => {
        const p = String(board?.photo || '').trim();
        const isHttp = /^https?:\/\//i.test(p);
        const isSbPng = /^sb[0-9]+\.png$/i.test(p);
        const boardSrc = isHttp ? p : (isSbPng ? `/assets/${p}` : '/assets/sb0.png');
        const sharedProps = {
          board,
          boardId: board._id || board.id,
          boardSrc,
          stickers: board.stickers || [],
          persistedStickers: board.stickers || [],
          isOwner,
          cheersStickers: me?.cheersStickers || [],
        };

        const onPlace = async (next, placed, index) => {
          const toastId = toast.loading('Saving...');
          try {
            await apiClient.put(`/stickerboards/${board._id || board.id}`, { stickers: next });
            window.dispatchEvent(new CustomEvent('stickerboard:finalized', { detail: { boardId: board._id || board.id, sticker: placed, index } }));
            toast.success('Saved!', { id: toastId });
          } catch (err) {
            toast.error(parseError(err), { id: toastId });
          }
        };

        return (
          <StickerInterface
            {...sharedProps}
            onPlaceSticker={onPlace}
            onClearStickers={isOwner ? async (next) => {
              const toastId = toast.loading('Clearing...');
              try {
                await apiClient.put(`/stickerboards/${board._id || board.id}`, { stickers: next });
                window.dispatchEvent(new CustomEvent('stickerboard:cleared', { detail: { boardId: board._id || board.id } }));
                toast.success('Cleared!', { id: toastId });
              } catch (err) {
                toast.error(parseError(err), { id: toastId });
              }
            } : undefined}
          />
        );
      })()}

      {isOwner && (
        <section>
          <h2>Stix</h2>
          <StixList stix={board.stix} />
        </section>
      )}

      {!isOwner && (
        <section style={{ marginTop: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2>Comments</h2>
            <AddCommentForm boardId={board._id || board.id} onSubmitted={() => setCommentsVersion(v => v + 1)} />
          </div>
          <CommentList key={commentsVersion} boardId={board._id || board.id} />
        </section>
      )}

      {isOwner && showAddModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalDialog}>
            <div className={styles.modalHeader}>
              <h3>Add a new Stick</h3>
              <button className={styles.modalClose} onClick={() => setShowAddModal(false)}>&times;</button>
            </div>
            <div className={styles.modalBody}>
              <AddStickForm
                boardId={board._id || board.id}
                nextStickNumber={nextStickNumber}
                title={null}
                className={formStyles.modalForm}
                onCreated={() => { setShowAddModal(false); refreshBoard(); }}
                onCancel={() => setShowAddModal(false)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

BoardView.propTypes = {
  token: PropTypes.string.isRequired,
};
