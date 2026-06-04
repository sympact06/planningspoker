import { router } from '@inertiajs/react';
import Clarity from '@microsoft/clarity';
import type { Auth } from '@/types/auth';

const projectId = import.meta.env.VITE_CLARITY_PROJECT_ID;
const enabled = typeof window !== 'undefined' && Boolean(projectId);

/**
 * Identifies the visitor and tags whether they are signed in, based on the
 * shared `auth.user` prop carried on every Inertia page.
 */
function syncVisitor(props: { auth?: Auth }): void {
    const user = props.auth?.user;

    Clarity.setTag('user_type', user ? 'authenticated' : 'guest');

    if (user) {
        Clarity.identify(String(user.id), undefined, undefined, user.name);
    }
}

/**
 * Boots Clarity and wires baseline segmentation tags, user identification, and
 * error-driven recording priority. Safe to call when no project ID is set.
 */
export function initClarity(): void {
    if (!enabled) {
        return;
    }

    Clarity.init(projectId);
    Clarity.setTag('environment', import.meta.env.MODE);

    window.addEventListener('error', () => Clarity.upgrade('js-error'));
    window.addEventListener('unhandledrejection', () =>
        Clarity.upgrade('unhandled-rejection'),
    );

    // Fires on the initial page load and on every subsequent Inertia visit.
    router.on('navigate', (event) => {
        syncVisitor(event.detail.page.props as { auth?: Auth });
    });
}

/** Records a custom event, available as a smart event / funnel step in Clarity. */
export function trackEvent(name: string): void {
    if (!enabled) {
        return;
    }

    Clarity.event(name);
}

/** Sets a segmentation tag used to filter recordings in the dashboard. */
export function setClarityTag(key: string, value: string | string[]): void {
    if (!enabled) {
        return;
    }

    Clarity.setTag(key, value);
}

/** Prioritizes the current session for guaranteed recording. */
export function prioritizeRecording(reason: string): void {
    if (!enabled) {
        return;
    }

    Clarity.upgrade(reason);
}
