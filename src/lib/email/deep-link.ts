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
  console.log('[deep-link] Parsing URL, length:', url.length);

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

    console.log('[deep-link] Base64 data length:', data.length);

    // Decode base64 and parse JSON
    // Fix: URL-encoded + becomes space, convert back for base64 decoding
    // Also handle base64url variant (- and _ instead of + and /)
    const fixedData = data.replace(/ /g, '+').replace(/-/g, '+').replace(/_/g, '/');

    // Must use decodeURIComponent(escape(...)) to properly handle Unicode
    // (matches the encoding: btoa(unescape(encodeURIComponent(json))))
    let decoded: string;
    try {
      decoded = decodeURIComponent(escape(atob(fixedData)));
    } catch (decodeError) {
      console.error('[deep-link] Base64/Unicode decode failed:', decodeError);
      console.log('[deep-link] Data preview (first 100 chars):', data.substring(0, 100));
      return null;
    }

    console.log('[deep-link] Decoded JSON length:', decoded.length);

    let email: IncomingEmail;
    try {
      email = JSON.parse(decoded) as IncomingEmail;
    } catch (jsonError) {
      console.error('[deep-link] JSON parse failed:', jsonError);
      console.log('[deep-link] Decoded preview (first 200 chars):', decoded.substring(0, 200));
      return null;
    }

    // Validate required fields
    if (!email.subject || !email.from?.email || !email.body) {
      console.warn('[deep-link] Missing required email fields:', {
        hasSubject: !!email.subject,
        hasFromEmail: !!email.from?.email,
        hasBody: !!email.body,
      });
      return null;
    }

    // Ensure source is set
    if (!email.source) {
      email.source = 'other';
    }

    console.log('[deep-link] Successfully parsed email:', {
      subject: email.subject,
      from: email.from.email,
      bodyLength: email.body.length,
      source: email.source,
    });

    return { email };
  } catch (error) {
    console.error('[deep-link] Unexpected error parsing deep link:', error);
    return null;
  }
}

/**
 * Create an orbit:// deep link URL from email data
 * Useful for testing and documentation
 */
export function createEmailDeepLink(email: IncomingEmail): string {
  const json = JSON.stringify(email);
  // Use unescape(encodeURIComponent(...)) to properly encode Unicode to base64
  const base64 = btoa(unescape(encodeURIComponent(json)));
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
