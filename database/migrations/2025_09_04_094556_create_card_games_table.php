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
        Schema::create('card_games', function (Blueprint $table) {
            $table->id();
            $table->foreignId('room_id')->constrained()->cascadeOnDelete();
            $table->json('deck')->nullable();
            $table->json('used_cards')->nullable();
            $table->json('player_hands')->nullable(); 
            $table->foreignId('current_turn')->nullable()->constrained('users');
            $table->boolean('has_picked_up')->default(false);
            $table->enum('game_status', ['waiting', 'starting', 'in_progress', 'finished'])->default('waiting');
            $table->timestamp('game_started_at')->nullable();
            $table->foreignId('winner')->nullable()->constrained('users');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('card_games');
    }
};
