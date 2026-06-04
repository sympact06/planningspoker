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
        Schema::table('room_stories', function (Blueprint $table) {
            $table->unsignedBigInteger('gitlab_project_id')->nullable()->after('key');
            $table->unsignedInteger('gitlab_issue_iid')->nullable()->after('gitlab_project_id');
            $table->string('gitlab_web_url')->nullable()->after('gitlab_issue_iid');
            $table->timestamp('gitlab_synced_at')->nullable()->after('final_estimate');

            $table->index(['gitlab_project_id', 'gitlab_issue_iid']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('room_stories', function (Blueprint $table) {
            $table->dropIndex(['gitlab_project_id', 'gitlab_issue_iid']);
            $table->dropColumn([
                'gitlab_project_id',
                'gitlab_issue_iid',
                'gitlab_web_url',
                'gitlab_synced_at',
            ]);
        });
    }
};
