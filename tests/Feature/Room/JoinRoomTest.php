<?php

namespace Tests\Feature;

use App\Models\User;
use App\Models\Room;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

test('Autorizēts lietotājs var pievienoties esošai spēles istabai ', function () {
    $creator = User::factory()->create();
    $room = Room::factory()->create([
        'room_name' => 'My Room',
        'created_by' => $creator->id,
    ]);

    $user = User::factory()->create([
        'email' => 'email-test2@example.com',
        'password' => bcrypt('password'),
    ]);

    $response = $this->actingAs($user)->get("/joinroom/{$room->id}");

    $response->assertRedirectContains('/board/');

    $this->assertDatabaseHas('room_user', [
        'room_id' => $room->id,
        'user_id' => $user->id,
    ]);
});
