<?php

use Illuminate\Support\Facades\Route;
use Inertia\Inertia;
use App\Http\Controllers\CardGameController;
use App\Http\Controllers\RoomController;

// Public routes
Route::get('/', function () {
    return Inertia::render('welcome');
})->name('home');

Route::middleware(['auth', 'verified'])->group(function () {

    Route::get('/dashboard', function () {
        return Inertia::render('dashboard');
    })->name('dashboard');

    Route::get('/board/{roomId}', [CardGameController::class, 'board'])->name('board');
    Route::post('/board/{roomId}/reset', [CardGameController::class, 'reset'])->name('board.reset');
    Route::match(['get', 'post'], '/board/{roomId}/start-game', [CardGameController::class, 'startGame'] )->name('startGame');
    Route::post('/board/{roomId}/play-card', [CardGameController::class, 'playCard']);
    Route::post('/board/{roomId}/pickup', [CardGameController::class, 'pickUpCard']);
    Route::post('/board/{roomId}/pass-turn', [CardGameController::class, 'passTurn']);
    Route::get('/board/{roomId}/resync-state', [CardGameController::class, 'resyncState']);

    Route::get('/createRoom', [RoomController::class, 'createRoom'])->name('createRoom');
    Route::post('/storeRules', [RoomController::class, 'store'])->name('storeRules');
    Route::get('/findRoom', [RoomController::class, 'findRoom'])->name('findRoom');
    Route::get('/joinroom/{roomId}', [RoomController::class, 'joinRoom'])->name('joinRoom');
    Route::delete('/leaveroom/{roomId}', [RoomController::class, 'leaveRoom'])->name('leaveRoom');
    
    Route::post('/send-message', function(\Illuminate\Http\Request $request) {
        $request->validate([
            'message' => 'required|string|max:255'
        ]);
        
        $user = $request->user();
        broadcast(new \App\Events\MyEvent(
            $request->message,
            null, 
            [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email
            ]
        ));
        
        return response()->json(['success' => true]);
    })->name('send-message');
     
    Route::post('/send-room-message', function(\Illuminate\Http\Request $request) {
        $request->validate([
            'message' => 'required|string|max:255',
            'roomId' => 'required|integer|exists:rooms,id'
        ]);
        
        $user = $request->user();
        $roomId = $request->roomId;
        
        $room = \App\Models\Room::findOrFail($roomId);

        if (!$room->players()->where('users.id', $user->id)->exists()) {
            abort(403, 'You must be in the room to chat.');
        }

        $message = \App\Models\ChatMessage::create([
            'room_id' => $roomId,
            'user_id' => $user->id,
            'message' => $request->message,
        ]);
        
        broadcast(new \App\Events\MyEvent(
            $message->message,
            [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email
            ],
            $roomId
        ));
        
        return response()->json(['success' => true]);
    })->name('send-room-message');

    Route::get('/rooms/{room}/messages', function(\Illuminate\Http\Request $request, \App\Models\Room $room) {
        if (!$room->players()->where('users.id', $request->user()->id)->exists()) {
            abort(403, 'You must be in the room to view messages.');
        }

        $messages = \App\Models\ChatMessage::with('user')
            ->where('room_id', $room->id)
            ->latest('id')
            ->limit(100)
            ->get()
            ->reverse()
            ->values();

        return response()->json($messages);
    })->name('room.messages');
});


require __DIR__.'/settings.php';
require __DIR__.'/auth.php';
