/**
 * Email Types
 *
 * Defines the schema for emails received via deep links from external mail clients.
 * This is a generic format that any mail client add-in/extension can use.
 */

export type EmailSource = 'outlook' | 'thunderbird' | 'apple-mail' | 'other';

export interface EmailAddress {
  name?: string;
  email: string;
}

export interface IncomingEmail {
  // Required fields
  subject: string;
  from: EmailAddress;
  body: string; // Plain text preferred, HTML ok

  // Optional fields
  to?: EmailAddress[];
  cc?: EmailAddress[];
  date?: string; // ISO date string
  messageId?: string; // Unique identifier from mail client

  // Source tracking (for multi-client support)
  source: EmailSource;
}

/**
 * Email tab data stored in tab state (session only, not persisted)
 */
export interface EmailTabData {
  email: IncomingEmail;
  linkedProjectId?: string;
  linkedWorkspaceId?: string;
}

/**
 * Format an email address for display
 */
export function formatEmailAddress(addr: EmailAddress): string {
  if (addr.name) {
    return `${addr.name} <${addr.email}>`;
  }
  return addr.email;
}

/**
 * Format a date string for display
 */
export function formatEmailDate(dateStr?: string): string {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString(undefined, {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}
