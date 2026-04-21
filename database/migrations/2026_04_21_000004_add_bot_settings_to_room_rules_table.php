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
        Schema::table('room_rules', function (Blueprint $table) {
            $table->unsignedTinyInteger('bot_fill_count')->default(1)->after('turn_timeout_seconds');
            $table->string('bot_difficulty')->default('medium')->after('bot_fill_count');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('room_rules', function (Blueprint $table) {
            $table->dropColumn(['bot_fill_count', 'bot_difficulty']);
        });
    }
};
