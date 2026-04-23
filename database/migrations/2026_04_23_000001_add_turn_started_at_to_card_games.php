<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('card_games', function (Blueprint $table) {
            $table->timestamp('turn_started_at')->nullable()->after('game_started_at');
        });
    }

    public function down(): void
    {
        Schema::table('card_games', function (Blueprint $table) {
            $table->dropColumn('turn_started_at');
        });
    }
};
