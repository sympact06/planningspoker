import { usePage } from '@inertiajs/react';
import { useEffect } from 'react';
import { identifyUser, setClarityTag } from '@/lib/clarity';

/**
 * Ties the authenticated user to their Clarity session and tags whether the
 * visitor is signed in. Renders nothing; re-runs whenever the user changes.
 */
export default function ClarityIdentify() {
    const user = usePage().props.auth?.user;

    useEffect(() => {
        setClarityTag('user_type', user ? 'authenticated' : 'guest');

        if (user) {
            identifyUser(user.id, user.name);
        }
    }, [user]);

    return null;
}
