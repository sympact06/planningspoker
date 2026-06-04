// Inline stroke icons (Lucide-style, original paths) for the 3D Planning Poker page.
import type { JSX, SVGProps } from 'react';

type IconName =
    | 'chevronDown'
    | 'chevronRight'
    | 'chevronLeft'
    | 'timer'
    | 'users'
    | 'invite'
    | 'panelRight'
    | 'panelLeft'
    | 'plus'
    | 'check'
    | 'copy'
    | 'mail'
    | 'link'
    | 'qr'
    | 'sparkle'
    | 'play'
    | 'pause'
    | 'rotate'
    | 'eye'
    | 'eyeOff'
    | 'edit'
    | 'trash'
    | 'dots'
    | 'settings'
    | 'coffee'
    | 'crown'
    | 'sun'
    | 'moon'
    | 'upload'
    | 'layers'
    | 'x'
    | 'camera'
    | 'cube';

type PokerIconProps = SVGProps<SVGSVGElement> & {
    name: IconName;
    size?: number;
};

const paths: Record<IconName, JSX.Element> = {
    chevronDown: <polyline points="6 9 12 15 18 9" />,
    chevronRight: <polyline points="9 6 15 12 9 18" />,
    chevronLeft: <polyline points="15 6 9 12 15 18" />,
    timer: (
        <>
            <circle cx="12" cy="13" r="8" />
            <path d="M12 9v4l2 2" />
            <path d="M9 2h6" />
            <path d="M12 2v3" />
        </>
    ),
    users: (
        <>
            <circle cx="9" cy="8" r="4" />
            <path d="M2 21c0-4 3-7 7-7s7 3 7 7" />
            <circle cx="17" cy="6" r="3" />
            <path d="M22 18c0-2.5-2-4.5-5-4.5" />
        </>
    ),
    invite: (
        <>
            <circle cx="9" cy="8" r="4" />
            <path d="M2 21c0-4 3-7 7-7s7 3 7 7" />
            <path d="M19 8v6" />
            <path d="M16 11h6" />
        </>
    ),
    panelRight: (
        <>
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <path d="M15 4v16" />
        </>
    ),
    panelLeft: (
        <>
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <path d="M9 4v16" />
        </>
    ),
    plus: (
        <>
            <path d="M12 5v14" />
            <path d="M5 12h14" />
        </>
    ),
    check: <polyline points="4 12 10 18 20 6" />,
    copy: (
        <>
            <rect x="9" y="9" width="11" height="11" rx="2" />
            <path d="M5 15V5a2 2 0 0 1 2-2h10" />
        </>
    ),
    mail: (
        <>
            <rect x="3" y="5" width="18" height="14" rx="2" />
            <path d="m3 7 9 6 9-6" />
        </>
    ),
    link: (
        <>
            <path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 1 0-5.66-5.66l-1 1" />
            <path d="M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 1 0 5.66 5.66l1-1" />
        </>
    ),
    qr: (
        <>
            <rect x="3" y="3" width="7" height="7" />
            <rect x="14" y="3" width="7" height="7" />
            <rect x="3" y="14" width="7" height="7" />
            <path d="M14 14h3v3h-3z" />
            <path d="M21 14h-1" />
            <path d="M21 21v-4" />
            <path d="M14 21h3" />
        </>
    ),
    sparkle: (
        <>
            <path d="M12 3l1.6 5L18 9.6 13.6 11 12 16l-1.6-5L6 9.6 10.4 8z" />
            <path d="M19 17l.8 2 2 .8-2 .8L19 23l-.8-2-2-.8 2-.8z" />
        </>
    ),
    play: <polygon points="6 4 20 12 6 20" />,
    pause: (
        <>
            <rect x="6" y="4" width="4" height="16" />
            <rect x="14" y="4" width="4" height="16" />
        </>
    ),
    rotate: (
        <>
            <path d="M3 12a9 9 0 1 0 3-6.7" />
            <polyline points="3 4 3 10 9 10" />
        </>
    ),
    eye: (
        <>
            <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
            <circle cx="12" cy="12" r="3" />
        </>
    ),
    eyeOff: (
        <>
            <path d="M3 3l18 18" />
            <path d="M10.6 6.1A10 10 0 0 1 12 6c6.5 0 10 6 10 6a13 13 0 0 1-3 3.7" />
            <path d="M6.3 6.6A13 13 0 0 0 2 12s3.5 6 10 6a10 10 0 0 0 4.6-1.1" />
            <path d="M9.5 9.5a3 3 0 0 0 4 4" />
        </>
    ),
    edit: (
        <>
            <path d="M4 20h4l10-10-4-4L4 16z" />
            <path d="M14 6l4 4" />
        </>
    ),
    trash: (
        <>
            <path d="M4 7h16" />
            <path d="M9 7V4h6v3" />
            <path d="M6 7v13a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V7" />
        </>
    ),
    dots: (
        <>
            <circle cx="6" cy="12" r="1.5" />
            <circle cx="12" cy="12" r="1.5" />
            <circle cx="18" cy="12" r="1.5" />
        </>
    ),
    settings: (
        <>
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
        </>
    ),
    coffee: (
        <>
            <path d="M4 8h14v6a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z" />
            <path d="M18 10h2a2 2 0 0 1 0 4h-2" />
            <path d="M7 3v2" />
            <path d="M11 3v2" />
            <path d="M15 3v2" />
        </>
    ),
    crown: (
        <>
            <path d="M3 7l4 4 5-6 5 6 4-4-2 12H5z" />
        </>
    ),
    sun: (
        <>
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2" />
            <path d="M12 20v2" />
            <path d="M4.9 4.9l1.4 1.4" />
            <path d="M17.7 17.7l1.4 1.4" />
            <path d="M2 12h2" />
            <path d="M20 12h2" />
            <path d="M4.9 19.1l1.4-1.4" />
            <path d="M17.7 6.3l1.4-1.4" />
        </>
    ),
    moon: <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />,
    upload: (
        <>
            <path d="M12 16V4" />
            <path d="m7 9 5-5 5 5" />
            <path d="M5 20h14" />
        </>
    ),
    layers: (
        <>
            <path d="m12 3 9 5-9 5-9-5 9-5z" />
            <path d="m3 13 9 5 9-5" />
        </>
    ),
    x: (
        <>
            <path d="M6 6l12 12" />
            <path d="M18 6 6 18" />
        </>
    ),
    camera: (
        <>
            <path d="M3 8a2 2 0 0 1 2-2h2l1.5-2h7L19 6h0a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <circle cx="12" cy="12.5" r="3.5" />
        </>
    ),
    cube: (
        <>
            <path d="M12 2 3 7v10l9 5 9-5V7z" />
            <path d="M3 7l9 5 9-5" />
            <path d="M12 12v10" />
        </>
    ),
};

export function Icon({ name, size = 18, ...rest }: PokerIconProps) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
            {...rest}
        >
            {paths[name]}
        </svg>
    );
}

export default Icon;
