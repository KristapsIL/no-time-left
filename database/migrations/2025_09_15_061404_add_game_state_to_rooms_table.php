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
        Schema::table('rooms', function (Blueprint $table) {
            $table->enum('game_status', ['waiting', 'starting', 'in_progress', 'finished'])->default('waiting');
            $table->json('player_hands')->nullable(); 
            $table->integer('cards_per_player')->default(7);
            $table->timestamp('game_started_at')->nullable();
            $table->foreignId('current_turn')->nullable();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('rooms', function (Blueprint $table) {
            $table->dropColumn(['game_status', 'player_hands', 'cards_per_player', 'game_started_at']);
        });
    }
};
