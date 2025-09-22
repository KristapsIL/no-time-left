import React, { useState } from "react";
import AppLayout from '@/layouts/app-layout';
import { Head, router } from "@inertiajs/react";



function CreateRoom() {
    const [isPublic, setIsPublic] = useState(true);
    const [maxPlayers, setMaxPlayers] = useState(2);
    const [rules, setRules] = useState<string[]>([]);

    const handleRuleChange = (rule: string) => {
        setRules((prev) =>
        prev.includes(rule) ? prev.filter((r) => r !== rule) : [...prev, rule]
        );
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        router.post("/storeRules", {
        public: isPublic,
        max_players: maxPlayers,
        rules: rules,
        });
    };

    return (
        <AppLayout>
            <Head title="Create Room" />
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div>
                    <label className="block mb-1">Room Name</label>
                    <input
                        type="input" 
                    />
                </div>
                <div>
                    <label className="block mb-1">Public Room?</label>
                    <input
                        type="checkbox"
                        checked={isPublic}
                        onChange={(e) => setIsPublic(e.target.checked)}
                    />
                </div>

                <div>
                    <label className="block mb-1">Max Players</label>
                    <input
                        type="number"
                        value={maxPlayers}
                        min={2}
                        max={4}
                        onChange={(e) => setMaxPlayers(Number(e.target.value))}
                        className="border px-2 py-1 rounded"
                    />
                </div>

                <div>
                    <label className="block mb-2">Rules</label>
                    <div>
                        <label className="flex gap-2">
                            <input
                                type="checkbox"
                                checked={rules.includes("two_plus_two")}
                                onChange={() => handleRuleChange("two_plus_two")} />
                            2 adds +2 cards
                        </label>

                        <label className="flex gap-2">
                            <input
                                type="checkbox"
                                checked={rules.includes("queen_time_loss")}
                                onChange={() => handleRuleChange("queen_time_loss")}
                            />
                            Queen takes away time
                        </label>
                    </div>
                </div>

                <button type="submit" className="px-3 py-1 rounded bg-indigo-600 text-white">
                Create Room
                </button>
            </form>
        </AppLayout>
    );
}
export default CreateRoom;
