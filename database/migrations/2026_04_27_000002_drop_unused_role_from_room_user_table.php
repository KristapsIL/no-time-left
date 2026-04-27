<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasColumn('room_user', 'role')) {
            return;
        }

        Schema::table('room_user', function (Blueprint $table) {
            $table->dropColumn('role');
        });
    }

    public function down(): void
    {
        if (Schema::hasColumn('room_user', 'role')) {
            return;
        }

        Schema::table('room_user', function (Blueprint $table) {
            $table->string('role')->default('player');
        });
    }
};
