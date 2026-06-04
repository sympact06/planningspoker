<?php

namespace App\Support;

use App\Enums\StoryStatus;
use App\Enums\VoteValue;
use App\Models\Room;
use App\Models\RoomParticipant;
use App\Models\RoomRound;

final class RoomPresenter
{
    /**
     * @return array<string, mixed>
     */
    public function for(Room $room, ?RoomParticipant $me): array
    {
        $room->loadMissing([
            'participants',
            'stories',
            'currentRound.votes',
        ]);

        $currentRound = $room->currentRound;
        $showsVotes = $currentRound instanceof RoomRound && $currentRound->showsVotes();
        $votesByParticipant = $currentRound instanceof RoomRound
            ? $currentRound->votes->keyBy('room_participant_id')
            : collect();

        $stories = $room->stories->sortBy('position')->values();

        $participants = $room->participants->sortBy('id')->values();

        return [
            'code' => $room->code,
            'name' => $room->name,
            'status' => $room->status->value,
            'invite_url' => route('rooms.show', $room->code),
            'current_story_id' => $room->current_story_id,
            'stories' => $stories->map(fn ($story): array => [
                'id' => $story->id,
                'key' => $story->key,
                'title' => $story->title,
                'position' => $story->position,
                'status' => $story->status->value,
                'final_estimate' => $story->final_estimate,
            ])->all(),
            'players' => $participants->map(fn (RoomParticipant $participant): array => [
                'id' => $participant->id,
                'name' => $participant->name,
                'color' => $participant->color,
                'is_host' => $participant->is_host,
                'has_voted' => $votesByParticipant->has($participant->id),
                'vote' => $showsVotes && $votesByParticipant->has($participant->id)
                    ? $votesByParticipant->get($participant->id)->value
                    : null,
            ])->all(),
            'current_round' => $currentRound instanceof RoomRound
                ? [
                    'id' => $currentRound->id,
                    'story_id' => $currentRound->room_story_id,
                    'status' => $currentRound->status->value,
                    'shows_votes' => $showsVotes,
                    'suggested_estimate' => $showsVotes ? $currentRound->suggestedEstimate() : null,
                ]
                : null,
            'stats' => [
                'total_stories' => $stories->count(),
                'estimated_stories' => $stories
                    ->where('status', StoryStatus::Estimated)
                    ->count(),
            ],
            'me' => $me instanceof RoomParticipant
                ? [
                    'id' => $me->id,
                    'name' => $me->name,
                    'color' => $me->color,
                    'is_host' => $me->is_host,
                ]
                : null,
            'vote_values' => VoteValue::values(),
        ];
    }
}
