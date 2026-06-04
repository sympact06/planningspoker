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
        Schema::create('rooms', function (Blueprint $table) {
            $table->id();
            $table->string('code')->unique();
            $table->string('name');
            $table->string('status')->default('active');
            $table->unsignedBigInteger('current_story_id')->nullable();
            $table->unsignedBigInteger('current_round_id')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();
        });

        Schema::create('room_participants', function (Blueprint $table) {
            $table->id();
            $table->foreignId('room_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('color', 16);
            $table->boolean('is_host')->default(false);
            $table->timestamp('last_seen_at')->nullable();
            $table->timestamps();

            $table->index(['room_id', 'is_host']);
        });

        Schema::create('room_stories', function (Blueprint $table) {
            $table->id();
            $table->foreignId('room_id')->constrained()->cascadeOnDelete();
            $table->string('key', 50)->nullable();
            $table->string('title');
            $table->unsignedInteger('position')->default(0);
            $table->string('status')->default('pending');
            $table->string('final_estimate', 16)->nullable();
            $table->timestamps();

            $table->index(['room_id', 'position']);
            $table->unique(['room_id', 'key']);
        });

        Schema::create('room_rounds', function (Blueprint $table) {
            $table->id();
            $table->foreignId('room_id')->constrained()->cascadeOnDelete();
            $table->foreignId('room_story_id')->constrained()->cascadeOnDelete();
            $table->string('status')->default('voting');
            $table->timestamp('revealed_at')->nullable();
            $table->timestamp('accepted_at')->nullable();
            $table->timestamps();

            $table->index(['room_id', 'status']);
        });

        Schema::create('room_votes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('room_round_id')->constrained()->cascadeOnDelete();
            $table->foreignId('room_participant_id')->constrained()->cascadeOnDelete();
            $table->string('value', 16);
            $table->timestamps();

            $table->unique(['room_round_id', 'room_participant_id']);
            $table->index('room_participant_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('room_votes');
        Schema::dropIfExists('room_rounds');
        Schema::dropIfExists('room_stories');
        Schema::dropIfExists('room_participants');
        Schema::dropIfExists('rooms');
    }
};
