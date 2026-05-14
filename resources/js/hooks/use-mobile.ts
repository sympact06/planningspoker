import * as React from 'react';

const MOBILE_BREAKPOINT = 768;

export function useIsMobile() {
    const query = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`;
    const [isMobile, setIsMobile] = React.useState<boolean>(() =>
        typeof window === 'undefined'
            ? false
            : window.matchMedia(query).matches,
    );

    React.useEffect(() => {
        const mediaQuery = window.matchMedia(query);
        const handleChange = (event: MediaQueryListEvent): void => {
            setIsMobile(event.matches);
        };

        mediaQuery.addEventListener('change', handleChange);

        return () => mediaQuery.removeEventListener('change', handleChange);
    }, [query]);

    return isMobile;
}
