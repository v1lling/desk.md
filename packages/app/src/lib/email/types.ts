/**
 * Email Types
 *
 * Defines the schema for emails received via deep links from external mail clients.
 * This is a generic format that any mail client add-in/extension can use.
 */

import { formatLocaleDate } from "@/lib/i18n/format";

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
  return formatLocaleDate(dateStr, {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Render an incoming email as a plain-text block (headers + body) suitable for pasting
 * into the `draft-email-reply` MCP prompt's `email_text` argument.
 */
export function buildEmailPlainText(email: IncomingEmail): string {
  const lines: string[] = [];
  if (email.subject) lines.push(`Subject: ${email.subject}`);
  lines.push(`From: ${formatEmailAddress(email.from)}`);
  if (email.to?.length) lines.push(`To: ${email.to.map(formatEmailAddress).join(', ')}`);
  if (email.cc?.length) lines.push(`Cc: ${email.cc.map(formatEmailAddress).join(', ')}`);
  if (email.date) lines.push(`Date: ${formatEmailDate(email.date)}`);
  lines.push('', email.body ?? '');
  return lines.join('\n');
}
