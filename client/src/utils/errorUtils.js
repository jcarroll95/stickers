/**
 * Utility to parse Axios/API errors into human-readable strings.
 */
export const parseError = (error) => {
  if (typeof error === 'string') return error;

  // Server response error
  if (error.response) {
    const serverMsg = error.response.data?.error || error.response.data?.message;
    if (serverMsg) return serverMsg;

    switch (error.response.status) {
      case 400: return 'Invalid request. Please check your input.';
      case 401: return 'Your session has expired. Please log in again.';
      case 403: return 'You do not have permission to perform this action.';
      case 404: return 'The requested resource was not found.';
      case 500: return 'A server error occurred. Please try again later.';
      default: return `Error: ${error.response.statusText || 'Unknown server error'}`;
    }
  }

  // Network error (no response)
  if (error.request) {
    return 'Network error. Please check your internet connection.';
  }

  // Configuration or other error
  return error.message || 'An unexpected error occurred.';
};
