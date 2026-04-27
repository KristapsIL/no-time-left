<?php

namespace Tests\Feature;

use App\Models\User;
use App\Models\Room;
use App\Models\RoomRules;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

// Katrs tests tiek izpildīts ar tīru datubāzi — izmaiņas netiek saglabātas starp testiem
uses(RefreshDatabase::class);

// Tests pārbauda, vai lietotājs var pievienoties esošai istabai:
// 1. Izveido istabas īpašnieku un istabu
// 2. Izveido otru testa lietotāju
// 3. Nosūta GET pieprasījumu uz /joinroom/{id}
// 4. Pārbauda, vai atbilde novirza uz /board/
// 5. Pārbauda, vai lietotājs ir pievienots istabai datubāzē (room_user tabula)
test('Autorizēts lietotājs var pievienoties esošai spēles istabai ', function () {
    // Izveido istabas radītāju un istabu
    $creator = User::factory()->create();
    $room = Room::factory()->create([
        'room_name' => 'My Room',
        'created_by' => $creator->id,
    ]);

    // Izveido jaunu lietotāju, kurš pievienosies istabai
    $user = User::factory()->create([
        'email' => 'email-test2@example.com',
        'password' => bcrypt('password'),
    ]);

    // Lietotājs nosūta pieprasījumu pievienoties istabai
    $response = $this->actingAs($user)->get("/joinroom/{$room->id}");

    // Pēc veiksmīgas pievienošanās jānovirza uz spēles galdu
    $response->assertRedirectContains('/board/');

    // Pārbauda, vai lietotājs ir reģistrēts kā istabas dalībnieks
    $this->assertDatabaseHas('room_user', [
        'room_id' => $room->id,
        'user_id' => $user->id,
    ]);
});

// Tests pārbauda botu aizstāšanas loģiku:
// Ja istaba ir pilna, bet tajā ir bots, jaunpienācējs cilvēks aizstāj botu
// 1. Izveido istabu ar max_players=2
// 2. Pievieno istabai radītāju + botu (istaba ir pilna)
// 3. Jauns cilvēks mēģina pievienoties
// 4. Pārbauda, vai bots ir noņemts un cilvēks ir pievienots
test('Ja gaidošā istaba ir pilna ar botu, cilvēka spēlētājs aizvieto botu', function () {
    // Izveido istabu ar noteikumu, ka max 2 spēlētāji
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

    // Izveido bota lietotāju ar 'bot' lomu
    $bot = User::query()->forceCreate([
        'name' => 'Bot TEST',
        'role' => 'bot',
        'email' => 'bot+' . Str::uuid() . '@no-time-left.local',
        'email_verified_at' => now(),
        'password' => Hash::make('password'),
    ]);

    // Pievieno radītāju un botu — istaba tagad ir pilna
    $room->players()->attach($creator->id);
    $room->players()->attach($bot->id);

    // Jauns cilvēka spēlētājs mēģina pievienoties pilnai istabai
    $user = User::factory()->create();
    $response = $this->actingAs($user)->get("/joinroom/{$room->id}");

    // Jānovirza uz galdu — pievienošanās izdevās
    $response->assertRedirectContains('/board/');

    // Pārbauda, vai jaunais cilvēks ir pievienots
    $this->assertDatabaseHas('room_user', [
        'room_id' => $room->id,
        'user_id' => $user->id,
    ]);

    // Pārbauda, vai bots ir noņemts no istabas
    $this->assertDatabaseMissing('room_user', [
        'room_id' => $room->id,
        'user_id' => $bot->id,
    ]);
});
