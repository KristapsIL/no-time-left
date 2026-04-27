<?php

namespace Tests\Feature;

use App\Models\User;
use App\Models\Room;
use Illuminate\Foundation\Testing\RefreshDatabase;

// Katrs tests tiek izpildīts ar tīru datubāzi — izmaiņas netiek saglabātas starp testiem
uses(RefreshDatabase::class);

// Tests pārbauda pilnu istabas izveides procesu:
// 1. Izveido testa lietotāju
// 2. Nosūta POST pieprasījumu uz /storeRules ar istabas datiem
// 3. Pārbauda, vai atbilde novirza uz /board/ (istaba veiksmīgi izveidota)
// 4. Pārbauda, vai istabas ieraksts ir saglabāts datubāzē
// 5. Pārbauda, vai istabas noteikumi (room_rules) arī ir saglabāti ar pareizām vērtībām
test('Autorizēts lietotājs var izveidot spēles istabu un spēles istabas dati tiek saglabāti datubāzē', function () {
    // Izveido testa lietotāju ar zināmiem datiem
    $user = User::factory()->create([
        'email' => 'email-test@example.com',
        'password' => bcrypt('password'),
    ]);

    // Nosūta istabas izveides formas datus kā autorizēts lietotājs
    $response = $this->actingAs($user)
        ->post('/storeRules', [
            'room_name' => 'My Room',
            'public' => true,
            'max_players' => 4,
            'bot_fill_count' => 2,       // 2 boti aizpilda brīvās vietas
            'bot_difficulty' => 'hard',  // botu grūtības pakāpe
            'rules' => ['pick_up_till_match'], // īpašais noteikums
        ]);

    // Pēc veiksmīgas izveides jānovirza uz spēles galdu
    $response->assertRedirectContains('/board/');

    // Pārbauda, vai istaba ir saglabāta datubāzē
    $this->assertDatabaseHas('rooms', [
        'room_name' => 'My Room',
        'created_by' => $user->id,
    ]);

    // Iegūst izveidoto istabu no datubāzes turpmākai pārbaudei
    $room = Room::query()->where('created_by', $user->id)->where('room_name', 'My Room')->first();

    // Pārbauda, ka istaba tiešām ir atrasta
    expect($room)->not()->toBeNull();

    // Pārbauda, vai istabas noteikumi ir saglabāti ar pareizām vērtībām
    $this->assertDatabaseHas('room_rules', [
        'room_id' => $room->id,
        'bot_fill_count' => 2,
        'bot_difficulty' => 'hard',
    ]);

});
