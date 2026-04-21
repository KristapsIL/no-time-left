<?php

namespace Tests\Feature;

use App\Models\User;
use App\Models\Room;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

test('Autorizēts lietotājs var izveidot ātro AI istabu', function () {
    /** @var User $user */
    $user = User::factory()->createOne();

    $response = $this->actingAs($user)->post('/quick-ai-room');

    $response->assertRedirectContains('/board/');

    $room = Room::query()->where('created_by', $user->id)->latest('id')->first();

    expect($room)->not()->toBeNull();

    $this->assertDatabaseHas('room_user', [
        'room_id' => $room->id,
        'user_id' => $user->id,
    ]);

    $this->assertDatabaseHas('room_rules', [
        'room_id' => $room->id,
        'max_players' => 2,
        'bot_fill_count' => 1,
        'bot_difficulty' => 'medium',
    ]);
});
