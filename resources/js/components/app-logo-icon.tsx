import type { SVGAttributes } from 'react';

export default function AppLogoIcon(props: SVGAttributes<SVGElement>) {
    return (
        <svg {...props} viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
            <path
                d="M14.2 3.8h17.4c2.1 0 3.8 1.7 3.8 3.8v22.8c0 2.1-1.7 3.8-3.8 3.8H14.2c-2.1 0-3.8-1.7-3.8-3.8V7.6c0-2.1 1.7-3.8 3.8-3.8Z"
                opacity="0.32"
            />
            <path
                d="M8.4 7.8h17.4c2.1 0 3.8 1.7 3.8 3.8v22.8c0 2.1-1.7 3.8-3.8 3.8H8.4c-2.1 0-3.8-1.7-3.8-3.8V11.6c0-2.1 1.7-3.8 3.8-3.8Z"
                opacity="0.72"
            />
            <path
                d="M12.2 15.7h9.4a1.6 1.6 0 0 1 0 3.2h-9.4a1.6 1.6 0 1 1 0-3.2Zm0 6.2h5.6a1.6 1.6 0 1 1 0 3.2h-5.6a1.6 1.6 0 1 1 0-3.2Z"
                className="fill-sidebar-primary-foreground"
            />
        </svg>
    );
}
