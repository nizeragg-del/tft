import React, { useEffect, useState } from 'react';
import { supabase } from './supabase';
import { User } from './types';
import { Swords, Search, Loader2, X, Trophy, Users, UserPlus, Trash2, Circle, Mail } from 'lucide-react';
import { PartyLobby } from './PartyLobby';

interface MatchmakingProps {
    user: User;
    onMatchFound: (matchId: string, opponent: { id: string; username: string; elo: number }) => void;
}

export const Matchmaking: React.FC<MatchmakingProps> = ({ user, onMatchFound }) => {
    const [searching, setSearching] = useState(false);
    const [matchId, setMatchId] = useState<string | null>(null);
    const [partyId, setPartyId] = useState<string | null>(null);
    const [onlineCount, setOnlineCount] = useState(1);
    const [friends, setFriends] = useState<any[]>([]);
    const [searchNickname, setSearchNickname] = useState('');
    const [socialLoading, setSocialLoading] = useState(false);

    useEffect(() => {
        // 1. Setup Presence for Online Count
        const lobbyChannel = supabase.channel('lobby:public', {
            config: {
                presence: { key: user.id }
            }
        });

        lobbyChannel
            .on('presence', { event: 'sync' }, () => {
                const state = lobbyChannel.presenceState();
                setOnlineCount(Object.keys(state).length);
            })
            .subscribe(async (status) => {
                if (status === 'SUBSCRIBED') {
                    await lobbyChannel.track({
                        online_at: new Date().toISOString(),
                        user_id: user.id,
                        username: user.username
                    });
                }
            });

        // 2. Initial Fetch of Friends
        fetchFriends();

        return () => {
            supabase.removeChannel(lobbyChannel);
        };
    }, [user]);

    // Handle party-wide matchmaking signals
    useEffect(() => {
        if (!partyId) return;

        const partyChannel = supabase.channel(`party:${partyId}`)
            .on('broadcast', { event: 'start_searching' }, (payload) => {
                if (!searching) {
                    if (payload.payload.match_id) {
                        // Leader already created a match, join it
                        joinExistingMatch(payload.payload.match_id);
                    } else {
                        // For solo or if leader didn't provide ID (legacy)
                        findMatch();
                    }
                }
            })
            .on('broadcast', { event: 'cancel_searching' }, () => {
                cancelSearch();
            })
            .subscribe();

        return () => { supabase.removeChannel(partyChannel); };
    }, [partyId, searching]);

    const fetchFriends = async () => {
        const { data } = await supabase
            .from('friends')
            .select(`
                friend:users!friends_friend_id_fkey(*)
            `)
            .eq('user_id', user.id);

        if (data) {
            setFriends(data.map(f => f.friend));
        }
    };

    const addFriend = async () => {
        if (!searchNickname.trim()) return;
        setSocialLoading(true);

        const { data: targetUser, error: userError } = await supabase
            .from('users')
            .select('*')
            .eq('username', searchNickname)
            .single();

        if (userError || !targetUser) {
            alert('User not found');
            setSocialLoading(false);
            return;
        }

        if (targetUser.id === user.id) {
            alert('You cannot add yourself');
            setSocialLoading(false);
            return;
        }

        const { error: friendError } = await supabase
            .from('friends')
            .insert([{
                user_id: user.id,
                friend_id: targetUser.id,
                status: 'accepted'
            }]);

        if (friendError) {
            if (friendError.code === '23505') alert('Already friends');
            else alert('Error adding friend');
        } else {
            setSearchNickname('');
            fetchFriends();
        }
        setSocialLoading(false);
    };

    const removeFriend = async (friendId: string) => {
        const { error } = await supabase
            .from('friends')
            .delete()
            .eq('user_id', user.id)
            .eq('friend_id', friendId);

        if (!error) fetchFriends();
    };

    const findMatch = async (forceMatchId?: string) => {
        setSearching(true);

        if (forceMatchId) {
            joinExistingMatch(forceMatchId);
            return;
        }

        const { data: waitingMatches } = await supabase
            .from('matches')
            .select('*')
            .eq('status', 'waiting')
            .neq('player1_id', user.id)
            .limit(1);

        if (waitingMatches && waitingMatches.length > 0) {
            const match = waitingMatches[0];
            joinExistingMatch(match.id);
        } else {
            const { data: newMatch } = await supabase
                .from('matches')
                .insert([{ player1_id: user.id, status: 'waiting' }])
                .select().single();

            if (newMatch) {
                setMatchId(newMatch.id);
                // If in a party, let others know about this match
                if (partyId) {
                    supabase.channel(`party:${partyId}`).send({
                        type: 'broadcast',
                        event: 'start_searching',
                        payload: { match_id: newMatch.id }
                    });
                }

                const channel = supabase.channel(`match:${newMatch.id}`)
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

    const joinExistingMatch = async (id: string) => {
        setSearching(true);
        const { error: joinError } = await supabase
            .from('matches')
            .update({ player2_id: user.id, status: 'in_progress' })
            .eq('id', id);

        if (!joinError) {
            const { data: matchData } = await supabase.from('matches').select('*').eq('id', id).single();
            if (matchData) {
                const oppId = matchData.player1_id === user.id ? matchData.player2_id : matchData.player1_id;
                if (oppId) fetchOpponentAndStart(id, oppId);
            }
        } else {
            // If failed to join (e.g. already full), fall back to finding another
            setSearching(false);
            findMatch();
        }
    };

    const fetchOpponentAndStart = async (id: string, oppId: string) => {
        const { data: oppProfile } = await supabase.from('users').select('*').eq('id', oppId).single();
        if (oppProfile) onMatchFound(id, oppProfile);
    };

    const cancelSearch = async () => {
        if (matchId) {
            await supabase.from('matches').delete().eq('id', matchId);
        }
        setSearching(false);
        setMatchId(null);
    };

    const inviteFriend = async (friendId: string) => {
        if (!partyId) {
            alert('Create a party first to invite friends!');
            return;
        }

        const inviteChannel = supabase.channel(`invites:${friendId}`);
        await inviteChannel.subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
                await inviteChannel.send({
                    type: 'broadcast',
                    event: 'party_invite',
                    payload: {
                        party_id: partyId,
                        leader_name: user.username,
                        leader_id: user.id
                    }
                });
                alert('Invitation sent!');
                supabase.removeChannel(inviteChannel);
            }
        });
    };

    const startPartySearch = () => {
        if (!partyId) {
            findMatch();
            return;
        }

        supabase.channel(`party:${partyId}`).send({
            type: 'broadcast',
            event: 'start_searching',
            payload: {}
        });

        findMatch();
    };

    const stopPartySearch = () => {
        if (partyId) {
            supabase.channel(`party:${partyId}`).send({
                type: 'broadcast',
                event: 'cancel_searching',
                payload: {}
            });
        }
        cancelSearch();
    };

    return (
        <div className="flex flex-col lg:flex-row items-center lg:items-start justify-center h-full p-4 lg:p-8 gap-8 overflow-y-auto">
            {/* Social / Friends Side Panel */}
            <div className="w-full lg:w-80 space-y-4 flex flex-col h-[600px] lg:h-full">
                {/* Party Lobby Section */}
                <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-3xl p-6 flex flex-col min-h-[300px]">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-lg">
                            <Users size={20} className="text-blue-400" />
                        </div>
                        <h3 className="text-lg font-bold text-white uppercase tracking-tight">Party Lobby</h3>
                    </div>
                    <PartyLobby
                        user={user}
                        partyId={partyId}
                        onPartyJoined={(id) => setPartyId(id)}
                        onPartyLeft={() => setPartyId(null)}
                    />
                </div>

                {/* Friends List Section */}
                <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-3xl p-6 flex flex-col flex-1 min-h-[300px]">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 bg-purple-500/20 rounded-lg">
                            <Users size={20} className="text-purple-400" />
                        </div>
                        <h3 className="text-lg font-bold text-white uppercase tracking-tight">Nexus Friends</h3>
                    </div>

                    <div className="relative mb-6">
                        <input
                            type="text"
                            placeholder="Add by nickname..."
                            value={searchNickname}
                            onChange={(e) => setSearchNickname(e.target.value)}
                            className="w-full bg-black/40 border border-white/10 rounded-xl py-3 pl-4 pr-12 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all font-medium"
                            onKeyDown={(e) => e.key === 'Enter' && addFriend()}
                        />
                        <button
                            onClick={addFriend}
                            disabled={socialLoading}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-purple-400 hover:text-white transition-colors"
                        >
                            {socialLoading ? <Loader2 size={18} className="animate-spin" /> : <UserPlus size={18} />}
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-thin scrollbar-thumb-white/10">
                        {friends.length === 0 ? (
                            <div className="text-center py-6">
                                <Users size={24} className="text-slate-700 mx-auto mb-3 opacity-20" />
                                <p className="text-slate-600 text-xs font-medium">No friends yet.</p>
                            </div>
                        ) : (
                            friends.map((friend) => (
                                <div key={friend.id} className="group flex items-center gap-3 p-3 bg-white/5 hover:bg-white/10 border border-white/5 rounded-2xl transition-all">
                                    <div className="w-10 h-10 bg-gradient-to-br from-slate-700 to-slate-800 rounded-xl flex items-center justify-center font-bold text-slate-400 uppercase">
                                        {friend.username[0]}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-sm font-bold text-white truncate">{friend.username}</div>
                                        <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{friend.elo} ELO</div>
                                    </div>
                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        {partyId && (
                                            <button
                                                onClick={() => inviteFriend(friend.id)}
                                                className="p-2 text-blue-400 hover:text-blue-300 transition-colors"
                                                title="Invite to Party"
                                            >
                                                <Mail size={16} />
                                            </button>
                                        )}
                                        <button
                                            onClick={() => removeFriend(friend.id)}
                                            className="p-2 text-slate-600 hover:text-rose-500 transition-colors"
                                            title="Remove Friend"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* Main Matchmaking Card */}
            <div className="flex-1 flex flex-col items-center justify-center max-w-md w-full">
                {!searching ? (
                    <div className="space-y-6 w-full animate-in fade-in zoom-in duration-500">
                        {/* Status Header */}
                        <div className="flex items-center justify-between w-full mb-4">
                            <div className="flex items-center gap-2 bg-emerald-500/10 px-3 py-1.5 rounded-full border border-emerald-500/20">
                                <Circle size={8} className="fill-emerald-500 text-emerald-500 animate-pulse" />
                                <span className="text-xs font-bold text-emerald-400 uppercase tracking-widest">
                                    {onlineCount} Players Online
                                </span>
                            </div>
                        </div>

                        <div className="w-24 h-24 bg-gradient-to-br from-purple-500 to-blue-600 rounded-3xl flex items-center justify-center mx-auto shadow-2xl shadow-purple-500/20 rotate-12 group-hover:rotate-0 transition-transform">
                            <Swords size={48} className="text-white -rotate-12" />
                        </div>
                        <div>
                            <h2 className="text-3xl font-black text-white uppercase tracking-tight italic">
                                Ready for <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-400">Battle</span>?
                            </h2>
                            <p className="text-slate-400 mt-2 font-medium">Test your tactics contra Commanders across the Nexus.</p>
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
                            onClick={startPartySearch}
                            className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-black py-4 rounded-2xl shadow-xl shadow-purple-500/20 transition-all active:scale-95 flex items-center justify-center gap-3 group text-lg"
                        >
                            {partyId ? 'START PARTY QUEUE' : 'FIND MATCH'}
                            <Search size={20} className="group-hover:translate-x-1 transition-transform" />
                        </button>
                    </div>
                ) : (
                    <div className="space-y-8 animate-in fade-in duration-300 w-full">
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
                            onClick={stopPartySearch}
                            className="px-8 py-3 bg-white/5 hover:bg-rose-500/10 border border-white/10 hover:border-rose-500/20 text-slate-400 hover:text-rose-500 rounded-xl font-bold transition-all flex items-center gap-2 mx-auto"
                        >
                            <X size={18} /> CANCEL
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};
