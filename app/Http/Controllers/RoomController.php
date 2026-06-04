<?php

namespace App\Http\Controllers;

use App\Enums\RoomStatus;
use App\Enums\StoryStatus;
use App\Events\RoomUpdated;
use App\Http\Requests\JoinRoomRequest;
use App\Http\Requests\StoreRoomRequest;
use App\Models\Room;
use App\Models\RoomParticipant;
use App\Models\RoomStory;
use App\Support\CurrentRoomParticipant;
use App\Support\RoomPalette;
use App\Support\RoomPresenter;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class RoomController extends Controller
{
    public function store(StoreRoomRequest $request): RedirectResponse
    {
        $validated = $request->validated();

        $room = DB::transaction(function () use ($validated, $request): Room {
            $room = Room::create([
                'name' => filled($validated['name'] ?? null) ? trim((string) $validated['name']) : 'Planning Poker',
                'status' => RoomStatus::Active,
            ]);

            $host = $room->participants()->create([
                'name' => filled($validated['host_name'] ?? null) ? trim((string) $validated['host_name']) : 'Host',
                'color' => RoomPalette::forIndex(0),
                'is_host' => true,
                'last_seen_at' => now(),
            ]);

            CurrentRoomParticipant::remember($room, $host, $request->session());

            $firstStory = null;

            foreach ($this->normalizeStories($validated['stories'] ?? []) as $index => $storyData) {
                $story = $room->stories()->create([
                    'key' => $storyData['key'],
                    'title' => $storyData['title'],
                    'position' => $index,
                    'status' => StoryStatus::Pending,
                ]);

                $firstStory ??= $story;
            }

            if ($firstStory instanceof RoomStory) {
                $room->update(['current_story_id' => $firstStory->id]);
            }

            return $room;
        });

        RoomUpdated::dispatch($room->code);

        return to_route('rooms.show', $room);
    }

    public function show(Request $request, Room $room, RoomPresenter $presenter): Response
    {
        $me = CurrentRoomParticipant::for($room, $request->session());

        $me?->forceFill(['last_seen_at' => now()])->save();

        return Inertia::render('poker', [
            'room' => $presenter->for($room, $me),
        ]);
    }

    public function join(JoinRoomRequest $request, Room $room): RedirectResponse
    {
        $existing = CurrentRoomParticipant::for($room, $request->session());

        if (! $existing instanceof RoomParticipant) {
            $index = $room->participants()->count();

            $participant = $room->participants()->create([
                'name' => trim((string) $request->validated('name')),
                'color' => RoomPalette::forIndex($index),
                'is_host' => false,
                'last_seen_at' => now(),
            ]);

            CurrentRoomParticipant::remember($room, $participant, $request->session());

            RoomUpdated::dispatch($room->code);
        }

        return to_route('rooms.show', $room);
    }

    /**
     * @param  array<int, array{key?: string|null, title?: string|null}>  $stories
     * @return list<array{key: string|null, title: string}>
     */
    private function normalizeStories(array $stories): array
    {
        return collect($stories)
            ->map(fn (array $story): array => [
                'key' => filled($story['key'] ?? null) ? trim((string) $story['key']) : null,
                'title' => trim((string) ($story['title'] ?? '')),
            ])
            ->filter(fn (array $story): bool => $story['title'] !== '')
            ->values()
            ->all();
    }
}
