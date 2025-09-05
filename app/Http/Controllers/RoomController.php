<?php

namespace App\Http\Controllers;

use App\Models\Room;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Illuminate\Support\Str;
use Inertia\Response;


class RoomController extends Controller
{
    public function createRoom(){
        return Inertia::render('cardgame/CreateRoom');
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'public' => ['required', 'boolean'],
            'max_players' => ['required', 'integer', 'min:2', 'max:4'],
            'rules' => ['nullable', 'array'],
        ]);
        $room = Room::create([
            'room_code' => $this->uniqueCode(),
            'public' => $validated['public'],
            'max_players' => $validated['max_players'],
            'rules' => $validated['rules'] ?? [],
            'created_by' => $request->user()->id,
        ]);

        return redirect()->route('board', ['roomId' => $room->id]);
    }

    private function uniqueCode(): string
    {
        do {
            $code = strtoupper(Str::random(6));
        } while (Room::where('room_code', $code)->exists());

        return $code;
    }
    public function findRoom(){
        $rooms = Room::all();
        return Inertia::render('cardgame/FindRoom', ['rooms' => $rooms]);
    }

    public function edit(Room $room)
    {
        //
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, Room $room)
    {
        //
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(Room $room)
    {
        //
    }
}
