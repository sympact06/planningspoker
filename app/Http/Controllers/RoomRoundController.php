<?php

namespace App\Http\Controllers;

use App\Enums\RoomStatus;
use App\Enums\StoryStatus;
use App\Enums\VotingRoundStatus;
use App\Events\RoomUpdated;
use App\Http\Requests\AcceptRoomRoundRequest;
use App\Http\Requests\StoreRoomRoundRequest;
use App\Models\Room;
use App\Models\RoomRound;
use App\Models\RoomStory;
use App\Support\CurrentRoomParticipant;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class RoomRoundController extends Controller
{
    public function store(StoreRoomRoundRequest $request, Room $room): RedirectResponse
    {
        $validated = $request->validated();

        $round = RoomRound::create([
            'room_id' => $room->id,
            'room_story_id' => $validated['story_id'],
            'status' => VotingRoundStatus::Voting,
        ]);

        $room->update([
            'status' => RoomStatus::Active,
            'current_story_id' => $validated['story_id'],
            'current_round_id' => $round->id,
        ]);

        RoomUpdated::dispatch($room->code);

        return back();
    }

    public function reveal(Request $request, Room $room, RoomRound $roomRound): RedirectResponse
    {
        $this->ensureHost($request, $room);
        $this->ensureRoundBelongsToRoom($room, $roomRound);

        if (in_array($roomRound->status, [VotingRoundStatus::Voting, VotingRoundStatus::Intro], true)) {
            $roomRound->update([
                'status' => VotingRoundStatus::Revealed,
                'revealed_at' => now(),
            ]);
        }

        RoomUpdated::dispatch($room->code);

        return back();
    }

    public function accept(AcceptRoomRoundRequest $request, Room $room, RoomRound $roomRound): RedirectResponse
    {
        $this->ensureRoundBelongsToRoom($room, $roomRound);

        abort_unless($roomRound->showsVotes(), 422, 'Stemmen moeten eerst zichtbaar zijn.');

        DB::transaction(function () use ($request, $room, $roomRound): void {
            $roomRound->loadMissing('votes');

            $estimate = $request->validated('estimate') ?? $roomRound->suggestedEstimate();

            $roomRound->update([
                'status' => VotingRoundStatus::Accepted,
                'accepted_at' => now(),
            ]);

            $roomRound->story->update([
                'status' => StoryStatus::Estimated,
                'final_estimate' => $estimate,
            ]);

            $nextStory = $room->stories()
                ->where('status', StoryStatus::Pending->value)
                ->orderBy('position')
                ->first();

            $room->update([
                'status' => $nextStory instanceof RoomStory ? RoomStatus::Active : RoomStatus::Completed,
                'completed_at' => $nextStory instanceof RoomStory ? null : now(),
                'current_story_id' => $nextStory?->id ?? $roomRound->room_story_id,
                'current_round_id' => $nextStory instanceof RoomStory ? null : $roomRound->id,
            ]);
        });

        RoomUpdated::dispatch($room->code);

        return back();
    }

    public function revote(Request $request, Room $room, RoomRound $roomRound): RedirectResponse
    {
        $this->ensureHost($request, $room);
        $this->ensureRoundBelongsToRoom($room, $roomRound);

        $newRound = RoomRound::create([
            'room_id' => $room->id,
            'room_story_id' => $roomRound->room_story_id,
            'status' => VotingRoundStatus::Voting,
        ]);

        $roomRound->story->update([
            'status' => StoryStatus::Pending,
            'final_estimate' => null,
        ]);

        $room->update([
            'status' => RoomStatus::Active,
            'completed_at' => null,
            'current_story_id' => $roomRound->room_story_id,
            'current_round_id' => $newRound->id,
        ]);

        RoomUpdated::dispatch($room->code);

        return back();
    }

    private function ensureHost(Request $request, Room $room): void
    {
        $participant = CurrentRoomParticipant::for($room, $request->session());

        abort_unless((bool) $participant?->is_host, 403);
    }

    private function ensureRoundBelongsToRoom(Room $room, RoomRound $roomRound): void
    {
        abort_unless((int) $roomRound->room_id === (int) $room->id, 404);
    }
}
