import React, { useEffect, useState } from 'react';

// Displays a specific stickerboard given a token (id or slug).
// Fetch strategy:
// 1) Try GET /api/v1/stickerboards/:token (works for MongoDB ObjectId)
// 2) If 404, try GET /api/v1/stickerboards?slug=:token&limit=1 (slug lookup)
export default function BoardView({ token }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [board, setBoard] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError('');
      setBoard(null);

      const tokenStr = localStorage.getItem('token');
      const authHeader = tokenStr ? { Authorization: `Bearer ${tokenStr}` } : {};

      try {
        // First attempt: treat token as an id
        const res = await fetch(`/api/v1/stickerboards/${encodeURIComponent(token)}`, {
          headers: { 'Accept': 'application/json', ...authHeader },
          credentials: 'include'
        });

        if (res.ok) {
          const json = await res.json();
          if (!cancelled) setBoard(json?.data || null);
        } else if (res.status === 404) {
          // Fallback: try slug query
          const q = await fetch(`/api/v1/stickerboards?slug=${encodeURIComponent(token)}&limit=1`, {
            headers: { 'Accept': 'application/json', ...authHeader },
            credentials: 'include'
          });

          if (!q.ok) {
            const text = await q.text();
            throw new Error(`HTTP ${q.status}: ${text}`);
          }

          const list = await q.json();
          const first = list?.data?.[0] || null;
          if (!cancelled) setBoard(first);
        } else {
          const text = await res.text();
          throw new Error(`HTTP ${res.status}: ${text}`);
        }
      } catch (err) {
        if (!cancelled) setError(err.message || String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [token]);

  if (loading) return <p style={{ padding: '1rem' }}>Loading board…</p>;
  if (error) return <p style={{ color: 'crimson', padding: '1rem' }}>Error: {error}</p>;
  if (!board) return <p style={{ padding: '1rem' }}>No board found.</p>;

  // Placeholder UI: pretty-print JSON. Replace with your real board UI.
  return (
    <div style={{ padding: '1rem' }}>
      <h2>{board.name || 'Board'}</h2>
      <pre style={{ textAlign: 'left', background: '#111', color: '#0f0', padding: '1rem', borderRadius: 8 }}>
        {JSON.stringify(board, null, 2)}
      </pre>
    </div>
  );
}
