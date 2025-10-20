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
        $validated = $request->validate([
            'room_name'    => ['required', 'min:3', 'max:255'],
            'public'       => ['required', 'boolean'],
            'max_players'  => ['required', 'integer', 'min:2', 'max:4'],
            'rules'        => ['nullable', 'array'],
        ]);

        return DB::transaction(function () use ($request, $validated) {
            $room = Room::create([
                'room_name' => $validated['room_name'],
                'room_code' => $this->uniqueCode(),
                'created_by'=> $request->user()->id,
            ]);

            RoomRules::create([
                'room_id'     => $room->id,
                'public'      => $validated['public'],
                'max_players' => $validated['max_players'],
                'rules'       => $validated['rules'] ?? [],
            ]);

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
    public function findRoom(){
        $rooms = Room::with(['rules', 'game', 'players'])->get();
        return Inertia::render('cardgame/FindRoom', ['rooms' => $rooms]);
    }

    public function joinRoom(Request $request, int $roomId)
    {
        $userId = $request->user()->id;
        $room = Room::with(['game', 'players'])->findOrFail($roomId);
        
        // Check if user is already a player in this room
        $isExistingPlayer = $room->players()->where('user_id', $userId)->exists();
        
        // If user is already a player, allow them to rejoin regardless of game status
        if ($isExistingPlayer) {
            return redirect()->route('board', ['roomId' => $roomId])
                ->with('success', 'Welcome back! You have rejoined the game.');
        }
        
        // For new players, check if game is active
        if ($room->isGameActive()) {
            return redirect()->route('findRoom')
                ->with('error', 'Cannot join room: Game is currently in progress.');
        }
        
        // Check if room is full
        $currentPlayerCount = $room->players()->count();
        $maxPlayers = $room->rules->max_players ?? 4;
        
        if ($currentPlayerCount >= $maxPlayers) {
            return redirect()->route('findRoom')
                ->with('error', 'Cannot join room: Room is full.');
        }
        
        // Check if game is finished
        if ($room->game && $room->game->isFinished()) {
            return redirect()->route('findRoom')
                ->with('error', 'Cannot join room: Game has finished.');
        }

        // Add new player to room
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
}
