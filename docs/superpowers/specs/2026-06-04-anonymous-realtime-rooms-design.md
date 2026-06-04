# Anonymous realtime Planning Poker rooms

Date: 2026-06-04

## Goal

Make the 3D Planning Poker page at `/` ([resources/js/pages/poker.tsx](../../../resources/js/pages/poker.tsx))
a *real* multiplayer experience backed by Laravel Reverb, replacing the current
demo (hardcoded `PLAYERS`, `setTimeout` bot voting, purely local state).

Decisions (confirmed with the user):

- The **3D page itself** becomes the real app.
- **Anonymous access**: no accounts. Players create/join a room via a shareable
  link and just enter a name.
- **Host-only control**: the room creator (host) reveals, accepts, manages
  stories and starts rounds. Other participants can only vote.
- **Persisted** in the database (no auto-cleanup).
- The existing authenticated `/sessions/*` flow stays untouched and working.

## Architecture

A new, self-contained `Room` domain living **next to** the existing
`PlanningSession` domain. No accounts/teams involved. A participant is identified
by their entry in the Laravel **session** (cookie) — `room_participant.{roomId}`
holds their `room_participants.id`. The host is simply the participant with
`is_host = true`.

### Database (new migration)

- `rooms`: `id`, `code` (unique slug, hyphens only — no dots), `name`,
  `status` (`active`/`completed`), `current_story_id` (nullable),
  `current_round_id` (nullable), `completed_at` (nullable), timestamps.
- `room_participants`: `id`, `room_id`, `name`, `color`, `is_host` (bool),
  `last_seen_at` (nullable), timestamps.
- `room_stories`: `id`, `room_id`, `key` (nullable), `title`, `position`,
  `status` (`pending`/`estimated`), `final_estimate` (nullable string),
  timestamps. Unique `(room_id, key)`.
- `room_rounds`: `id`, `room_id`, `room_story_id`, `status`
  (`voting`/`revealed`/`accepted`), `revealed_at`, `accepted_at`, timestamps.
- `room_votes`: `id`, `room_round_id`, `room_participant_id`, `value` (string),
  timestamps. Unique `(room_round_id, room_participant_id)`.

### Models

`Room`, `RoomParticipant`, `RoomStory`, `RoomRound`, `RoomVote` with the obvious
relations. `RoomRound` reuses the `VotingRoundStatus` enum and gets
`showsVotes()` + `suggestedEstimate()` helpers (mirrors `VotingRound`).
Vote values validated against the existing `VoteValue` enum.

### Routes (web, NO auth)

- `POST /rooms` → `RoomController@store` (create room + host participant + stories)
- `GET /rooms/{room:code}` → `RoomController@show` (render the 3D page or join gate)
- `POST /rooms/{room:code}/join` → `RoomController@join` (name → participant)
- `POST /rooms/{room:code}/state` is not needed; refresh via Inertia partial reload
- `POST /rooms/{room:code}/stories` → `RoomStoryController@store` (host)
- `POST /rooms/{room:code}/rounds` → `RoomRoundController@store` (host)
- `POST /rooms/{room:code}/votes` → `RoomVoteController@store` (participant)
- `POST /rooms/{room:code}/rounds/{roomRound}/reveal` → host
- `POST /rooms/{room:code}/rounds/{roomRound}/accept` → host
- `POST /rooms/{room:code}/rounds/{roomRound}/revote` → host

`/` keeps rendering the `poker` page in **setup** mode (add stories). "Start
sessie" POSTs to `/rooms` and Inertia-redirects to `/rooms/{code}`.

Host-only actions resolve the current participant from the session for that room
and `abort(403)` unless `is_host`. Voting resolves the participant and
`abort(403)` if none (the join gate prevents this in the UI).

### Realtime (Reverb)

- New event `RoomUpdated(string $code)` — `ShouldBroadcastNow`, with the same
  best-effort static `dispatch()` wrapper as `SessionUpdated` (never breaks the
  HTTP request if Reverb is down). Broadcasts on `PresenceChannel('room.'.$code)`
  as `.room.updated`. Dispatched after every mutation (create/join/story/round/
  vote/reveal/accept/revote).
- `routes/channels.php`: register `room.{code}` presence channel. The callback
  reads the participant from the session (not a `User`) and returns
  `['id','name','color','is_host']`, or `false` if no participant.
- `bootstrap/app.php`: relax broadcasting middleware from `['web','auth']` to
  `['web']` so guests can authorize. Make the existing `App.Models.User.{id}`
  and `planning-session.{id}` callbacks accept `?User $user` and return `false`
  when null (defensive; those pages still require auth at the route level).

### Presenter

`RoomPresenter::for(Room $room, ?RoomParticipant $me)` returns the JSON the page
needs, mirroring `PlanningSessionPresenter`: room meta + `invite_url`,
participants (with `has_voted`, and `vote` only when the round shows votes),
stories, `current_round` (status, suggested estimate + distribution only when
revealed, per-participant votes hidden until revealed), stats, `me` (id, name,
is_host) or `null`, and `vote_values`.

**Vote secrecy:** during `voting`, only `has_voted` booleans are sent; actual
values and distribution are withheld until the round is `revealed`/`accepted`.

### Frontend (`poker.tsx`)

- `/` (no room): unchanged **setup** view; "Start sessie" submits stories to
  `POST /rooms` via a Wayfinder action and redirects to the room.
- `/rooms/{code}` with a participant: real playing view.
  - `me` + `participants` come from props (authoritative) and presence
    (online indicator).
  - `useEchoPresence('room.'+code, '.room.updated', () => router.reload({ only: ['room'] }))`.
  - Voting/reveal/accept/revote/start-round/manage-stories → real POSTs via
    Wayfinder actions. The host sees control buttons; non-hosts only the deck.
  - Card `☕` maps to the `coffee` vote value on submit; `?` stays `?`.
  - The existing `poker-scene.js` is fed real players + votes — unchanged.
  - Invite modal shows the real absolute room URL with a working copy button.
- `/rooms/{code}` without a participant: a **join gate** (enter name) → `POST join`.

### Tests (Pest, feature)

- create room (with stories) → host participant created, stored in session,
  redirect to room, `RoomUpdated` dispatched.
- join room → participant created, `RoomUpdated` dispatched.
- cast vote → stored; values hidden from presenter until reveal.
- host reveal/accept/revote → state transitions; non-host gets 403.
- non-host cannot manage stories / start round (403).
- accept advances `current_story_id` and stores `final_estimate`.

Use `Event::fake([RoomUpdated::class])` to assert broadcasts without a live
Reverb server.

## Out of scope

- CSV export from the complete screen (stays a placeholder button).
- Email/Slack/QR share buttons (cosmetic placeholders, as today).
- Auto-cleanup of old rooms.
