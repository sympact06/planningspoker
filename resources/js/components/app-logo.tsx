import AppLogoIcon from '@/components/app-logo-icon';

export default function AppLogo() {
    return (
        <>
            <div className="flex aspect-square size-8 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground shadow-xs">
                <AppLogoIcon className="size-5 fill-current" />
            </div>
            <div className="ml-1 grid flex-1 text-left text-sm">
                <span className="mb-0.5 truncate leading-tight font-semibold">
                    PlanPoker
                </span>
                <span className="truncate text-xs leading-tight text-sidebar-foreground/60">
                    Scrum estimation
                </span>
            </div>
        </>
    );
}
