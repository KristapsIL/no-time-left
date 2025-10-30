<?php

namespace App\Http\Controllers;

use App\Models\Room;
use App\Models\RoomRules;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\DB;

class RoomController extends Controller
{
    public function createRoom(){
        return Inertia::render('cardgame/CreateRoom');
    }

    public function store(Request $request)
    {
        //Validē ievadītos datus no formas
        $validated = $request->validate([
            'room_name'    => ['required', 'min:3', 'max:255'],
            'public'       => ['required', 'boolean'],
            'max_players'  => ['required', 'integer', 'min:2', 'max:4'],
            'rules'        => ['nullable', 'array'],
        ]);
         //Veic visu datubāzes darbību vienā transakcijā, lai kļūdas gadījumā nekas netiktu saglabāts daļēji
        return DB::transaction(function () use ($request, $validated) {
            //Izveido jaunu istabu ar unikālu kodu un lietotāju, kas to izveidoja
            $room = Room::create([
                'room_name' => $validated['room_name'],
                'room_code' => $this->uniqueCode(),
                'created_by'=> $request->user()->id,
            ]);
             //Izveido šai istabai atbilstošus noteikumus
            RoomRules::create([
                'room_id'     => $room->id,
                'public'      => $validated['public'],
                'max_players' => $validated['max_players'],
                'rules'       => $validated['rules'] ?? [],
            ]);

            //Pēc veiksmīgas izveides pāradresē lietotāju uz spēles galda lapu
            return redirect()->route('board', ['roomId' => $room->id]);
        });
    }


    private function uniqueCode(): string
    {
        do {
            $code = strtoupper(Str::random(6));
        } while (Room::where('room_code', $code)->exists());

        return $code;
    }
    /**
     * Metode, kas atrod visas spēļu istabas un nodod tās React komponentēm,
     * izmantojot Inertia.js, bez nepieciešamības veidot REST API.
     */
    public function findRoom(){
        // Iegūstam visas istabas ar noteikumiem, spēli un spēlētājiem
        $rooms = Room::with(['rules', 'game', 'players'])->get();
        // Ar Inertia palīdzību nosūtām datus uz React komponenti "FindRoom"
        return Inertia::render('cardgame/FindRoom', ['rooms' => $rooms]);
    }

    public function joinRoom(Request $request, int $roomId)
    {
        $userId = $request->user()->id;
        $room = Room::with(['game', 'players'])->findOrFail($roomId);
        
        $isExistingPlayer = $room->players()->where('user_id', $userId)->exists();
        
        if ($isExistingPlayer) {
            return redirect()->route('board', ['roomId' => $roomId])
                ->with('success', 'Welcome back! You have rejoined the game.');
        }
        
        if ($room->isGameActive()) {
            return redirect()->route('findRoom')
                ->with('error', 'Cannot join room: Game is currently in progress.');
        }
        
        $currentPlayerCount = $room->players()->count();
        $maxPlayers = $room->rules->max_players ?? 4;
        
        if ($currentPlayerCount >= $maxPlayers) {
            return redirect()->route('findRoom')
                ->with('error', 'Cannot join room: Room is full.');
        }
        
        if ($room->game && $room->game->isFinished()) {
            return redirect()->route('findRoom')
                ->with('error', 'Cannot join room: Game has finished.');
        }

        DB::table('room_user')->updateOrInsert(
            ['user_id' => $userId],
            [
                'room_id'    => $roomId,
                'updated_at' => now(),
                'created_at' => now(), 
            ]
        );

        return redirect()->route('board', ['roomId' => $roomId])
            ->with('success', 'Successfully joined the room!');
    }


    public function leaveRoom(Request $request, $roomId)
    {
        $request->user()->rooms()->detach($roomId);
        return redirect()->route('findRoom');
    }
    public function deleteRoom($roomId){
        $room = Room::findOrFail($roomId);
        $room->delete();
        return back();
    }
}
