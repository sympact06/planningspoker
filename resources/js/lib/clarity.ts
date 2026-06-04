import Clarity from '@microsoft/clarity';

const projectId = import.meta.env.VITE_CLARITY_PROJECT_ID;
const enabled = typeof window !== 'undefined' && Boolean(projectId);

/**
 * Boots Clarity and wires baseline segmentation tags plus error-driven
 * recording priority. Safe to call when no project ID is configured.
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
}

/** Ties the current Clarity session to an application user. */
export function identifyUser(id: string | number, friendlyName?: string): void {
    if (!enabled) {
        return;
    }

    Clarity.identify(String(id), undefined, undefined, friendlyName);
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
