<?php

namespace App\Models;

use App\Enums\RoomStatus;
use Database\Factories\RoomFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

#[Fillable([
    'code',
    'name',
    'status',
    'current_story_id',
    'current_round_id',
    'completed_at',
])]
class Room extends Model
{
    /** @use HasFactory<RoomFactory> */
    use HasFactory;

    protected static function booted(): void
    {
        static::creating(function (Room $room): void {
            if (empty($room->code)) {
                $room->code = self::generateCode($room->name);
            }
        });
    }

    public function getRouteKeyName(): string
    {
        return 'code';
    }

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'status' => RoomStatus::class,
            'completed_at' => 'datetime',
        ];
    }

    public function participants(): HasMany
    {
        return $this->hasMany(RoomParticipant::class);
    }

    public function stories(): HasMany
    {
        return $this->hasMany(RoomStory::class)->orderBy('position');
    }

    public function rounds(): HasMany
    {
        return $this->hasMany(RoomRound::class)->latest();
    }

    public function currentStory(): BelongsTo
    {
        return $this->belongsTo(RoomStory::class, 'current_story_id');
    }

    public function currentRound(): BelongsTo
    {
        return $this->belongsTo(RoomRound::class, 'current_round_id');
    }

    /**
     * Build a unique, URL-safe room code from the room name. Hyphens only —
     * the broadcasting channel pattern splits on dots, so the code must not
     * contain any.
     */
    public static function generateCode(string $name): string
    {
        $base = Str::slug($name) ?: 'room';

        do {
            $code = $base.'-'.Str::lower(Str::random(6));
        } while (self::query()->where('code', $code)->exists());

        return $code;
    }
}
