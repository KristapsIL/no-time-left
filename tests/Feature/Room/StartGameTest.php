<?php

namespace Tests\Feature;

use App\Models\User;
use App\Models\Room;
use App\Models\RoomRules;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

test('Autorizēts lietotājs var sākt kāršu spēli', function () {

    $creator = User::factory()->create();
    $room = Room::factory()->create([
        'room_name' => 'My Room',
        'created_by' => $creator->id,
    ]);

    $player = User::factory()->create();
    $this->actingAs($player)->get("/joinroom/{$room->id}");

    $this->actingAs($creator)->get("/joinroom/{$room->id}");

    $this->actingAs($creator)->post("/board/{$room->id}/start-game");

    $this->assertDatabaseHas('card_games', [
        'room_id' => $room->id,
        'game_status' => 'in_progress',
    ]);

    $this->assertDatabaseHas('room_user', [
        'room_id' => $room->id,
        'user_id' => $player->id,
    ]);
});

test('Spēli var sākt ar vienu cilvēka spēlētāju, pievienojot botu', function () {
    $creator = User::factory()->create();
    $room = Room::factory()->create([
        'room_name' => 'Solo Room',
        'created_by' => $creator->id,
    ]);

    RoomRules::create([
        'room_id' => $room->id,
        'public' => true,
        'max_players' => 2,
        'turn_timeout_seconds' => 5,
        'rules' => [],
    ]);

    $this->actingAs($creator)->get("/joinroom/{$room->id}");
    $this->actingAs($creator)->post("/board/{$room->id}/start-game");

    $this->assertDatabaseHas('card_games', [
        'room_id' => $room->id,
        'game_status' => 'in_progress',
    ]);

    $botId = User::query()->where('role', 'bot')->value('id');
    expect($botId)->not()->toBeNull();

    $this->assertDatabaseHas('room_user', [
        'room_id' => $room->id,
        'user_id' => $botId,
    ]);
});
