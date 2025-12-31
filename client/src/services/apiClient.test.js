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

  it('should inject token from localStorage into headers', async () => {
    localStorage.setItem('token', 'test-token');
    
    server.use(
      http.get('*/test-headers', ({ request }) => {
        if (request.headers.get('Authorization') === 'Bearer test-token') {
          return HttpResponse.json({ success: true });
        }
        return new HttpResponse(null, { status: 401 });
      })
    );

    const response = await apiClient.get('/test-headers');
    expect(response.success).toBe(true);
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

  it('should clear token and broadcast event on 401', async () => {
    localStorage.setItem('token', 'expired-token');
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

    expect(localStorage.getItem('token')).toBe(null);
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
      // Expected
    }

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('[API Network Error]'));
    consoleSpy.mockRestore();
  });
});
