<?php

namespace Database\Factories;

use App\Models\Room;
use App\Models\User;
use Illuminate\Support\Str;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\Room>
 */
class RoomFactory extends Factory
{
    protected $model = Room::class;
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'room_name' => $this->faker->words(2, true),
            'room_code' => strtoupper(Str::random(6)),
            'created_by' => User::factory(),
        ];
    }
}
