import { describe, it, expect, beforeEach, vi } from 'vitest';
import apiClient from './apiClient.jsx';
import { server } from '../test/setup.js';
import { http, HttpResponse } from 'msw';

describe('apiClient', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('should have the correct baseURL', () => {
    expect(apiClient.defaults.baseURL).toBe('/api/v1');
  });

  it('should unwrap seed-data from response envelope', async () => {
    server.use(
      http.get('*/test-envelope', () => {
        return HttpResponse.json({ success: true, data: { foo: 'bar' } });
      })
    );

    const body = await apiClient.get('/test-envelope');
    // Interceptor returns response.seed-data (the whole body)
    expect(body.data.foo).toBe('bar');
  });

  it('should broadcast event on 401 when refresh fails', async () => {
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

    // Mock the initial 401 response
    server.use(
      http.get('*/test-401', () => {
        return new HttpResponse(null, { status: 401 });
      }),
      // Mock the refresh call to fail as well
      http.post('*/auth/refresh', () => {
        return new HttpResponse(null, { status: 401 });
      })
    );

    try {
      await apiClient.get('/test-401');
    } catch (err) {
      // The error thrown is from the failed refresh call
      expect(err.response.status).toBe(401);
    }

    expect(dispatchSpy).toHaveBeenCalled();
    const event = dispatchSpy.mock.calls.find(call => call[0].type === 'auth:unauthorized')[0];
    expect(event.type).toBe('auth:unauthorized');
  });

  it('should retry request when refresh succeeds', async () => {
    let callCount = 0;
    server.use(
      http.get('*/test-retry', () => {
        callCount++;
        if (callCount === 1) {
          return new HttpResponse(null, { status: 401 });
        }
        return HttpResponse.json({ success: true, data: 'retried' });
      }),
      http.post('*/auth/refresh', () => {
        return HttpResponse.json({ success: true });
      })
    );

    const result = await apiClient.get('/test-retry');
    expect(result.data).toBe('retried');
    expect(callCount).toBe(2);
  });

  it('should log network errors', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    server.use(
      http.get('*/test-network-error', () => {
        return HttpResponse.error();
      })
    );

    try {
      await apiClient.get('/test-network-error');
    } catch (err) {
      expect(err).toBeDefined();
    }

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('[API Network Error]'));
    consoleSpy.mockRestore();
  });
});
