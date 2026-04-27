<?php

namespace Tests\Feature;

use App\Models\User;
use App\Models\Room;
use App\Models\RoomRules;
use Illuminate\Foundation\Testing\RefreshDatabase;

// Katrs tests tiek izpildīts ar tīru datubāzi — izmaiņas netiek saglabātas starp testiem
uses(RefreshDatabase::class);

// Tests pārbauda pilnu spēles sākšanas procesu ar 2 reāliem spēlētājiem:
// 1. Izveido istabu un divus spēlētājus
// 2. Abi spēlētāji pievienojas istabai
// 3. Istabas radītājs nosūta start-game pieprasījumu
// 4. Pārbauda, vai spēle datubāzē ir ar statusu 'in_progress'
// 5. Pārbauda, vai otrais spēlētājs joprojām ir istabā
test('Autorizēts lietotājs var sākt kāršu spēli', function () {
    // Izveido istabas radītāju un istabu
    $creator = User::factory()->create();
    $room = Room::factory()->create([
        'room_name' => 'My Room',
        'created_by' => $creator->id,
    ]);

    // Otrs spēlētājs pievienojas istabai
    $player = User::factory()->create();
    $this->actingAs($player)->get("/joinroom/{$room->id}");

    // Radītājs arī pievienojas istabai
    $this->actingAs($creator)->get("/joinroom/{$room->id}");

    // Radītājs sāk spēli
    $this->actingAs($creator)->post("/board/{$room->id}/start-game");

    // Pārbauda, vai spēle ir izveidota un aktīva
    $this->assertDatabaseHas('card_games', [
        'room_id' => $room->id,
        'game_status' => 'in_progress',
    ]);

    // Pārbauda, vai otrais spēlētājs ir istabā
    $this->assertDatabaseHas('room_user', [
        'room_id' => $room->id,
        'user_id' => $player->id,
    ]);
});

// Tests pārbauda, vai spēli var sākt ar tikai vienu cilvēku — sistēmai automātiski jāpievieno bots:
// 1. Izveido istabu ar max_players=2
// 2. Tikai radītājs pievienojas
// 3. Radītājs nosūta start-game — sistēma pievieno botu
// 4. Pārbauda, vai spēle ir sākusies un datubāzē ir bota ieraksts
test('Spēli var sākt ar vienu cilvēka spēlētāju, pievienojot botu', function () {
    // Izveido istabu ar noteikumu max 2 spēlētāji
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

    // Tikai radītājs pievienojas un mēģina sākt spēli
    $this->actingAs($creator)->get("/joinroom/{$room->id}");
    $this->actingAs($creator)->post("/board/{$room->id}/start-game");

    // Pārbauda, vai spēle ir sākusies
    $this->assertDatabaseHas('card_games', [
        'room_id' => $room->id,
        'game_status' => 'in_progress',
    ]);

    // Pārbauda, vai sistēma ir automātiski pievienojusi botu
    $botId = User::query()->where('role', 'bot')->value('id');
    expect($botId)->not()->toBeNull();

    // Pārbauda, vai bots ir pievienots istabai
    $this->assertDatabaseHas('room_user', [
        'room_id' => $room->id,
        'user_id' => $botId,
    ]);
});
