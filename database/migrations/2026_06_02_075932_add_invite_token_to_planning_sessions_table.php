<?php

use App\Models\PlanningSession;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('planning_sessions', function (Blueprint $table) {
            $table->string('invite_token', 64)->nullable()->unique()->after('name');
        });

        PlanningSession::query()
            ->whereNull('invite_token')
            ->get()
            ->each(function (PlanningSession $session): void {
                $session->forceFill(['invite_token' => Str::random(32)])->save();
            });
    }

    public function down(): void
    {
        Schema::table('planning_sessions', function (Blueprint $table) {
            $table->dropUnique(['invite_token']);
            $table->dropColumn('invite_token');
        });
    }
};
