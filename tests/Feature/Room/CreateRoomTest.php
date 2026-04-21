<?php

namespace Tests\Feature;

use App\Models\User;
use App\Models\Room;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

test('Autorizēts lietotājs var izveidot spēles istabu un spēles istabas dati tiek saglabāti datubāzē', function () {
    $user = User::factory()->create([
        'email' => 'email-test@example.com',
        'password' => bcrypt('password'),
    ]);

    $response = $this->actingAs($user)
        ->post('/storeRules', [
            'room_name' => 'My Room',
            'public' => true,
            'max_players' => 4,
            'bot_fill_count' => 2,
            'bot_difficulty' => 'hard',
            'rules' => ['pick_up_till_match'],
        ]);
    $response->assertRedirectContains('/board/');

    $this->assertDatabaseHas('rooms', [
        'room_name' => 'My Room',
        'created_by' => $user->id,
    ]);

    $room = Room::query()->where('created_by', $user->id)->where('room_name', 'My Room')->first();

    expect($room)->not()->toBeNull();

    $this->assertDatabaseHas('room_rules', [
        'room_id' => $room->id,
        'bot_fill_count' => 2,
        'bot_difficulty' => 'hard',
    ]);

});
