import React, { useCallback, useMemo, useState } from 'react';

// Inline button + form to add a new review (comment) to a stickerboard.
// Shows a single button initially; when clicked, expands a small form.
export default function AddReviewForm({ boardId, onSubmitted }) {
  const [open, setOpen] = useState(false);
  const [comment, setComment] = useState('');
  const [rating, setRating] = useState(''); // optional 1..5
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState('');
  const [okMsg, setOkMsg] = useState('');

  const canSubmit = useMemo(() => {
    return comment.trim().length > 0 && comment.trim().length <= 500 && !posting;
  }, [comment, posting]);

  const reset = useCallback(() => {
    setComment('');
    setRating('');
    setError('');
    setOkMsg('');
  }, []);

  const onClickAdd = useCallback(() => {
    setOpen((v) => !v);
    setError('');
    setOkMsg('');
  }, []);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    try {
      setPosting(true);
      setError('');
      setOkMsg('');
      const tokenStr = localStorage.getItem('token');
      const headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...(tokenStr ? { Authorization: `Bearer ${tokenStr}` } : {}),
      };
      const body = {
        comment: comment.trim(),
      };
      const r = parseInt(rating, 10);
      if (!isNaN(r) && r >= 1 && r <= 5) body.reviewRating = r;

      const res = await fetch(`/api/v1/stickerboards/${encodeURIComponent(boardId)}/reviews`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text}`);
      }
      setOkMsg('Comment added!');
      if (typeof onSubmitted === 'function') onSubmitted();
      reset();
      setOpen(false);
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setPosting(false);
    }
  }, [boardId, canSubmit, comment, rating, onSubmitted, reset]);

  return (
    <div>
      {!open ? (
        <button type="button" onClick={onClickAdd} style={{ padding: '6px 10px', border: '1px solid #ccc', borderRadius: 6, background: '#f7f7f7', cursor: 'pointer' }}>
          + Add Comment
        </button>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'stretch', minWidth: 260 }}>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Write your comment (max 500 characters)"
            maxLength={500}
            rows={3}
            style={{ resize: 'vertical', padding: 8, border: '1px solid #d1d5db', borderRadius: 6 }}
            required
          />
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'space-between' }}>
            <label style={{ fontSize: 12, color: '#374151' }}>
              Rating (optional):
              <select value={rating} onChange={(e) => setRating(e.target.value)} style={{ marginLeft: 6 }}>
                <option value="">—</option>
                {[1,2,3,4,5].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={() => { reset(); setOpen(false); }} style={{ padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 6, background: '#fff' }}>
                Cancel
              </button>
              <button type="submit" disabled={!canSubmit} style={{ padding: '6px 10px', border: '1px solid #4f46e5', borderRadius: 6, background: canSubmit ? '#eef2ff' : '#f3f4f6', cursor: canSubmit ? 'pointer' : 'not-allowed' }}>
                {posting ? 'Saving…' : 'Submit'}
              </button>
            </div>
          </div>
          {error && <div style={{ color: 'crimson', fontSize: 12 }}>{error}</div>}
          {okMsg && <div style={{ color: 'green', fontSize: 12 }}>{okMsg}</div>}
        </form>
      )}
    </div>
  );
}
