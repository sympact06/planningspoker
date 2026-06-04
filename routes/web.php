<?php

use App\Http\Controllers\DashboardController;
use App\Http\Controllers\GitLabAuthController;
use App\Http\Controllers\GitLabBrowseController;
use App\Http\Controllers\GitLabImportController;
use App\Http\Controllers\GitLabSyncController;
use App\Http\Controllers\PlanningSessionController;
use App\Http\Controllers\RoomController;
use App\Http\Controllers\RoomRoundController;
use App\Http\Controllers\RoomStoryController;
use App\Http\Controllers\RoomVoteController;
use App\Http\Controllers\SessionStoryController;
use App\Http\Controllers\VoteController;
use App\Http\Controllers\VotingRoundController;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

Route::get('/', fn () => Inertia::render('poker'))->name('home');

/*
 * Anonymous, realtime planning poker rooms (no account required). The 3D page
 * at "/" creates a room; players join via a shareable link and their name.
 */
Route::post('rooms', [RoomController::class, 'store'])->name('rooms.store');
Route::get('rooms/{room}', [RoomController::class, 'show'])->name('rooms.show');
Route::post('rooms/{room}/join', [RoomController::class, 'join'])->name('rooms.join');
Route::post('rooms/{room}/stories', [RoomStoryController::class, 'store'])->name('rooms.stories.store');
Route::post('rooms/{room}/rounds', [RoomRoundController::class, 'store'])->name('rooms.rounds.store');
Route::post('rooms/{room}/votes', [RoomVoteController::class, 'store'])->name('rooms.votes.store');
Route::post('rooms/{room}/rounds/{roomRound}/reveal', [RoomRoundController::class, 'reveal'])->name('rooms.rounds.reveal');
Route::post('rooms/{room}/rounds/{roomRound}/accept', [RoomRoundController::class, 'accept'])->name('rooms.rounds.accept');
Route::post('rooms/{room}/rounds/{roomRound}/revote', [RoomRoundController::class, 'revote'])->name('rooms.rounds.revote');

/*
 * GitLab integration. The host connects their account via OAuth, browses and
 * imports issues, and the agreed estimates are pushed back as issue weights.
 */
Route::get('rooms/{room}/gitlab/connect', [GitLabAuthController::class, 'connect'])->name('rooms.gitlab.connect');
Route::get('auth/gitlab/callback', [GitLabAuthController::class, 'callback'])->name('gitlab.callback');
Route::delete('rooms/{room}/gitlab', [GitLabAuthController::class, 'disconnect'])->name('rooms.gitlab.disconnect');
Route::get('rooms/{room}/gitlab/projects', [GitLabBrowseController::class, 'projects'])->name('rooms.gitlab.projects');
Route::get('rooms/{room}/gitlab/meta', [GitLabBrowseController::class, 'meta'])->name('rooms.gitlab.meta');
Route::get('rooms/{room}/gitlab/issues', [GitLabBrowseController::class, 'issues'])->name('rooms.gitlab.issues');
Route::post('rooms/{room}/gitlab/import', [GitLabImportController::class, 'store'])->name('rooms.gitlab.import');
Route::post('rooms/{room}/gitlab/sync', [GitLabSyncController::class, 'store'])->name('rooms.gitlab.sync');

Route::middleware(['auth'])->group(function () {
    Route::get('dashboard', DashboardController::class)->name('dashboard');

    Route::get('sessions/create', [PlanningSessionController::class, 'create'])->name('sessions.create');
    Route::post('sessions', [PlanningSessionController::class, 'store'])->name('sessions.store');
    Route::get('sessions/join/{token}', [PlanningSessionController::class, 'join'])->name('sessions.join');
    Route::get('sessions/{planningSession}', [PlanningSessionController::class, 'show'])->name('sessions.show');
    Route::post('sessions/{planningSession}/complete', [PlanningSessionController::class, 'complete'])->name('sessions.complete');

    Route::post('sessions/{planningSession}/stories', [SessionStoryController::class, 'store'])->name('sessions.stories.store');
    Route::post('sessions/{planningSession}/rounds', [VotingRoundController::class, 'store'])->name('sessions.rounds.store');
    Route::post('sessions/{planningSession}/votes', [VoteController::class, 'store'])->name('sessions.votes.store');
    Route::post('sessions/{planningSession}/rounds/{votingRound}/reveal', [VotingRoundController::class, 'reveal'])->name('sessions.rounds.reveal');
    Route::post('sessions/{planningSession}/rounds/{votingRound}/accept', [VotingRoundController::class, 'accept'])->name('sessions.rounds.accept');
    Route::post('sessions/{planningSession}/rounds/{votingRound}/revote', [VotingRoundController::class, 'revote'])->name('sessions.rounds.revote');
});

require __DIR__.'/settings.php';
