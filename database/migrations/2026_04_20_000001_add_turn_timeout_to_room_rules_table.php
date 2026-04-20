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
            $table->integer('turn_timeout_seconds')->default(5)->after('cards_per_player');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('room_rules', function (Blueprint $table) {
            $table->dropColumn('turn_timeout_seconds');
        });
    }
};
