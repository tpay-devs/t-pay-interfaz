/**
 * Client Session Management
 * 
 * Generates and manages a unique client session ID that persists across page refreshes
 * but is unique per browser/device. This ID is used to tag orders and filter payment
 * confirmations to ensure users only see their own order confirmations.
 */

const CLIENT_SESSION_STORAGE_KEY = 'tpay_client_session_id';

/**
 * Generates a UUID v4 compatible string
 */
function generateUUID(): string {
  // Use crypto.randomUUID if available (modern browsers)
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  // Fallback for older browsers
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Gets or creates a client session ID
 * The ID persists in localStorage across page refreshes but is unique per browser/device
 * 
 * IMPORTANT: Also checks URL params for session ID (from MercadoPago return redirect)
 * to handle iOS Safari which resets localStorage after external redirects.
 * 
 * @returns The client session ID
 */
export function getClientSessionId(): string {
  if (typeof window !== 'undefined') {
    // 1. First, check if there's a session ID in the URL (from MercadoPago return)
    const urlParams = new URLSearchParams(window.location.search);
    const urlSessionId = urlParams.get('sid');

    if (urlSessionId) {
      // Restore the session ID to localStorage
      localStorage.setItem(CLIENT_SESSION_STORAGE_KEY, urlSessionId);
      return urlSessionId;
    }

    // 2. Check localStorage for existing session
    const stored = localStorage.getItem(CLIENT_SESSION_STORAGE_KEY);
    if (stored) {
      return stored;
    }

    // 3. Generate new session ID and store it
    const newSessionId = generateUUID();
    localStorage.setItem(CLIENT_SESSION_STORAGE_KEY, newSessionId);
    return newSessionId;
  }

  // Fallback for SSR environments (shouldn't happen in this app)
  return generateUUID();
}

/**
 * Clears the client session ID (useful for testing or logout scenarios)
 */
export function clearClientSessionId(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(CLIENT_SESSION_STORAGE_KEY);
  }
}
