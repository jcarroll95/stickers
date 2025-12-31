import { useEffect, useState } from 'react';
import apiClient from './services/apiClient';

export default function StickerboardsDemo() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        let cancelled = false;

        async function load() {
            try {
                setLoading(true);
                const response = await apiClient.get('/stickerboards');
                
                if (!cancelled) {
                    // apiClient interceptor returns response.data
                    setData(response.data || response);
                }
            } catch (err) {
                if (!cancelled) {
                    const errorMsg = err.response?.data?.error || err.message || String(err);
                    setError(errorMsg);
                }
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