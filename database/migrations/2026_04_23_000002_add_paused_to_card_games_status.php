<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $driver = Schema::getConnection()->getDriverName();

        if (in_array($driver, ['mysql', 'mariadb'], true)) {
            DB::statement("ALTER TABLE card_games MODIFY COLUMN game_status ENUM('waiting','starting','in_progress','paused','finished') NOT NULL DEFAULT 'waiting'");

            return;
        }

        Schema::table('card_games', function (Blueprint $table) {
            $table->string('game_status')->default('waiting')->change();
        });
    }

    public function down(): void
    {
        $driver = Schema::getConnection()->getDriverName();

        if (in_array($driver, ['mysql', 'mariadb'], true)) {
            DB::statement("ALTER TABLE card_games MODIFY COLUMN game_status ENUM('waiting','starting','in_progress','finished') NOT NULL DEFAULT 'waiting'");

            return;
        }

        Schema::table('card_games', function (Blueprint $table) {
            $table->string('game_status')->default('waiting')->change();
        });
    }
};
