import React, { useCallback, useEffect, useState } from 'react';

// Lists reviews for a given stickerboard. Read-only.
export default function ReviewList({ boardId }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [items, setItems] = useState([]);

  const load = useCallback(async () => {
    let cancelled = false;
    try {
      setLoading(true);
      setError('');
      const res = await fetch(`/api/v1/stickerboards/${encodeURIComponent(boardId)}/reviews`, {
        headers: { 'Accept': 'application/json' },
        credentials: 'include'
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text}`);
      }
      const json = await res.json();
      if (!cancelled) setItems(Array.isArray(json?.data) ? json.data : []);
    } catch (e) {
      if (!cancelled) setError(e.message || String(e));
    } finally {
      if (!cancelled) setLoading(false);
    }
    return () => { cancelled = true; };
  }, [boardId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <p>Loading reviews…</p>;
  if (error) return <p style={{ color: 'crimson' }}>Error: {error}</p>;

  if (!items.length) {
    return <p>No reviews yet. Be the first to leave a comment!</p>;
  }

  return (
    <ul style={{ listStyle: 'none', padding: 0, marginTop: 12 }}>
      {items.map((r) => {
        const created = r.createdAt ? new Date(r.createdAt) : null;
        const rating = typeof r.reviewRating === 'number' && r.reviewRating > 0 ? r.reviewRating : null;
        const author = r.belongsToUser && (r.belongsToUser.name || r.belongsToUser.email || r.belongsToUser._id || r.belongsToUser.id);
        return (
          <li key={r._id || r.id} style={{
            border: '1px solid #e5e7eb',
            borderRadius: 8,
            padding: 12,
            marginBottom: 12,
            background: '#fff'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <strong style={{ marginRight: 8 }}>Comment</strong>
              <span style={{ color: '#6b7280', fontSize: 12 }}>
                {created ? created.toLocaleString() : ''}
              </span>
            </div>
            {rating != null && (
              <div style={{ color: '#374151', marginTop: 4 }}>Rating: {rating} / 5</div>
            )}
            <p style={{ marginTop: 8, whiteSpace: 'pre-wrap' }}>{r.comment}</p>
            {author && (
              <div style={{ color: '#6b7280', fontSize: 12 }}>by {String(author)}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
