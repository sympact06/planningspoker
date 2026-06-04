<?php

namespace App\Support;

final class RoomPalette
{
    /**
     * Distinct, accessible avatar colours assigned to participants in order.
     *
     * @var list<string>
     */
    public const COLORS = [
        '#2f7bf6',
        '#16a34a',
        '#f59e0b',
        '#a855f7',
        '#ef4444',
        '#0ea5e9',
        '#ec4899',
        '#14b8a6',
        '#f97316',
        '#6366f1',
    ];

    /**
     * Pick the next colour for a participant joining at the given index,
     * cycling through the palette once exhausted.
     */
    public static function forIndex(int $index): string
    {
        return self::COLORS[$index % count(self::COLORS)];
    }
}
