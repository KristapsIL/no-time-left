<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('users')
            ->where('role', 'bot')
            ->whereNotExists(function ($query) {
                $query->select(DB::raw(1))
                    ->from('room_user')
                    ->whereColumn('room_user.user_id', 'users.id');
            })
            ->delete();
    }

    public function down(): void
    {
        // This is a data cleanup migration and cannot be reversed safely.
    }
};
