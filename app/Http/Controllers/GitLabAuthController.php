<?php

namespace App\Http\Controllers;

use App\Events\RoomUpdated;
use App\Http\Controllers\Concerns\EnsuresRoomHost;
use App\Models\Room;
use App\Support\CurrentRoomParticipant;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Laravel\Socialite\Facades\Socialite;
use Throwable;

class GitLabAuthController extends Controller
{
    use EnsuresRoomHost;

    private const SESSION_KEY = 'gitlab.connect_room';

    /**
     * Send the host to GitLab to authorize access. Only the host may connect.
     */
    public function connect(Request $request, Room $room): RedirectResponse
    {
        $this->ensureHost($request, $room);

        $request->session()->put(self::SESSION_KEY, $room->code);

        return Socialite::driver('gitlab')->setScopes(['api'])->redirect();
    }

    /**
     * Handle GitLab's callback: persist the host's tokens against their room.
     */
    public function callback(Request $request): RedirectResponse
    {
        $code = $request->session()->pull(self::SESSION_KEY);
        $room = $code ? Room::query()->where('code', $code)->first() : null;

        if (! $room instanceof Room) {
            return to_route('home');
        }

        $participant = CurrentRoomParticipant::for($room, $request->session());

        if (! $participant?->is_host) {
            return to_route('rooms.show', $room);
        }

        try {
            $gitlabUser = Socialite::driver('gitlab')->user();
        } catch (Throwable) {
            return to_route('rooms.show', $room)
                ->with('gitlab_error', 'Koppeling met GitLab is geannuleerd of mislukt.');
        }

        $room->gitlabConnection()->updateOrCreate([], [
            'gitlab_user_id' => $gitlabUser->getId(),
            'gitlab_username' => $gitlabUser->getNickname() ?? $gitlabUser->getName(),
            'access_token' => $gitlabUser->token,
            'refresh_token' => $gitlabUser->refreshToken,
            'token_expires_at' => $gitlabUser->expiresIn ? now()->addSeconds((int) $gitlabUser->expiresIn) : null,
            'connected_by_participant_id' => $participant->id,
        ]);

        RoomUpdated::dispatch($room->code);

        return to_route('rooms.show', $room);
    }

    /**
     * Remove the GitLab connection for a room.
     */
    public function disconnect(Request $request, Room $room): RedirectResponse
    {
        $this->ensureHost($request, $room);

        $room->gitlabConnection()->delete();

        RoomUpdated::dispatch($room->code);

        return back();
    }
}
