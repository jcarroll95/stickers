import React, { useEffect, useState } from 'react';
import apiClient from '../../services/apiClient';
import LoadingSpinner from '../common/LoadingSpinner.jsx';

const MetricsDashboard = () => {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchMetrics = async () => {
    try {
      const response = await apiClient.get('/admin/metrics');
      setMetrics(response.data || response);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch metrics:', err);
      setError('Failed to load performance metrics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
    // Refresh every 30 seconds
    const interval = setInterval(fetchMetrics, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading && !metrics) {
    return <LoadingSpinner message="Loading performance metrics..." />;
  }

  if (error) {
    return <div style={{ color: 'red', padding: '1rem' }}>{error}</div>;
  }

  return (
    <div style={{ padding: '2rem' }}>
      <h1>System Performance Metrics</h1>
      
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
        gap: '1rem',
        marginBottom: '2rem'
      }}>
        <MetricCard label="Total Requests" value={metrics.totalRequests} />
        <MetricCard label="Avg Response Time" value={metrics.avgResponseTime} />
        <MetricCard label="Error Rate" value={metrics.errorRate} />
      </div>

      <section>
        <h2>Recent Requests (Last 100)</h2>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '1rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #ddd', textAlign: 'left' }}>
                <th style={{ padding: '8px' }}>Method</th>
                <th style={{ padding: '8px' }}>URL</th>
                <th style={{ padding: '8px' }}>Status</th>
                <th style={{ padding: '8px' }}>Response Time</th>
                <th style={{ padding: '8px' }}>Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {metrics.recentRequests.map((req, index) => (
                <tr key={index} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '8px' }}>{req.method}</td>
                  <td style={{ padding: '8px', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {req.url}
                  </td>
                  <td style={{ padding: '8px' }}>
                    <span style={{ 
                      color: req.status >= 400 ? 'red' : 'green',
                      fontWeight: 'bold'
                    }}>
                      {req.status}
                    </span>
                  </td>
                  <td style={{ padding: '8px' }}>{req.responseTime}ms</td>
                  <td style={{ padding: '8px' }}>{new Date(req.timestamp).toLocaleTimeString()}</td>
                </tr>
              )).reverse()}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

const MetricCard = ({ label, value }) => (
  <div style={{ 
    padding: '1.5rem', 
    backgroundColor: '#f8f9fa', 
    borderRadius: '8px', 
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    textAlign: 'center'
  }}>
    <div style={{ fontSize: '0.9rem', color: '#666', marginBottom: '0.5rem' }}>{label}</div>
    <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{value}</div>
  </div>
);

export default MetricsDashboard;
