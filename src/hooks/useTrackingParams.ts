import { useEffect } from 'react';

const PARAM_KEYS = ['ref', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'] as const;
const STORAGE_PREFIX = 'tg_';
const COOKIE_MAX_AGE = 30 * 24 * 60 * 60; // 30 days in seconds

function setCookie(name: string, value: string) {
  document.cookie = `${name}=${encodeURIComponent(value)};path=/;max-age=${COOKIE_MAX_AGE};SameSite=Lax`;
}

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export function getTrackingParam(key: string): string | null {
  const storageKey = `${STORAGE_PREFIX}${key}`;
  return localStorage.getItem(storageKey) || getCookie(storageKey);
}

export function clearTrackingParams() {
  for (const key of PARAM_KEYS) {
    const storageKey = `${STORAGE_PREFIX}${key}`;
    localStorage.removeItem(storageKey);
    document.cookie = `${storageKey}=;path=/;max-age=0`;
  }
}

export function useTrackingParams() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    for (const key of PARAM_KEYS) {
      const value = params.get(key);
      if (value) {
        const storageKey = `${STORAGE_PREFIX}${key}`;
        localStorage.setItem(storageKey, value);
        setCookie(storageKey, value);
      }
    }
  }, []);
}
