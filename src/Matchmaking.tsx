import React, { useEffect, useState } from 'react';
import { supabase } from './supabase';
import { User } from './types';
import { Swords, Search, Loader2, X, Trophy, Users, UserPlus, Trash2, Circle, Mail, Zap } from 'lucide-react';
import { PartyLobby } from './PartyLobby';

interface MatchmakingProps {
    user: User;
    onMatchFound: (matchId: string, opponent: { id: string; username: string; elo: number }) => void;
}

export const Matchmaking: React.FC<MatchmakingProps> = ({ user, onMatchFound }) => {
    const [searching, setSearching] = useState(false);
    const [searchTime, setSearchTime] = useState(0);
    const [matchId, setMatchId] = useState<string | null>(null);
    const [partyId, setPartyId] = useState<string | null>(null);
    const [onlineCount, setOnlineCount] = useState(1);
    const [friends, setFriends] = useState<any[]>([]);
    const [pendingInvites, setPendingInvites] = useState<any[]>([]);
    const [searchNickname, setSearchNickname] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [socialLoading, setSocialLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<'friends' | 'invites'>('friends');

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

        // 3. Realtime subscription for friend updates
        const friendsChannel = supabase.channel(`friends:${user.id}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'friends' }, () => {
                fetchFriends();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(lobbyChannel);
            supabase.removeChannel(friendsChannel);
        };
    }, [user]);

    // Search Timer and Timeout
    useEffect(() => {
        let interval: any;
        if (searching) {
            setSearchTime(0);
            interval = setInterval(() => {
                setSearchTime(prev => {
                    if (prev >= 300) { // 5 minutes
                        clearInterval(interval);
                        stopPartySearch();
                        alert('Matchmaking timeout. Please try again.');
                        return 0;
                    }
                    return prev + 1;
                });
            }, 1000);
        } else {
            setSearchTime(0);
            clearInterval(interval);
        }
        return () => clearInterval(interval);
    }, [searching]);

    // Handle party-wide matchmaking signals
    useEffect(() => {
        if (!partyId) return;

        const partyChannel = supabase.channel(`party:${partyId}`)
            .on('broadcast', { event: 'start_searching' }, (payload) => {
                if (!searching) {
                    if (payload.payload.match_id) {
                        // Leader already created a match, join it
                        joinExistingMatch(payload.payload.match_id);
                    } else if (payload.payload.is_bot) {
                        startBotMatch();
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
        // Fetch Accepted Friends
        const { data: accepted } = await supabase
            .from('friends')
            .select(`
                id,
                status,
                user_id,
                friend_id,
                friend:users!friends_friend_id_fkey(*),
                user:users!friends_user_id_fkey(*)
            `)
            .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`)
            .eq('status', 'accepted');

        if (accepted) {
            const mappedFriends = accepted.map((f: any) => {
                return f.user_id === user.id ? f.friend : f.user;
            });
            setFriends(mappedFriends);
        }

        // Fetch Pending Invites (Received by me)
        const { data: pending } = await supabase
            .from('friends')
            .select(`
                id,
                user:users!friends_user_id_fkey(*)
            `)
            .eq('friend_id', user.id)
            .eq('status', 'pending');

        if (pending) {
            setPendingInvites(pending.map((p: any) => ({ ...p.user, requestId: p.id })));
        }
    };

    const searchUsers = async (query: string) => {
        setSearchNickname(query);
        if (query.length < 2) {
            setSearchResults([]);
            return;
        }

        const { data } = await supabase
            .from('users')
            .select('*')
            .ilike('username', `${query}%`)
            .neq('id', user.id)
            .limit(5);

        if (data) setSearchResults(data);
    };

    const addFriend = async (targetId: string) => {
        setSocialLoading(true);
        const { error: friendError } = await supabase
            .from('friends')
            .insert([{
                user_id: user.id,
                friend_id: targetId,
                status: 'pending'
            }]);

        if (friendError) {
            if (friendError.code === '23505') alert('Request already sent or already friends');
            else alert('Error sending request');
        } else {
            setSearchNickname('');
            setSearchResults([]);
            alert('Convite enviado!');
        }
        setSocialLoading(false);
    };

    const acceptFriend = async (requestId: string) => {
        const { error } = await supabase
            .from('friends')
            .update({ status: 'accepted' })
            .eq('id', requestId);

        if (!error) fetchFriends();
        else alert('Error accepting friend');
    };

    const declineFriend = async (requestId: string) => {
        const { error } = await supabase
            .from('friends')
            .delete()
            .eq('id', requestId);

        if (!error) fetchFriends();
    };

    const removeFriend = async (friendId: string) => {
        const { error } = await supabase
            .from('friends')
            .delete()
            .or(`and(user_id.eq.${user.id},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${user.id})`);

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

    const startBotMatch = () => {
        if (partyId && !user.id) return; // Basic check

        if (partyId) {
            // Signal party
            supabase.channel(`party:${partyId}`).send({
                type: 'broadcast',
                event: 'start_searching',
                payload: { is_bot: true }
            });
        }

        onMatchFound('bot-match', {
            id: 'bot-id',
            username: 'Nexus AI (Practice)',
            elo: 0
        });
    };

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
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

                    <div className="flex gap-2 mb-6 p-1 bg-black/20 rounded-xl">
                        <button
                            onClick={() => setActiveTab('friends')}
                            className={`flex-1 py-2 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all ${activeTab === 'friends' ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/20' : 'text-slate-500 hover:text-slate-300'}`}
                        >
                            Amigos ({friends.length})
                        </button>
                        <button
                            onClick={() => setActiveTab('invites')}
                            className={`flex-1 py-2 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all relative ${activeTab === 'invites' ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/20' : 'text-slate-500 hover:text-slate-300'}`}
                        >
                            Convites
                            {pendingInvites.length > 0 && (
                                <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white text-[8px] flex items-center justify-center rounded-full animate-bounce">
                                    {pendingInvites.length}
                                </span>
                            )}
                        </button>
                    </div>

                    <div className="relative mb-6">
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
                            <Search size={16} />
                        </div>
                        <input
                            type="text"
                            placeholder="Search players..."
                            value={searchNickname}
                            onChange={(e) => searchUsers(e.target.value)}
                            className="w-full bg-black/40 border border-white/10 rounded-xl py-3 pl-11 pr-4 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all font-medium"
                        />
                        {searchResults.length > 0 && (
                            <div className="absolute top-full left-0 right-0 mt-2 bg-[#1a1a20] border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                                {searchResults.map((u) => (
                                    <div key={u.id} className="flex items-center justify-between p-3 hover:bg-white/5 border-b border-white/5 last:border-0">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-400">
                                                {u.username[0]}
                                            </div>
                                            <span className="text-sm font-bold text-white">{u.username}</span>
                                        </div>
                                        <button
                                            onClick={() => addFriend(u.id)}
                                            className="p-2 text-purple-400 hover:bg-purple-500/10 rounded-lg transition-all"
                                            title="Add Friend"
                                        >
                                            <UserPlus size={18} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-thin scrollbar-thumb-white/10">
                        {activeTab === 'friends' ? (
                            friends.length === 0 ? (
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
                                            <button
                                                onClick={() => inviteFriend(friend.id)}
                                                className="p-2 text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors border border-transparent hover:border-emerald-500/20"
                                                title="Chammar para Lobby"
                                            >
                                                <Zap size={16} />
                                            </button>
                                            <button
                                                onClick={() => removeFriend(friend.id)}
                                                className="p-2 text-slate-600 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors"
                                                title="Excluir Amigo"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )
                        ) : (
                            pendingInvites.length === 0 ? (
                                <div className="text-center py-6">
                                    <Mail size={24} className="text-slate-700 mx-auto mb-3 opacity-20" />
                                    <p className="text-slate-600 text-xs font-medium">Nenhum convite pendente.</p>
                                </div>
                            ) : (
                                pendingInvites.map((requester) => (
                                    <div key={requester.id} className="flex items-center gap-3 p-3 bg-indigo-500/5 border border-indigo-500/20 rounded-2xl">
                                        <div className="w-10 h-10 bg-indigo-500/20 rounded-xl flex items-center justify-center font-bold text-indigo-400 uppercase">
                                            {requester.username[0]}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-xs font-bold text-white truncate">{requester.username}</div>
                                            <div className="text-[9px] text-indigo-400/60 font-black uppercase tracking-widest">Quer ser seu amigo</div>
                                        </div>
                                        <div className="flex gap-1">
                                            <button
                                                onClick={() => acceptFriend(requester.requestId)}
                                                className="p-2 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500 hover:text-white rounded-lg transition-all"
                                                title="Aceitar"
                                            >
                                                <Users size={14} />
                                            </button>
                                            <button
                                                onClick={() => declineFriend(requester.requestId)}
                                                className="p-2 bg-rose-500/20 text-rose-500 hover:bg-rose-500 hover:text-white rounded-lg transition-all"
                                                title="Recusar"
                                            >
                                                <X size={14} />
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )
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

                        <div className="grid grid-cols-1 gap-4">
                            <button
                                onClick={startPartySearch}
                                className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-black py-4 rounded-2xl shadow-xl shadow-purple-500/20 transition-all active:scale-95 flex items-center justify-center gap-3 group text-lg"
                            >
                                {partyId ? 'START PARTY QUEUE' : 'FIND MATCH'}
                                <Search size={20} className="group-hover:translate-x-1 transition-transform" />
                            </button>
                            <button
                                onClick={startBotMatch}
                                className="w-full bg-white/5 border border-white/10 hover:bg-white/10 text-white font-bold py-3 rounded-2xl transition-all active:scale-95 flex items-center justify-center gap-2 text-sm"
                            >
                                <Zap size={16} className="text-amber-400" />
                                PRACTICE VS AI
                            </button>
                        </div>
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
                            <div className="text-xl font-mono text-white/50 mt-2">{formatTime(searchTime)}</div>
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
