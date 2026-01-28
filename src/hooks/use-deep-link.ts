/**
 * Deep Link Hook
 *
 * Initializes deep link listening for Tauri and handles incoming orbit:// URLs.
 * Currently supports email deep links: orbit://email?data={base64}
 */

import { useEffect, useRef } from 'react';
import { isTauri } from '@/lib/orbit/tauri-fs';
import { parseEmailDeepLink, type IncomingEmail } from '@/lib/email';
import { useTabStore } from '@/stores/tabs';

export function useDeepLink() {
  const hasInitialized = useRef(false);

  useEffect(() => {
    if (!isTauri() || hasInitialized.current) return;
    hasInitialized.current = true;

    async function initDeepLink() {
      try {
        const { onOpenUrl, getCurrent } = await import('@tauri-apps/plugin-deep-link');

        // Check if app was opened via deep link
        const initialUrls = await getCurrent();
        if (initialUrls && initialUrls.length > 0) {
          handleDeepLinks(initialUrls);
        }

        // Listen for deep links while app is running
        await onOpenUrl((urls) => {
          handleDeepLinks(urls);
        });

        console.log('[deep-link] Deep link listener initialized');
      } catch (error) {
        console.error('[deep-link] Failed to initialize:', error);
      }
    }

    initDeepLink();
  }, []);
}

function handleDeepLinks(urls: string[]) {
  for (const url of urls) {
    // Skip empty strings (can happen on macOS in dev mode)
    if (!url) continue;

    console.log('[deep-link] Received:', url);

    // Try parsing as email deep link
    const emailData = parseEmailDeepLink(url);
    if (emailData) {
      openEmailTab(emailData.email);
      continue;
    }

    console.warn('[deep-link] Unknown deep link format:', url);
  }
}

function openEmailTab(email: IncomingEmail) {
  const { openTab } = useTabStore.getState();

  openTab({
    type: 'email',
    title: email.subject || 'Email',
    emailData: email,
  });

  console.log('[deep-link] Opened email tab:', email.subject);
}
