<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

test('user can create a room via form submission', function () {
    $user = User::factory()->create([
        'email' => 'email-test@example.com',
        'password' => bcrypt('password'),
    ]);

    $response = $this->actingAs($user)
        ->post('/storeRules', [
            'room_name' => 'My Room',
            'public' => true,
            'max_players' => 4,
            'rules' => ['pick_up_till_match'],
        ]);
    $response->assertRedirectContains('/board/');

    $this->assertDatabaseHas('rooms', [
        'room_name' => 'My Room',
        'created_by' => $user->id,
    ]);

});
