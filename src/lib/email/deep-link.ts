/**
 * Deep Link Handler for Email Integration
 *
 * Parses orbit:// deep links and extracts email data.
 * Protocol: orbit://email?data={base64_encoded_json}
 */

import type { IncomingEmail, EmailTabData } from './types';

/**
 * Parse an orbit:// deep link URL
 * Returns the email data if valid, null otherwise
 */
export function parseEmailDeepLink(url: string): EmailTabData | null {
  try {
    const parsed = new URL(url);

    // Check scheme
    if (parsed.protocol !== 'orbit:') {
      console.warn('[deep-link] Invalid protocol:', parsed.protocol);
      return null;
    }

    // Check path (host in custom protocols)
    // URL parsing treats "orbit://email" as protocol=orbit:, host=email
    if (parsed.host !== 'email' && parsed.pathname !== '//email') {
      console.warn('[deep-link] Unknown deep link type:', parsed.host || parsed.pathname);
      return null;
    }

    // Get base64 data
    const data = parsed.searchParams.get('data');
    if (!data) {
      console.warn('[deep-link] Missing data parameter');
      return null;
    }

    // Decode base64 and parse JSON
    const decoded = atob(data);
    const email = JSON.parse(decoded) as IncomingEmail;

    // Validate required fields
    if (!email.subject || !email.from?.email || !email.body) {
      console.warn('[deep-link] Missing required email fields');
      return null;
    }

    // Ensure source is set
    if (!email.source) {
      email.source = 'other';
    }

    return { email };
  } catch (error) {
    console.error('[deep-link] Failed to parse deep link:', error);
    return null;
  }
}

/**
 * Create an orbit:// deep link URL from email data
 * Useful for testing and documentation
 */
export function createEmailDeepLink(email: IncomingEmail): string {
  const json = JSON.stringify(email);
  const base64 = btoa(json);
  return `orbit://email?data=${base64}`;
}

/**
 * Check if a URL is an orbit:// email deep link
 */
export function isEmailDeepLink(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'orbit:' &&
           (parsed.host === 'email' || parsed.pathname === '//email');
  } catch {
    return false;
  }
}
