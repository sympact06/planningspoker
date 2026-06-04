<?php

namespace App\Http\Controllers;

use App\Enums\VotingRoundStatus;
use App\Events\RoomUpdated;
use App\Http\Requests\StoreRoomVoteRequest;
use App\Models\Room;
use App\Models\RoomVote;
use App\Support\CurrentRoomParticipant;
use Illuminate\Http\RedirectResponse;

class RoomVoteController extends Controller
{
    public function store(StoreRoomVoteRequest $request, Room $room): RedirectResponse
    {
        $participant = CurrentRoomParticipant::for($room, $request->session());

        abort_unless($participant !== null, 403);

        $round = $room->currentRound;

        abort_unless($round !== null, 422, 'Er is nog geen stemronde actief.');
        abort_unless($round->status === VotingRoundStatus::Voting, 422, 'Deze stemronde staat niet open.');

        RoomVote::updateOrCreate(
            [
                'room_round_id' => $round->id,
                'room_participant_id' => $participant->id,
            ],
            [
                'value' => $request->validated('value'),
            ],
        );

        RoomUpdated::dispatch($room->code);

        return back();
    }
}
