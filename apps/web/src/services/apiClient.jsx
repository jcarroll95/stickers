import axios from 'axios';
import { toast } from 'react-hot-toast';
import { parseError } from '../utils/errorUtils.js';

/**
 * API Client Configuration
 *
 * This module provides a centralized Axios instance configured with
 * interceptors to handle authentication and global error management.
 *
 * Benefits:
 * 1. DRY: No need to repeat headers or base URLs in every component.
 * 2. Maintainability: Centralized logic for token injection and error logging.
 * 3. Security: Consistent handling of credentials and sensitive seed-data.
 * 4. UX: Global hooks for error notifications can be easily integrated here.
 */

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api/v1',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor: Global configuration
apiClient.interceptors.request.use(
  (config) => {
    // No longer injecting token from localStorage to move towards HttpOnly cookies.
    // withCredentials: true ensures cookies are sent automatically.
    return config;
  },
  (error) => {
    // Handle request errors (e.g., network failure before request is sent)
    console.error('[API Request Error]:', error);
    return Promise.reject(error);
  }
);



let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Response Interceptor: Global Error Handling and Token Refresh
apiClient.interceptors.response.use(
  (response) => {
    // Any status code within the range of 2xx triggers this function
    return response.data; // Return only the data payload for cleaner component consumption
  },
  async (error) => {
    const { response, config } = error;

    if (response) {
      // Handle 401 Unauthorized errors with Refresh Token logic
      if (response.status === 401 && !config._retry) {
        // If the URL is already the refresh or login endpoint, don't try to refresh
        if (config.url.includes('/auth/refresh') || config.url.includes('/auth/login')) {
          return Promise.reject(error);
        }

        if (isRefreshing) {
          return new Promise((resolve, reject) => {
            failedQueue.push({ resolve, reject });
          })
            .then(() => {
              return apiClient(config);
            })
            .catch((err) => {
              return Promise.reject(err);
            });
        }

        config._retry = true;
        isRefreshing = true;

        try {
          // Attempt to refresh the token using HttpOnly cookies
          // We use the base axios instance to avoid our own interceptors
          await axios.post(
            (import.meta.env.VITE_API_URL || '/api/v1') + '/auth/refresh',
            {},
            { withCredentials: true }
          );

          isRefreshing = false;
          processQueue(null);
          return apiClient(config); // Retry the original request
        } catch (refreshError) {
          isRefreshing = false;
          processQueue(refreshError, null);

          // Refresh truly failed: Session is dead
          window.dispatchEvent(new CustomEvent('auth:unauthorized'));

          // Notify the user
          toast.error(
            (t) => (
              <span style={{ display: 'flex', alignItems: 'center' }}>
                Session expired. Please login again.
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    toast.dismiss(t.id);
                  }}
                  style={{
                    marginLeft: '10px',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '16px',
                    lineHeight: '1',
                    padding: '0 4px',
                    color: '#ff4b4b',
                    fontWeight: 'bold',
                  }}
                  aria-label="Close"
                >
                  ×
                </button>
              </span>
            ),
            {
              id: 'auth-unauthorized',
              duration: 5000,
              icon: null,
            }
          );

          return Promise.reject(refreshError);
        }
      }

      if (response.status >= 500) {
        toast.error('A server error occurred. Please try again later.');
      }
    } else if (error.request) {
      console.error('[API Network Error]: No response from server');
      toast.error('Network error. Please check your internet connection.');
    }

    return Promise.reject(error);
  }
);

export default apiClient;
