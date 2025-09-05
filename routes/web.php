<?php

use Illuminate\Support\Facades\Route;
use Inertia\Inertia;
use App\Http\Controllers\CardGameController;
use App\Http\Controllers\RoomController;

Route::get('/', function () {
    return Inertia::render('welcome');
})->name('home');

Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('dashboard', function () {
        return Inertia::render('dashboard');
    })->name('dashboard');

    Route::get('/board', [CardGameController::class, 'board'])->name('board');
    Route::post('/board/shuffle', [CardGameController::class, 'shuffle'])->name('board.shuffle');
    Route::post('/board/reset', [CardGameController::class, 'reset'])->name('board.reset');

    Route::get('/createRoom', [RoomController::class, 'createRoom'])->name('createRoom');
    Route::post('/storeRules', [RoomController::class, 'store']);

    Route::get('/findRoom', [RoomController::class, 'findRoom'])->name('findRoom');
});

require __DIR__.'/settings.php';
require __DIR__.'/auth.php';
