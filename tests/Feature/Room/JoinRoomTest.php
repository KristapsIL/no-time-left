<?php

namespace Tests\Feature;

use App\Models\User;
use App\Models\Room;
use App\Models\RoomRules;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

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

test('Ja gaidošā istaba ir pilna ar botu, cilvēka spēlētājs aizvieto botu', function () {
    $creator = User::factory()->create();
    $room = Room::factory()->create([
        'room_name' => 'Bot Room',
        'created_by' => $creator->id,
    ]);

    RoomRules::create([
        'room_id' => $room->id,
        'public' => true,
        'max_players' => 2,
        'turn_timeout_seconds' => 5,
        'rules' => [],
    ]);

    $bot = User::query()->forceCreate([
        'name' => 'Bot TEST',
        'role' => 'bot',
        'email' => 'bot+' . Str::uuid() . '@no-time-left.local',
        'email_verified_at' => now(),
        'password' => Hash::make('password'),
    ]);

    $room->players()->attach($creator->id);
    $room->players()->attach($bot->id);

    $user = User::factory()->create();

    $response = $this->actingAs($user)->get("/joinroom/{$room->id}");

    $response->assertRedirectContains('/board/');

    $this->assertDatabaseHas('room_user', [
        'room_id' => $room->id,
        'user_id' => $user->id,
    ]);

    $this->assertDatabaseMissing('room_user', [
        'room_id' => $room->id,
        'user_id' => $bot->id,
    ]);
});
