<?php

namespace App\Http\Controllers;

use App\Enums\StoryStatus;
use App\Events\RoomUpdated;
use App\Http\Requests\StoreRoomStoryRequest;
use App\Models\Room;
use App\Models\RoomStory;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\DB;

class RoomStoryController extends Controller
{
    public function store(StoreRoomStoryRequest $request, Room $room): RedirectResponse
    {
        $validated = $request->validated();

        DB::transaction(function () use ($room, $validated): void {
            $maxPosition = $room->stories()->max('position');
            $position = $maxPosition === null ? 0 : ((int) $maxPosition) + 1;
            $firstStory = null;

            foreach ($validated['stories'] as $storyData) {
                $story = $room->stories()->create([
                    'key' => filled($storyData['key'] ?? null) ? trim((string) $storyData['key']) : null,
                    'title' => trim((string) $storyData['title']),
                    'position' => $position++,
                    'status' => StoryStatus::Pending,
                ]);

                $firstStory ??= $story;
            }

            if ($room->current_story_id === null && $firstStory instanceof RoomStory) {
                $room->update(['current_story_id' => $firstStory->id]);
            }
        });

        RoomUpdated::dispatch($room->code);

        return back();
    }
}
