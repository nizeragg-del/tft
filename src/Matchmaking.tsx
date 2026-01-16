import React, { useEffect, useState } from 'react';
import { supabase } from './supabase';
import { User } from './types';
import { Swords, Search, Loader2, X, Trophy } from 'lucide-react';

interface MatchmakingProps {
    user: User;
    onMatchFound: (matchId: string, opponent: { id: string; username: string; elo: number }) => void;
}

export const Matchmaking: React.FC<MatchmakingProps> = ({ user, onMatchFound }) => {
    const [searching, setSearching] = useState(false);
    const [matchId, setMatchId] = useState<string | null>(null);

    const findMatch = async () => {
        setSearching(true);

        // 1. Look for waiting matches
        const { data: waitingMatches, error: searchError } = await supabase
            .from('matches')
            .select('*')
            .eq('status', 'waiting')
            .neq('player1_id', user.id)
            .limit(1);

        if (waitingMatches && waitingMatches.length > 0) {
            const match = waitingMatches[0];
            // 2. Join match
            const { error: joinError } = await supabase
                .from('matches')
                .update({
                    player2_id: user.id,
                    status: 'in_progress'
                })
                .eq('id', match.id);

            if (!joinError) {
                // Get opponent profile
                const { data: oppProfile } = await supabase
                    .from('users')
                    .select('*')
                    .eq('id', match.player1_id)
                    .single();

                if (oppProfile) {
                    onMatchFound(match.id, oppProfile);
                }
            }
        } else {
            // 3. Create new match
            const { data: newMatch, error: createError } = await supabase
                .from('matches')
                .insert([{
                    player1_id: user.id,
                    status: 'waiting'
                }])
                .select()
                .single();

            if (newMatch) {
                setMatchId(newMatch.id);
                // Listen for player 2 joining
                const channel = supabase
                    .channel(`match:${newMatch.id}`)
                    .on('postgres_changes', {
                        event: 'UPDATE',
                        schema: 'public',
                        table: 'matches',
                        filter: `id=eq.${newMatch.id}`
                    }, (payload) => {
                        if (payload.new.status === 'in_progress' && payload.new.player2_id) {
                            fetchOpponentAndStart(newMatch.id, payload.new.player2_id);
                            supabase.removeChannel(channel);
                        }
                    })
                    .subscribe();
            }
        }
    };

    const fetchOpponentAndStart = async (id: string, oppId: string) => {
        const { data: oppProfile } = await supabase
            .from('users')
            .select('*')
            .eq('id', oppId)
            .single();

        if (oppProfile) {
            onMatchFound(id, oppProfile);
        }
    };

    const cancelSearch = async () => {
        if (matchId) {
            await supabase.from('matches').delete().eq('id', matchId);
        }
        setSearching(false);
        setMatchId(null);
    };

    return (
        <div className="flex flex-col items-center justify-center h-full p-8 text-center">
            {!searching ? (
                <div className="space-y-6 max-w-md animate-in fade-in zoom-in duration-500">
                    <div className="w-24 h-24 bg-gradient-to-br from-purple-500 to-blue-600 rounded-3xl flex items-center justify-center mx-auto shadow-2xl shadow-purple-500/20 rotate-12">
                        <Swords size={48} className="text-white -rotate-12" />
                    </div>
                    <div>
                        <h2 className="text-3xl font-black text-white uppercase tracking-tight italic">
                            Ready for <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-400">Battle</span>?
                        </h2>
                        <p className="text-slate-400 mt-2 font-medium">Test your tactics against Commanders across the Nexus.</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-white/5 border border-white/10 p-4 rounded-2xl">
                            <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1 text-left">Your Rank</div>
                            <div className="flex items-center gap-2">
                                <Trophy size={16} className="text-amber-500" />
                                <span className="text-xl font-black text-white">{user.elo}</span>
                            </div>
                        </div>
                        <div className="bg-white/5 border border-white/10 p-4 rounded-2xl">
                            <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1 text-left">Win Rate</div>
                            <div className="flex items-center gap-2">
                                <span className="text-xl font-black text-white">
                                    {user.wins + user.losses > 0
                                        ? Math.round((user.wins / (user.wins + user.losses)) * 100)
                                        : 0}%
                                </span>
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={findMatch}
                        className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-black py-4 rounded-2xl shadow-xl shadow-purple-500/20 transition-all active:scale-95 flex items-center justify-center gap-3 group text-lg"
                    >
                        FIND MATCH
                        <Search size={20} className="group-hover:translate-x-1 transition-transform" />
                    </button>
                </div>
            ) : (
                <div className="space-y-8 animate-in fade-in duration-300">
                    <div className="relative">
                        <div className="w-32 h-32 border-4 border-purple-500/20 border-t-purple-500 rounded-full animate-spin mx-auto" />
                        <div className="absolute inset-0 flex items-center justify-center">
                            <Loader2 size={32} className="text-purple-400 animate-pulse" />
                        </div>
                    </div>

                    <div>
                        <h3 className="text-2xl font-black text-white uppercase tracking-wider animate-pulse">
                            Searching <span className="text-purple-500">Opponent...</span>
                        </h3>
                        <p className="text-slate-500 mt-2 font-medium">Matching Commanders with similar skill level</p>
                    </div>

                    <button
                        onClick={cancelSearch}
                        className="px-8 py-3 bg-white/5 hover:bg-rose-500/10 border border-white/10 hover:border-rose-500/20 text-slate-400 hover:text-rose-500 rounded-xl font-bold transition-all flex items-center gap-2 mx-auto"
                    >
                        <X size={18} /> CANCEL
                    </button>
                </div>
            )}
        </div>
    );
};
