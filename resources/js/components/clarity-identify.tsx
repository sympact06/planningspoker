import { usePage } from '@inertiajs/react';
import Clarity from '@microsoft/clarity';
import { useEffect } from 'react';

/**
 * Ties the authenticated user to their Clarity session via `Clarity.identify`.
 * Renders nothing; re-identifies whenever the logged-in user changes.
 */
export default function ClarityIdentify() {
    const user = usePage().props.auth?.user;

    useEffect(() => {
        if (!import.meta.env.VITE_CLARITY_PROJECT_ID || !user) {
            return;
        }

        Clarity.identify(String(user.id), undefined, undefined, user.name);
    }, [user]);

    return null;
}
