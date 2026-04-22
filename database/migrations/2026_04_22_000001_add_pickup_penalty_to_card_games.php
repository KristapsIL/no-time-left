<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('card_games', function (Blueprint $table) {
            $table->integer('pickup_penalty')->default(0)->after('has_picked_up');
        });
    }

    public function down(): void
    {
        Schema::table('card_games', function (Blueprint $table) {
            $table->dropColumn('pickup_penalty');
        });
    }
};
