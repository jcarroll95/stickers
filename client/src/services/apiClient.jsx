import axios from 'axios';
import { toast } from 'react-hot-toast';
import { parseError } from '../utils/errorUtils';

/**
 * API Client Configuration
 * 
 * This module provides a centralized Axios instance configured with
 * interceptors to handle authentication and global error management.
 * 
 * Benefits:
 * 1. DRY: No need to repeat headers or base URLs in every component.
 * 2. Maintainability: Centralized logic for token injection and error logging.
 * 3. Security: Consistent handling of credentials and sensitive data.
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

// Response Interceptor: Global Error Handling
apiClient.interceptors.response.use(
  (response) => {
    // Any status code within the range of 2xx triggers this function
    return response.data; // Return only the data payload for cleaner component consumption
  },
  (error) => {
    /**
     * Centralized Error Handling Logic
     * 
     * Here we can handle specific HTTP status codes globally:
     * - 401 (Unauthorized): Redirect to login or refresh token
     * - 403 (Forbidden): Display "Access Denied" notification
     * - 500+ (Server Errors): Log to monitoring service (e.g., Sentry)
     */
    const { response } = error;

    if (response) {
      // The server responded with a status code out of the 2xx range
      console.error(`[API Response Error ${response.status}]:`, response.data);

      if (response.status === 401) {
        // Handle unauthorized access (e.g., clear session and redirect)
        // No longer removing 'token' from localStorage
        
        // Broadcast a generic logout event if store is not available
        window.dispatchEvent(new CustomEvent('auth:unauthorized'));
        
        // Notify the user
        toast.error((t) => (
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
                fontWeight: 'bold'
              }}
              aria-label="Close"
            >
              ×
            </button>
          </span>
        ), {
            id: 'auth-unauthorized', // Prevent duplicate toasts
            duration: 5000,
            icon: null,
        });
      } else if (response.status >= 500) {
        toast.error('A server error occurred. Please try again later.');
      }
    } else if (error.request) {
      // The request was made but no response was received
      console.error('[API Network Error]: No response from server');
      toast.error('Network error. Please check your internet connection.');
    } else {
      // Something happened in setting up the request that triggered an Error
      console.error('[API Configuration Error]:', error.message);
    }

    // Pass the error along so components can still handle specific cases if needed
    return Promise.reject(error);
  }
);

export default apiClient;
