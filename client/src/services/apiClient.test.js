import { describe, it, expect, beforeEach, vi } from 'vitest';
import apiClient from './apiClient';
import { server } from '../test/setup';
import { http, HttpResponse } from 'msw';

describe('apiClient', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('should have the correct baseURL', () => {
    expect(apiClient.defaults.baseURL).toBe('/api/v1');
  });

  it('should unwrap data from response envelope', async () => {
    server.use(
      http.get('*/test-envelope', () => {
        return HttpResponse.json({ success: true, data: { foo: 'bar' } });
      })
    );

    const body = await apiClient.get('/test-envelope');
    // Interceptor returns response.data (the whole body)
    expect(body.data.foo).toBe('bar');
  });

  it('should broadcast event on 401', async () => {
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
    
    server.use(
      http.get('*/test-401', () => {
        return new HttpResponse(null, { status: 401 });
      })
    );

    try {
      await apiClient.get('/test-401');
    } catch (err) {
      expect(err.response.status).toBe(401);
    }

    expect(dispatchSpy).toHaveBeenCalled();
    const event = dispatchSpy.mock.calls[0][0];
    expect(event.type).toBe('auth:unauthorized');
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
