<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('teams', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->timestamps();
        });

        Schema::create('team_user', function (Blueprint $table) {
            $table->foreignId('team_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('role')->default('member');
            $table->timestamps();

            $table->unique(['team_id', 'user_id']);
            $table->index(['user_id', 'role']);
        });

        Schema::create('planning_sessions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('team_id')->constrained()->cascadeOnDelete();
            $table->foreignId('facilitator_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('name');
            $table->string('status')->default('setup');
            $table->unsignedBigInteger('current_story_id')->nullable();
            $table->unsignedBigInteger('current_voting_round_id')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();

            $table->index(['team_id', 'status']);
        });

        Schema::create('stories', function (Blueprint $table) {
            $table->id();
            $table->foreignId('planning_session_id')->constrained()->cascadeOnDelete();
            $table->string('key', 50)->nullable();
            $table->string('title');
            $table->unsignedInteger('position')->default(0);
            $table->string('status')->default('pending');
            $table->string('final_estimate', 16)->nullable();
            $table->timestamps();

            $table->index(['planning_session_id', 'position']);
            $table->unique(['planning_session_id', 'key']);
        });

        Schema::create('voting_rounds', function (Blueprint $table) {
            $table->id();
            $table->foreignId('planning_session_id')->constrained()->cascadeOnDelete();
            $table->foreignId('story_id')->constrained()->cascadeOnDelete();
            $table->foreignId('started_by_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('status')->default('voting');
            $table->timestamp('revealed_at')->nullable();
            $table->timestamp('accepted_at')->nullable();
            $table->timestamps();

            $table->index(['planning_session_id', 'status']);
        });

        Schema::create('votes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('voting_round_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('value', 16);
            $table->timestamps();

            $table->unique(['voting_round_id', 'user_id']);
            $table->index('user_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('votes');
        Schema::dropIfExists('voting_rounds');
        Schema::dropIfExists('stories');
        Schema::dropIfExists('planning_sessions');
        Schema::dropIfExists('team_user');
        Schema::dropIfExists('teams');
    }
};
