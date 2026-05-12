import type { SVGProps } from 'react';

type IconName =
    | 'chevronDown'
    | 'chevronRight'
    | 'chevronLeft'
    | 'timer'
    | 'users'
    | 'invite'
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
    | 'edit'
    | 'trash'
    | 'dots'
    | 'crown';

const PATHS: Record<IconName, React.ReactNode> = {
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
    crown: <path d="M3 7l4 4 5-6 5 6 4-4-2 12H5z" />,
};

interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'name'> {
    name: IconName;
    size?: number;
}

export function Icon({ name, size = 18, ...rest }: IconProps) {
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
            {PATHS[name]}
        </svg>
    );
}

export type { IconName };
