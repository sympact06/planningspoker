import type { LucideIcon } from 'lucide-react';
import { Monitor, Moon, Sun } from 'lucide-react';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import type { Appearance } from '@/hooks/use-appearance';
import { useAppearance } from '@/hooks/use-appearance';

type AppearanceToggleTabProps = {
    className?: string;
};

export default function AppearanceToggleTab({
    className = '',
}: AppearanceToggleTabProps) {
    const { appearance, updateAppearance } = useAppearance();

    const tabs: { value: Appearance; icon: LucideIcon; label: string }[] = [
        { value: 'light', icon: Sun, label: 'Light' },
        { value: 'dark', icon: Moon, label: 'Dark' },
        { value: 'system', icon: Monitor, label: 'System' },
    ];

    return (
        <ToggleGroup
            type="single"
            value={appearance}
            onValueChange={(value) => {
                if (value) {
                    updateAppearance(value as Appearance);
                }
            }}
            variant="outline"
            className={className}
        >
            {tabs.map(({ value, icon: Icon, label }) => (
                <ToggleGroupItem
                    key={value}
                    value={value}
                    aria-label={`${label} appearance`}
                    className="px-3"
                >
                    <Icon className="size-4" />
                    <span>{label}</span>
                </ToggleGroupItem>
            ))}
        </ToggleGroup>
    );
}
