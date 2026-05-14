<?php

namespace App\Enums;

enum VoteValue: string
{
    case Zero = '0';
    case One = '1';
    case Two = '2';
    case Three = '3';
    case Five = '5';
    case Eight = '8';
    case Thirteen = '13';
    case TwentyOne = '21';
    case Unknown = '?';
    case Coffee = 'coffee';

    /**
     * @return list<string>
     */
    public static function values(): array
    {
        return array_map(
            fn (self $value): string => $value->value,
            self::cases(),
        );
    }

    /**
     * @return list<string>
     */
    public static function estimateValues(): array
    {
        return [
            self::Zero->value,
            self::One->value,
            self::Two->value,
            self::Three->value,
            self::Five->value,
            self::Eight->value,
            self::Thirteen->value,
            self::TwentyOne->value,
        ];
    }

    public static function label(?string $value): ?string
    {
        return match ($value) {
            self::Coffee->value => 'koffie',
            default => $value,
        };
    }
}
