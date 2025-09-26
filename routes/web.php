<?php

use Illuminate\Support\Facades\Route;
use Inertia\Inertia;
use App\Http\Controllers\CardGameController;
use App\Http\Controllers\RoomController;

// Public routes
Route::get('/', function () {
    return Inertia::render('welcome');
})->name('home');

// Test event trigger (for development/testing)
Route::get('/trigger-event', function() {
    broadcast(new \App\Events\MyEvent("Hello from Laravel!"));
    return "Event sent!";
});

Route::middleware(['auth', 'verified'])->group(function () {

    Route::get('/dashboard', function () {
        return Inertia::render('dashboard');
    })->name('dashboard');

    Route::get('/board/{roomId}', [CardGameController::class, 'board'])->name('board');
    Route::post('/board/{roomId}/shuffle', [CardGameController::class, 'shuffle'])->name('board.shuffle');
    Route::post('/board/{roomId}/reset', [CardGameController::class, 'reset'])->name('board.reset');
    Route::post('/board/{roomId}/start-game', [CardGameController::class, 'startGame'] )->name('startGame');
    Route::post('/board/{roomId}/play-card', [CardGameController::class, 'playCard']);
    Route::post('/board/{roomId}/pickup', [CardGameController::class, 'pickUpCard']);
    Route::get('/board/{room}/resync-state', [CardGameController::class, 'resyncState']);

    Route::get('/createRoom', [RoomController::class, 'createRoom'])->name('createRoom');
    Route::post('/storeRules', [RoomController::class, 'store'])->name('storeRules');
    Route::get('/findRoom', [RoomController::class, 'findRoom'])->name('findRoom');
    Route::get('/joinroom/{roomId}', [RoomController::class, 'joinRoom'])->name('joinRoom');
    Route::delete('/leaveroom/{roomId}', [RoomController::class, 'leaveRoom'])->name('leaveRoom');
    Route::get('/rooms/{room}/resync-hand', [RoomController::class, 'resyncHand']);
    
    Route::get('/test-event', [RoomController::class, 'test'])->name('test-event');
    
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
     
    // Room-specific chat API
    Route::post('/send-room-message', function(\Illuminate\Http\Request $request) {
        $request->validate([
            'message' => 'required|string|max:255',
            'roomId' => 'required|integer|exists:rooms,id'
        ]);
        
        $user = $request->user();
        $roomId = $request->roomId;
        
        $room = \App\Models\Room::findOrFail($roomId);
        
        broadcast(new \App\Events\MyEvent(
            $request->message,
            [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email
            ],
            $roomId
        ));
        
        return response()->json(['success' => true]);
    })->name('send-room-message');
});


require __DIR__.'/settings.php';
require __DIR__.'/auth.php';
