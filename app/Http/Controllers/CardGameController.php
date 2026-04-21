<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Inertia\Inertia;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Collection;

use App\Models\Room;
use App\Models\RoomRules;
use App\Models\CardGame;
use App\Models\User;

use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

use App\Events\GameStarted;
use App\Events\HandSynced;

class CardGameController extends Controller
{
    protected function ensureRoomMembership(Room $room, int $userId): void
    {
        if (!$room->players()->where('users.id', $userId)->exists()) {
            abort(403, 'You must join this room first.');
        }
    }

    protected function ensureMinimumPlayersWithBots(Room $room): void
    {
        $rules = $room->rules;
        $configuredBots = max(0, (int) ($rules?->bot_fill_count ?? 1));
        $maxPlayers = max(2, (int) ($rules?->max_players ?? 4));
        $targetPlayers = min($maxPlayers, max(2, $room->players()->count() + $configuredBots));

        $currentCount = $room->players()->count();

        while ($currentCount < $targetPlayers) {
            $bot = User::query()->forceCreate([
                'name'              => 'Bot ' . strtoupper(Str::random(4)),
                'role'              => 'bot',
                'email'             => 'bot+' . Str::uuid() . '@no-time-left.local',
                'email_verified_at' => now(),
                'password'          => Hash::make(Str::random(32)),
            ]);

            DB::table('room_user')->updateOrInsert(
                ['user_id' => $bot->id],
                [
                    'room_id'    => $room->id,
                    'updated_at' => now(),
                    'created_at' => now(),
                ]
            );

            $currentCount++;
        }
    }

    protected function isBotUserId(int $userId): bool
    {
        return User::query()->whereKey($userId)->where('role', 'bot')->exists();
    }

    protected function nextPlayerId(Room $room, ?int $currentTurn): ?int
    {
        $playerIds = $room->players()
            ->orderBy('room_user.created_at')
            ->pluck('users.id')
            ->toArray();

        if (empty($playerIds)) {
            return null;
        }

        $currentIndex = array_search($currentTurn, $playerIds, true);
        if ($currentIndex === false) {
            $currentIndex = -1;
        }

        $nextIndex = ($currentIndex + 1) % count($playerIds);

        return $playerIds[$nextIndex] ?? null;
    }

    protected function runBotTurns(int $roomId): void
    {
        for ($i = 0; $i < 50; $i++) {
            $action = DB::transaction(function () use ($roomId) {
                $room = Room::with(['game', 'players', 'rules'])->lockForUpdate()->findOrFail($roomId);
                $game = $room->game;

                if (!$game || $game->game_status !== 'in_progress' || $game->current_turn === null) {
                    return null;
                }

                $turnPlayerId = (int) $game->current_turn;
                if (!$this->isBotUserId($turnPlayerId)) {
                    return null;
                }

                $hands = $game->player_hands ?? [];
                $playerKey = (string) $turnPlayerId;
                $hand = $hands[$playerKey] ?? [];
                $usedCards = $game->used_cards ?? [];
                $topCard = !empty($usedCards) ? $usedCards[array_key_last($usedCards)] : null;
                $difficulty = strtolower((string) ($room->rules?->bot_difficulty ?? 'medium'));
                $roomRules = $room->rules?->rules ?? [];
                $pickUpTillMatch = is_array($roomRules) && in_array('pick_up_till_match', $roomRules, true);

                if (!in_array($difficulty, ['easy', 'medium', 'hard'], true)) {
                    $difficulty = 'medium';
                }

                $playable = $this->chooseBotCard($hand, $topCard, $difficulty);

                if ($playable !== null) {
                    $idx = array_search($playable, $hand, true);
                    if ($idx !== false) {
                        array_splice($hand, $idx, 1);
                    }

                    $hands[$playerKey] = $hand;
                    $usedCards[] = $playable;

                    $finished = count($hand) === 0;
                    $winnerId = $finished ? $turnPlayerId : null;
                    $nextTurn = $finished ? null : $this->nextPlayerId($room, $turnPlayerId);

                    $game->player_hands = $hands;
                    $game->used_cards = array_values($usedCards);
                    $game->current_turn = $nextTurn;
                    $game->has_picked_up = false;
                    $game->game_status = $finished ? 'finished' : 'in_progress';
                    if ($finished) {
                        $game->winner = $winnerId;
                    }
                    $game->save();

                    return [
                        'kind'       => 'play',
                        'room_id'    => $game->room_id,
                        'user_id'    => $turnPlayerId,
                        'card'       => $playable,
                        'used_cards' => $game->used_cards,
                        'hand_counts'=> collect($hands)->map(fn ($h) => count($h))->toArray(),
                        'deck_count' => count($game->deck ?? []),
                        'turn'       => $game->current_turn,
                        'finished'   => $finished,
                        'winner_id'  => $winnerId,
                    ];
                }

                $deck = $game->deck ?? [];
                $this->checkDeckAndReshuffle($deck, $game);
                $deck = $game->deck ?? $deck;

                $drawnPlayable = null;
                do {
                    if (count($deck) === 0) {
                        break;
                    }

                    $drawn = array_shift($deck);
                    $hand[] = $drawn;
                    $hands[$playerKey] = $hand;

                    $topCardAfterDraw = !empty($usedCards) ? $usedCards[array_key_last($usedCards)] : null;
                    if ($topCardAfterDraw && $this->isValidPlay($drawn, $topCardAfterDraw)) {
                        $drawnPlayable = $drawn;
                        break;
                    }
                } while ($pickUpTillMatch);

                if ($drawnPlayable !== null) {
                    $idx = array_search($drawnPlayable, $hand, true);
                    if ($idx !== false) {
                        array_splice($hand, $idx, 1);
                    }

                    $hands[$playerKey] = $hand;
                    $usedCards[] = $drawnPlayable;

                    $finished = count($hand) === 0;
                    $winnerId = $finished ? $turnPlayerId : null;
                    $nextTurn = $finished ? null : $this->nextPlayerId($room, $turnPlayerId);

                    $game->player_hands = $hands;
                    $game->deck = array_values($deck);
                    $game->used_cards = array_values($usedCards);
                    $game->current_turn = $nextTurn;
                    $game->has_picked_up = false;
                    $game->game_status = $finished ? 'finished' : 'in_progress';
                    if ($finished) {
                        $game->winner = $winnerId;
                    }
                    $game->save();

                    return [
                        'kind'       => 'play',
                        'room_id'    => $game->room_id,
                        'user_id'    => $turnPlayerId,
                        'card'       => $drawnPlayable,
                        'used_cards' => $game->used_cards,
                        'hand_counts'=> collect($hands)->map(fn ($h) => count($h))->toArray(),
                        'deck_count' => count($game->deck ?? []),
                        'turn'       => $game->current_turn,
                        'finished'   => $finished,
                        'winner_id'  => $winnerId,
                    ];
                }

                $game->player_hands = $hands;
                $game->deck = array_values($deck);

                $nextTurn = $this->nextPlayerId($room, $turnPlayerId);
                $game->current_turn = $nextTurn;
                $game->has_picked_up = false;
                $game->save();

                return [
                    'kind'       => 'pass',
                    'room_id'    => $game->room_id,
                    'user_id'    => $turnPlayerId,
                    'card'       => '',
                    'used_cards' => $game->used_cards ?? [],
                    'hand_counts'=> collect($game->player_hands ?? [])->map(fn ($h) => count($h))->toArray(),
                    'deck_count' => count($game->deck ?? []),
                    'turn'       => $game->current_turn,
                    'finished'   => false,
                    'winner_id'  => null,
                ];
            });

            if (!$action) {
                break;
            }

            if (!empty($action['finished'])) {
                broadcast(new \App\Events\GameFinished(
                    roomId: $action['room_id'],
                    winnerId: $action['winner_id'],
                    handCounts: $action['hand_counts'],
                ));

                break;
            }

            broadcast(new \App\Events\CardPlayed(
                roomId: $action['room_id'],
                userId: $action['user_id'],
                card: $action['card'],
                handCounts: $action['hand_counts'],
                deckCount: $action['deck_count'],
                turnPlayerId: $action['turn'],
                usedCards: $action['used_cards'],
            ));
        }
    }

    protected function chooseBotCard(array $hand, ?string $topCard, string $difficulty): ?string
    {
        $playable = [];

        foreach ($hand as $candidate) {
            if ($topCard === null || $this->isValidPlay($candidate, $topCard)) {
                $playable[] = $candidate;
            }
        }

        if (empty($playable)) {
            return null;
        }

        if ($difficulty === 'easy') {
            return $playable[0];
        }

        $suitCounts = [];
        $valueCounts = [];
        foreach ($hand as $card) {
            [$value, $suit] = $this->splitCard($card);
            $suitCounts[$suit] = ($suitCounts[$suit] ?? 0) + 1;
            $valueCounts[$value] = ($valueCounts[$value] ?? 0) + 1;
        }

        $topValue = null;
        $topSuit = null;
        if ($topCard !== null) {
            [$topValue, $topSuit] = $this->splitCard($topCard);
        }

        $bestCard = $playable[0];
        $bestScore = -INF;

        foreach ($playable as $candidate) {
            [$value, $suit] = $this->splitCard($candidate);

            $score = 0.0;
            $score += ($suitCounts[$suit] ?? 0) * 2.0;
            $score += ($valueCounts[$value] ?? 0) * 1.4;

            if ($topSuit !== null && $suit === $topSuit) {
                $score += 1.0;
            }

            if ($topValue !== null && $value === $topValue) {
                $score += 1.2;
            }

            if ($difficulty === 'hard') {
                $score += ($suitCounts[$suit] ?? 0) * 1.5;
                $score += ($valueCounts[$value] ?? 0) * 1.2;

                if (in_array($value, ['A', 'K', 'Q', 'J'], true)) {
                    $score -= 0.8;
                }

                if (($suitCounts[$suit] ?? 0) <= 1 && ($valueCounts[$value] ?? 0) <= 1) {
                    $score -= 1.3;
                }
            }

            if ($score > $bestScore) {
                $bestScore = $score;
                $bestCard = $candidate;
            }
        }

        return $bestCard;
    }

    public function board(Request $request, int $roomId)
    {
        $user = $request->user();

        $inRoom = $user->rooms()->where('rooms.id', $roomId)->exists();
        if (! $inRoom) {
            return redirect()
                ->route('findRoom')
                ->with('error', 'Join the room before opening the board.');
        }

        [$room, $game] = DB::transaction(function () use ($roomId) {
            $room = Room::query()
                ->whereKey($roomId)
                ->with(['players', 'rules']) 
                ->lockForUpdate()
                ->firstOrFail();

            $game = CardGame::firstOrCreate(
                ['room_id' => $room->id],
                [
                    'deck'        => $this->buildDeck(),
                    'game_status' => 'waiting',
                ]
            );

            if ($game->game_status === 'waiting' && empty($game->deck)) {
                $game->deck = $this->buildDeck();
                $game->save();
            }

            return [$room, $game];
        });

        $playerHands = $game->player_hands ?? [];
        $myHand      = $playerHands[(string) $user->id] ?? [];
        $handCounts  = collect($playerHands)->map(fn ($cards) => is_array($cards) ? count($cards) : 0)->toArray();

        $roomArray = $room->toArray();
        $roomArray['code'] = $room->room_code; 

        return Inertia::render('cardgame/Board', [
            'room'        => $roomArray,
            'deck'        => array_values($game->deck ?? []),
            'usedCards'   => array_values($game->used_cards ?? []),
            'handCounts'  => $handCounts,
            'myHand'      => array_values($myHand),
            'gameStatus'  => $game->game_status,
            'currentTurn' => $game->current_turn,
            'winnerId'    => $game->winner,
            'userId'      => $user->id,
        ]);
    }


    public function reset(Request $request, int $roomId): \Illuminate\Http\JsonResponse
    {
        $userId = (int) $request->user()->id;

        DB::transaction(function () use ($roomId, $userId) {
            $room = Room::with(['game', 'players'])->lockForUpdate()->findOrFail($roomId);
            $this->ensureRoomMembership($room, $userId);

            $game = $room->game;
            if (!$game) {
                abort(422, 'Game not initialized.');
            }

            $game->player_hands = [];
            $game->used_cards   = [];
            $game->deck         = []; 
            $game->current_turn = null;
            $game->winner    = null;
            $game->game_status  = 'waiting';
            $game->save();

            broadcast(new \App\Events\GameReset($roomId));
        });

        return response()->json(['ok' => true], 200);
    }

    protected function buildDeck(): array
    {
        $suits = ['♠', '♥', '♦', '♣'];
        $faces = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
        $deck  = [];

        foreach ($suits as $suit) {
            foreach ($faces as $face) {
                $deck[] = $face . '-' . $suit;
            }
        }

        return $deck;
    }

    protected function validateStartConditions(Room $room, int $userId): void
    {
        if (!$room->players()->whereKey($userId)->exists()) {
            throw new \Exception('You must join this room before starting the game.');
        }

        if ($room->game && $room->game->game_status === 'in_progress') {
            throw new \Exception('The game has already started!');
        }

        if ($room->players()->count() < 2) {
            throw new \Exception('At least 2 players required to start the game.');
        }
    }

    protected function dealCards(array &$deck, Collection $players, int $cardsPerPlayer): array
    {
        $hands = [];

        foreach ($players as $player) {
            $dealt = array_splice($deck, 0, $cardsPerPlayer);
            $hands[(string) $player->id] = array_values($dealt);
        }

        return $hands;
    }
    protected function initializeGame(CardGame $game, array $hands, array $deck, array $usedCards, int $firstPlayerId): void
    {
        $game->fill([
            'deck'            => array_values($deck),
            'used_cards'      => array_values($usedCards),
            'player_hands'    => $hands,
            'game_status'     => 'in_progress',
            'current_turn'    => $firstPlayerId,
            'game_started_at' => now(),
        ])->save();
    }
    public function startGame(Request $request, int $roomId)
    {
        try {
            // Iegūst pašreizējā lietotāja ID
            $userId = $request->user()->id;

            
            // Veic spēles inicializāciju transakcijā, lai nodrošinātu datu konsekvenci,
            // visas izmaiņas (spēles stāvoklis, kava, spēlētāju rokas) tiek veiktas kopā.
            // Ja kāda darbība neizdodas, transakcija tiek atcelta, lai izvairītos no nekorektiem datiem.

            [$game, $hands, $deck, $usedCards, $players] = DB::transaction(function () use ($roomId, $userId) {
                // Bloķē istabu un ielādē saistītos datus (spēlētāji, spēle, noteikumi)
                $room = Room::with(['players', 'game', 'rules'])->lockForUpdate()->findOrFail($roomId);

                $this->ensureMinimumPlayersWithBots($room);

                $room->load('players');

                // Pārbauda vai spēli drīkst sākt (piemēram, pietiek spēlētāju)
                $this->validateStartConditions($room, $userId);

                // Izveido jaunu spēles ierakstu, ja tāds neeksistē
                $game = $room->game ?? new CardGame(['room_id' => $room->id]);

                // Izveido un sajauc kāršu kavu
                $deck = $this->buildDeck();
                shuffle($deck);

                // Nosaka kāršu skaitu katram spēlētājam (pēc noteikumiem vai noklusējuma)
                $cardsPerPlayer = $room->rules->cards_per_player ?? 6;

                // Iegūst spēlētājus pievienošanās secībā
                $players = $room->players()->orderBy('room_user.created_at')->get();

                // Izdala kārtis spēlētājiem
                $hands = $this->dealCards($deck, $players, $cardsPerPlayer);

                // Paņem pirmo kārti uz galda un atzīmē kā izmantotu
                $firstCard = array_shift($deck);
                $usedCards = [$firstCard];

                // Nosaka pirmo gājienu pirmajam spēlētājam
                $firstTurnId = $players->first()->id;

                // Saglabā spēles stāvokli datubāzē (rokas, kava, izmantotās kārtis, gājiena ID)
                $this->initializeGame($game, $hands, $deck, $usedCards, $firstTurnId);

                return [$game, $hands, $deck, $usedCards, $players];
            });

            // Sagatavo datus notikumu izsūtīšanai (roku skaits, kavas skaits, pašreizējais gājiens)
            $handCounts = collect($hands)->map(fn($h) => count($h))->toArray();
            $deckCount = count($deck);
            $turnId = $game->current_turn;

            // Paziņo visiem par spēles sākumu
            broadcast(new GameStarted(
                roomId: $game->room_id,
                handCounts: $handCounts,
                usedCards: $usedCards,
                turnPlayerId: $turnId,
                deckCount: $deckCount,
                players: $players->map(fn ($p) => [
                    'id' => (int) $p->id,
                    'name' => $p->name,
                    'role' => $p->role,
                ])->values()->toArray(),
            ));

            // Sinhronizē katra spēlētāja roku individuāli
            foreach ($players as $p) {
                $pid = (int) $p->id;
                broadcast(new HandSynced(
                    roomId: $game->room_id,
                    userId: $pid,
                    hand: $hands[(string)$pid] ?? [],
                    handCounts: $handCounts,
                    deckCount: $deckCount,
                    usedCards: $usedCards,
                    turnPlayerId: $turnId,
                ));
            }

            $this->runBotTurns($game->room_id);

            // Atgriež veiksmīgu paziņojumu
            return redirect()->back()->with('success', 'Spēle sākta');
        } catch (\Exception $e) {
            // Kļūdas apstrāde ar ziņojumu
            return redirect()->back()->with('error', $e->getMessage());
        }
    }

    public function playCard(Request $request, int $roomId)
    {
        $request->validate([
            'card' => ['required', 'string', 'regex:/^(?:[2-9]|10|[JQKA])-[\x{2660}\x{2665}\x{2666}\x{2663}]$/u'],
        ]);

        $userId = (int) $request->user()->id;
        $card   = (string) $request->input('card');

        [
            $roomIdOut,
            $hand,
            $usedCards,
            $handCounts,
            $deckCount,
            $nextTurn,
            $finished,
            $winnerId
        ] = DB::transaction(function () use ($roomId, $userId, $card) {
            $room = Room::with(['game', 'players'])->lockForUpdate()->findOrFail($roomId);
            $game = $room->game;

            $this->ensureRoomMembership($room, $userId);

            if (!$game || $userId !== (int) $game->current_turn) {
                abort(422, 'Not your turn or game not initialized.');
            }

            $hands = $game->player_hands ?? [];
            $playerKey = (string) $userId;
            $hand = $hands[$playerKey] ?? [];

            $idx = array_search($card, $hand, true);
            if ($idx === false) {
                abort(422, 'Card not in hand');
            }

            $usedArr = $game->used_cards ?? [];
            $topCard = !empty($usedArr) ? end($usedArr) : null;
            if ($topCard && !$this->isValidPlay($card, $topCard)) {
                abort(422, 'Invalid play');
            }

            array_splice($hand, $idx, 1);
            $hands[$playerKey] = $hand;

            $usedArr[] = $card;

            $finished = count($hand) === 0;
            $winnerId = $finished ? $userId : null;

            $nextTurn = null;
            if (!$finished) {
                $playerIds = $room->players()
                    ->orderBy('room_user.created_at')
                    ->pluck('users.id')
                    ->toArray();

                $currentIndex = array_search($game->current_turn, $playerIds, true);
                $nextTurn = $playerIds[($currentIndex + 1) % max(count($playerIds), 1)] ?? null;
                $game->has_picked_up = false;
            }

            $game->player_hands = $hands;
            $game->used_cards   = array_values($usedArr);
            $game->current_turn = $finished ? null : $nextTurn;
            $game->game_status  = $finished ? 'finished' : 'in_progress';
            if ($finished) {
                $game->winner = $winnerId;
            }
            $game->save();

            $handCounts = collect($hands)->map(fn ($h) => count($h))->toArray();
            $deckCount  = count($game->deck ?? []);

            return [
                $game->room_id,
                $hand,
                $game->used_cards,
                $handCounts,
                $deckCount,
                $nextTurn,
                $finished,
                $winnerId,
            ];
        });

        broadcast(new \App\Events\HandSynced(
            roomId:       $roomIdOut,
            userId:       $userId,
            hand:         $hand,
            handCounts:   $handCounts,
            deckCount:    $deckCount,
            usedCards:    $usedCards,
            turnPlayerId: $finished ? null : $nextTurn,
        ));

        if ($finished) {
            broadcast(new \App\Events\GameFinished(
                roomId: $roomIdOut,
                winnerId: $winnerId,
                handCounts: $handCounts
            ));

            return response()->json([
                'finished'  => true,
                'winner_id' => $winnerId,
            ], 200);
        }

        broadcast(new \App\Events\CardPlayed(
            roomId: $roomIdOut,
            userId: $userId,
            card: $card,
            handCounts: $handCounts,
            deckCount: $deckCount,
            turnPlayerId: $nextTurn,
            usedCards: $usedCards
        ))->toOthers();

        $this->runBotTurns($roomIdOut);

        return response()->json([
            'hand'         => $hand,
            'hand_counts'  => $handCounts,
            'deck_count'   => $deckCount,
            'used_cards'   => $usedCards,
            'current_turn' => $nextTurn,
            'game_status'  => $finished ? 'finished' : 'in_progress',
        ], 200);

    }

    protected function isValidPlay(string $card, string $topCard): bool
    {
        [$cValue, $cSuit]   = $this->splitCard($card);
        [$tValue, $tSuit]   = $this->splitCard($topCard);

        return $cSuit === $tSuit || $cValue === $tValue;
    }

    protected function splitCard(string $code): array
    {
        $parts = explode('-', $code, 2);
        $value = $parts[0] ?? '';
        $suit  = $parts[1] ?? '';
        return [$value, $suit];
    }
    private function checkDeckAndReshuffle(array &$deck, \App\Models\CardGame $game): void
    {
        $used = $game->used_cards ?? [];

        if (count($deck) === 0) {
            $top = null;
            if (!empty($used)) {
                $top = array_pop($used);
            }

            if (!empty($used)) {
                shuffle($used);
                $deck = array_values($used); 
            } else {
                $deck = [];
            }

            $game->used_cards = $top ? [$top] : [];
            $game->deck       = $deck;
            $game->save();
        }
    }

    public function pickUpCard(Request $request, int $roomId)
    {
        $userId = (int) $request->user()->id;

        [$game, $hand, $handCounts, $deckCount, $drawnCard] = DB::transaction(function () use ($roomId, $userId) {
            $room = Room::with(['game', 'players'])->lockForUpdate()->findOrFail($roomId);
            $game = $room->game;

            $this->ensureRoomMembership($room, $userId);

            if (!$game || $userId !== (int) $game->current_turn) {
                abort(422, 'Not your turn or game not initialized.');
            }

            $hands = $game->player_hands ?? [];
            $deck  = $game->deck ?? [];
            $playerKey  = (string) $userId;
            $playerHand = $hands[$playerKey] ?? [];
            $drawn = null; 

            $this->checkDeckAndReshuffle($deck, $game);

            if (count($deck) === 0) {
                $handCounts = collect($hands)->map(fn ($h) => count($h))->toArray();
                return [$game, $playerHand, $handCounts, 0, null];
            }

            if ((int) $game->has_picked_up === 0) {
                $rulesRaw = RoomRules::where('room_id', $roomId)->value('rules');
                $rules = is_array($rulesRaw) ? $rulesRaw : (json_decode($rulesRaw ?? '[]', true) ?: []);
                $matchRuleExists = in_array('pick_up_till_match', $rules, true);

                $usedCards = $game->used_cards ?? [];
                $topCard   = !empty($usedCards) ? $usedCards[array_key_last($usedCards)] : null;

                do {
                    $this->checkDeckAndReshuffle($deck, $game);
                    if (count($deck) === 0) break;

                    $drawn = array_shift($deck);
                    $playerHand[] = $drawn;
                    $hands[$playerKey] = $playerHand;

                    $game->player_hands = $hands;
                    $game->deck         = $deck;
                    $game->save();

                } while ($matchRuleExists && !$this->isValidPlay($drawn, $topCard));

                $game->has_picked_up = true;
                $game->save();

            } else {
                $playerIds = $room->players()
                    ->orderBy('room_user.created_at')
                    ->pluck('users.id')
                    ->toArray();

                $currentIndex = array_search((int) $game->current_turn, $playerIds, true);
                if ($currentIndex === false) {
                    $currentIndex = -1;
                }

                $nextIndex = ($currentIndex + 1) % max(count($playerIds), 1);
                $game->current_turn  = $playerIds[$nextIndex] ?? null;
                $game->has_picked_up = false;
                $game->save();
            }

            $handCounts = collect($hands)->map(fn ($h) => count($h))->toArray();
            $deckCount  = count($deck);

            return [$game, $playerHand, $handCounts, $deckCount, $drawn];
        });

        // Broadcast after commit with consistent data
        broadcast(new \App\Events\HandSynced(
            roomId:       $game->room_id,
            userId:       $userId,
            hand:         $hand,
            handCounts:   $handCounts,
            deckCount:    $deckCount,
            usedCards:    $game->used_cards ?? [],
            turnPlayerId: $game->current_turn,
        ));

        broadcast(new \App\Events\CardPlayed(
            roomId:       $game->room_id,
            userId:       $userId,
            card:         '',
            handCounts:   $handCounts,
            deckCount:    $deckCount,
            turnPlayerId: $game->current_turn,
            usedCards:    $game->used_cards ?? [],
        ))->toOthers();

        $this->runBotTurns($game->room_id);

        return response()->json([
            'hand'         => $hand,
            'hand_counts'  => $handCounts,
            'deck_count'   => $deckCount,
            'used_cards'   => $game->used_cards ?? [],
            'current_turn' => $game->current_turn,
            'game_status'  => $game->game_status ?? 'in_progress',
        ], 200);
    }

    public function passTurn(Request $request, int $roomId)
    {
        $userId = (int) $request->user()->id;

        [$game, $handCounts, $deckCount] = DB::transaction(function () use ($roomId, $userId) {
            $room = Room::with(['game', 'players'])->lockForUpdate()->findOrFail($roomId);
            $game = $room->game;

            $this->ensureRoomMembership($room, $userId);

            if (!$game || $userId !== (int) $game->current_turn) {
                abort(422, 'Not your turn or game not initialized.');
            }

            $playerIds = $room->players()
                ->orderBy('room_user.created_at')
                ->pluck('users.id')
                ->toArray();

            $currentIndex = array_search((int) $game->current_turn, $playerIds, true);
            if ($currentIndex === false) {
                $currentIndex = -1;
            }

            $nextIndex = ($currentIndex + 1) % max(count($playerIds), 1);
            $game->current_turn  = $playerIds[$nextIndex] ?? null;
            $game->has_picked_up = false;
            $game->save();

            $hands = $game->player_hands ?? [];
            $handCounts = collect($hands)->map(fn ($h) => count($h))->toArray();
            $deckCount  = count($game->deck ?? []);

            return [$game, $handCounts, $deckCount];
        });

        broadcast(new \App\Events\CardPlayed(
            roomId:       $game->room_id,
            userId:       $userId,
            card:         '',
            handCounts:   $handCounts,
            deckCount:    $deckCount,
            turnPlayerId: $game->current_turn,
            usedCards:    $game->used_cards ?? [],
        ))->toOthers();

        $this->runBotTurns($game->room_id);

        return response()->json([
            'hand_counts'  => $handCounts,
            'deck_count'   => $deckCount,
            'used_cards'   => $game->used_cards ?? [],
            'current_turn' => $game->current_turn,
            'game_status'  => $game->game_status ?? 'in_progress',
        ], 200);
    }

    public function resyncState(Request $request, int $roomId)
    {
        $userId = $request->user()->id;

        $room = Room::with(['players', 'game'])->findOrFail($roomId);
        $game = $room->game;

        $this->ensureRoomMembership($room, $userId);

        if (!$game) {
            abort(422, 'Game not initialized.');
        }

        $hands = $game->player_hands ?? [];
        $usedCards = $game->used_cards ?? [];
        $handCounts = collect($hands)->map(fn($h) => count($h))->toArray();

        return response()->json([
            'hand'         => $hands[(string)$userId] ?? [],
            'hand_counts'  => $handCounts,
            'deck_count'   => count($game->deck ?? []),
            'used_cards'   => $usedCards,
            'current_turn' => $game->current_turn,
            'game_status'  => $game->game_status,
        ]);
    }
}
