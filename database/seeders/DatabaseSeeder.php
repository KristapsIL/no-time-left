<?php

namespace Database\Seeders;

use App\Models\User;
// use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        // User::factory(10)->create();

        User::factory()->create([
            'name' => 'user',
            'email' => 'email@example.com',
            'password' => 'password'
        ]);
        User::factory()->create([
            'name' => 'user2',
            'email' => 'email2@example.com',
            'password' => 'password'
        ]);
    }
}
