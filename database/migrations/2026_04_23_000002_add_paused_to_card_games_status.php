<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement("ALTER TABLE card_games MODIFY COLUMN game_status ENUM('waiting','starting','in_progress','paused','finished') NOT NULL DEFAULT 'waiting'");
    }

    public function down(): void
    {
        DB::statement("ALTER TABLE card_games MODIFY COLUMN game_status ENUM('waiting','starting','in_progress','finished') NOT NULL DEFAULT 'waiting'");
    }
};
