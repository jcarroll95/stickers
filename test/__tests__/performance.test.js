const request = require('supertest');
const express = require('express');
const { performanceMiddleware, getMetrics } = require('../../middleware/performance');

describe('Performance Middleware', () => {
    let app;

    beforeEach(() => {
        app = express();
        app.use(performanceMiddleware);
        app.get('/api/test', (req, res) => res.status(200).send('OK'));
        app.get('/api/error', (req, res) => res.status(500).send('Error'));
    });

    it('should track requests and response times', async () => {
        await request(app).get('/api/test');
        
        const metrics = getMetrics();
        expect(metrics.totalRequests).toBeGreaterThan(0);
        expect(metrics.statusCodes['200']).toBe(1);
        expect(metrics.recentRequests.length).toBe(1);
        expect(metrics.recentRequests[0].url).toBe('/api/test');
    });

    it('should track error rates', async () => {
        // Reset or account for previous requests if needed, 
        // but here we just check if it adds up.
        // The middleware state persists between tests in this file.
        const initialMetrics = getMetrics();
        const initialRequests = initialMetrics.totalRequests;

        await request(app).get('/api/error');
        
        const metrics = getMetrics();
        expect(metrics.totalRequests).toBe(initialRequests + 1);
        expect(metrics.statusCodes['500']).toBe(1);
    });
});
