import { useEffect, useState } from 'react';

export default function StickerboardsDemo() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    // adding konva canvas for board


    useEffect(() => {
        let cancelled = false;

        async function load() {
            try {
                setLoading(true);
                const res = await fetch('/api/v1/stickerboards', {
                    headers: { 'Accept': 'application/json' },
                    // to use cookies/sessions, uncomment this:
                    // credentials: 'include'
                    // headers: { Authorization: `Bearer ${token}` }
                });

                if (!res.ok) {
                    const text = await res.text();
                    throw new Error(`HTTP ${res.status}: ${text}`);
                }

                const json = await res.json();
                if (!cancelled) setData(json);
            } catch (err) {
                if (!cancelled) setError(err.message || String(err));
            } finally {
                if (!cancelled) setLoading(false);
            }
        }


        load();
        return () => { cancelled = true; };
    }, []);

    if (loading) return <p>Loading…</p>;
    if (error) return <p style={{ color: 'crimson' }}>Error: {error}</p>;

    return (
        <pre style={{ textAlign: 'left', background: '#111', color: '#0f0', padding: '1rem', borderRadius: 8 }}>
      {JSON.stringify(data, null, 2)}
    </pre>
    );
}