import { useEffect, useState } from 'react';
import apiClient from './services/apiClient.jsx';
import LoadingSpinner from './components/common/LoadingSpinner.jsx';
import { parseError } from './utils/errorUtils.js';

export default function StickerboardsDemo() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    async function load() {
        try {
            setLoading(true);
            const response = await apiClient.get('/stickerboards');
            
            setData(response.data || response);
        } catch (err) {
            setError(parseError(err));
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        load();
    }, []);

    if (loading) return <LoadingSpinner message="Loading demo data…" />;
    if (error) return (
        <div style={{ color: 'crimson', padding: '1rem' }}>
            <p>Error: {error}</p>
            <button onClick={load} style={{ 
                marginTop: '0.5rem', 
                padding: '4px 12px', 
                cursor: 'pointer',
                border: '1px solid #dc2626',
                color: '#dc2626',
                backgroundColor: 'transparent',
                borderRadius: '4px'
            }}>Retry</button>
        </div>
    );

    return (
        <pre style={{ textAlign: 'left', background: '#111', color: '#0f0', padding: '1rem', borderRadius: 8 }}>
      {JSON.stringify(data, null, 2)}
    </pre>
    );
}