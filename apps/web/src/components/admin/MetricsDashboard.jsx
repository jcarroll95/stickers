import React, { useEffect, useState } from 'react';
import apiClient from '../../services/apiClient.jsx';
import LoadingSpinner from '../common/LoadingSpinner.jsx';

const MetricsDashboard = () => {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const calculateRollingMetrics = () => {
    if (!metrics || !metrics.recentRequests || metrics.recentRequests.length === 0) {
      return {
        totalRequests: 0,
        avgResponseTimeMs: 0,
        errorRatePercent: 0
      };
    }

    const recent = metrics.recentRequests;
    const count = recent.length;
    const totalTime = recent.reduce((sum, r) => sum + r.responseTimeMs, 0);
    const errorCount = recent.filter(r => r.status >= 400).length;

    return {
      totalRequests: count,
      avgResponseTimeMs: Math.round((totalTime / count) * 100) / 100,
      errorRatePercent: Math.round((errorCount / count) * 100 * 100) / 100
    };
  };

  const rollingMetrics = calculateRollingMetrics();

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
        <MetricCard 
          label="Recent Requests" 
          value={rollingMetrics.totalRequests} 
          secondary={`Lifetime: ${metrics.totalRequests}`}
        />
        <MetricCard 
          label="Recent Avg Latency" 
          value={`${rollingMetrics.avgResponseTimeMs}ms`} 
          secondary={`Lifetime: ${metrics.avgResponseTimeMs}ms`}
        />
        <MetricCard 
          label="Recent Error Rate" 
          value={`${rollingMetrics.errorRatePercent}%`} 
          secondary={`Lifetime: ${metrics.errorRatePercent}%`}
        />
      </div>

      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
        gap: '1rem',
        marginBottom: '2rem'
      }}>
        <MetricCard label="P50 Latency" value={`${metrics.latencyRecent.p50Ms}ms`} />
        <MetricCard label="P95 Latency" value={`${metrics.latencyRecent.p95Ms}ms`} />
        <MetricCard label="P99 Latency" value={`${metrics.latencyRecent.p99Ms}ms`} />
      </div>

      <section>
        <h2>Recent Requests (Last 100)</h2>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '1rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #ddd', textAlign: 'left' }}>
                <th style={{ padding: '8px' }}>Request ID</th>
                <th style={{ padding: '8px' }}>Method</th>
                <th style={{ padding: '8px' }}>URL</th>
                <th style={{ padding: '8px' }}>Status</th>
                <th style={{ padding: '8px' }}>Latency</th>
                <th style={{ padding: '8px' }}>IP</th>
                <th style={{ padding: '8px' }}>Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {[...metrics.recentRequests].reverse().map((req, index) => (
                <tr key={index} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '8px', fontSize: '0.8rem', color: '#666' }}>{req.requestId || 'N/A'}</td>
                  <td style={{ padding: '8px' }}>{req.method}</td>
                  <td style={{ padding: '8px', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
                  <td style={{ padding: '8px' }}>{req.responseTimeMs}ms</td>
                  <td style={{ padding: '8px', fontSize: '0.8rem' }}>{req.ip}</td>
                  <td style={{ padding: '8px' }}>{new Date(req.timestamp).toLocaleTimeString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

const MetricCard = ({ label, value, secondary }) => (
  <div style={{ 
    padding: '1.5rem', 
    backgroundColor: '#f8f9fa', 
    borderRadius: '8px', 
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    textAlign: 'center'
  }}>
    <div style={{ fontSize: '0.9rem', color: '#666', marginBottom: '0.5rem' }}>{label}</div>
    <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{value}</div>
    {secondary && (
      <div style={{ fontSize: '0.75rem', color: '#999', marginTop: '0.5rem' }}>
        {secondary}
      </div>
    )}
  </div>
);

export default MetricsDashboard;
