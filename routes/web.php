<?php

use App\Http\Controllers\DashboardController;
use App\Http\Controllers\PlanningSessionController;
use App\Http\Controllers\SessionStoryController;
use App\Http\Controllers\VoteController;
use App\Http\Controllers\VotingRoundController;
use Illuminate\Support\Facades\Route;

Route::redirect('/', '/dashboard')->name('home');

Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('dashboard', DashboardController::class)->name('dashboard');

    Route::get('sessions/create', [PlanningSessionController::class, 'create'])->name('sessions.create');
    Route::post('sessions', [PlanningSessionController::class, 'store'])->name('sessions.store');
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
