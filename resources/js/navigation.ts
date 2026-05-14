import { BookOpen, Gauge, PlusCircle } from 'lucide-react';
import { create as createSession } from '@/actions/App/Http/Controllers/PlanningSessionController';
import { dashboard } from '@/routes';
import type { NavItem } from '@/types';

export const mainNavItems: NavItem[] = [
    {
        title: 'Dashboard',
        href: dashboard(),
        icon: Gauge,
    },
    {
        title: 'Nieuwe sessie',
        href: createSession(),
        icon: PlusCircle,
    },
];

export const footerNavItems: NavItem[] = [
    {
        title: 'Laravel docs',
        href: 'https://laravel.com/docs',
        icon: BookOpen,
    },
    {
        title: 'Inertia docs',
        href: 'https://inertiajs.com',
        icon: BookOpen,
    },
];
