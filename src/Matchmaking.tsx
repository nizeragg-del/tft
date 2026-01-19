import React, { useEffect, useState } from 'react';
import { Trash2, UserPlus, Trophy, Swords, Zap, Coins } from 'lucide-react';
import { supabase } from './supabase';
import { User } from './types';
import { LobbySidebar } from './LobbySidebar';
import { LobbyMain } from './LobbyMain';
import { SocialPanel } from './SocialPanel';

interface MatchmakingProps {
    user: User;
    onMatchFound: (matchId: string, opponent: { id: string; username: string; elo: number }) => void;
    onSignOut: () => void;
    onGalleryOpen: () => void;
}

export const Matchmaking: React.FC<MatchmakingProps> = ({ user, onMatchFound, onSignOut, onGalleryOpen }) => {
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
    const [activeView, setActiveView] = useState<'lobby' | 'leaderboard' | 'store' | 'profile' | 'settings'>('lobby');
    const [leaderboard, setLeaderboard] = useState<any[]>([]);

    useEffect(() => {
        const lobbyChannel = supabase.channel('lobby:public', {
            config: { presence: { key: user.id } }
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

        fetchFriends();

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

    useEffect(() => {
        if (activeView === 'leaderboard') fetchLeaderboard();
    }, [activeView]);

    const fetchLeaderboard = async () => {
        const { data } = await supabase.from('users').select('*').order('elo', { ascending: false }).limit(20);
        if (data) setLeaderboard(data);
    };

    useEffect(() => {
        let interval: any;
        if (searching) {
            setSearchTime(0);
            interval = setInterval(() => {
                setSearchTime(prev => prev + 1);
            }, 1000);
        } else {
            setSearchTime(0);
            clearInterval(interval);
        }
        return () => clearInterval(interval);
    }, [searching]);

    useEffect(() => {
        const inviteChannel = supabase.channel(`comm:${user.id}`)
            .on('broadcast', { event: 'match_challenge' }, async (payload) => {
                const confirmed = window.confirm(`${payload.payload.leader_name} te desafiou para um X1! Aceitar?`);
                if (confirmed) acceptChallenge(payload.payload.leader_id, payload.payload.leader_name);
            })
            .on('broadcast', { event: 'challenge_accepted' }, (payload) => {
                if (payload.payload.match_id) onMatchFound(payload.payload.match_id, payload.payload.opponent);
            })
            .subscribe();

        let partyChannel: any;
        if (partyId) {
            partyChannel = supabase.channel(`party:${partyId}`)
                .on('broadcast', { event: 'start_searching' }, (payload) => {
                    if (!searching) {
                        if (payload.payload.match_id) joinExistingMatch(payload.payload.match_id);
                        else if (payload.payload.is_bot) startBotMatch();
                        else findMatch();
                    }
                })
                .on('broadcast', { event: 'cancel_searching' }, () => {
                    cancelSearch();
                })
                .subscribe();
        }

        return () => {
            supabase.removeChannel(inviteChannel);
            if (partyChannel) supabase.removeChannel(partyChannel);
        };
    }, [partyId, searching, user.id]);

    const fetchFriends = async () => {
        const { data: accepted } = await supabase
            .from('friends')
            .select('*, friend:users!friends_friend_id_fkey(*), user:users!friends_user_id_fkey(*)')
            .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`)
            .eq('status', 'accepted');

        if (accepted) {
            setFriends(accepted.map((f: any) => f.user_id === user.id ? f.friend : f.user));
        }

        const { data: pending } = await supabase
            .from('friends')
            .select('*, user:users!friends_user_id_fkey(*)')
            .eq('friend_id', user.id)
            .eq('status', 'pending');

        if (pending) {
            setPendingInvites(pending.map((p: any) => ({ ...p.user, requestId: p.id })));
        }
    };

    const findMatch = async (forceMatchId?: string) => {
        // Verificar se o jogador está banido
        if (user.banned_until) {
            const banDate = new Date(user.banned_until);
            if (banDate > new Date()) {
                const diff = Math.ceil((banDate.getTime() - new Date().getTime()) / (1000 * 60));
                const diffHours = Math.ceil(diff / 60);
                const diffDays = Math.ceil(diffHours / 24);

                let timeMsg = `${diff} minutos`;
                if (diffDays > 1) timeMsg = `${diffDays} dias`;
                else if (diffHours > 1) timeMsg = `${diffHours} horas`;

                alert(`Você está temporariamente impedido de jogar partidas PvP. \nTempo restante: ${timeMsg} \nMotivo: Desistências Excessivas.`);
                return;
            }
        }

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
            joinExistingMatch(waitingMatches[0].id);
        } else {
            const { data: newMatch } = await supabase
                .from('matches')
                .insert([{ player1_id: user.id, status: 'waiting' }])
                .select().single();

            if (newMatch) {
                setMatchId(newMatch.id);
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
            setSearching(false);
            findMatch();
        }
    };

    const fetchOpponentAndStart = async (id: string, oppId: string) => {
        const { data: oppProfile } = await supabase.from('users').select('*').eq('id', oppId).single();
        if (oppProfile) onMatchFound(id, oppProfile);
    };

    const cancelSearch = async () => {
        if (matchId) await supabase.from('matches').delete().eq('id', matchId);
        setSearching(false);
        setMatchId(null);
    };

    const startBotMatch = () => {
        if (partyId) {
            supabase.channel(`party:${partyId}`).send({
                type: 'broadcast',
                event: 'start_searching',
                payload: { is_bot: true }
            });
        }
        onMatchFound('bot-match', { id: 'bot-id', username: 'Nexus AI (Practice)', elo: 0 });
    };

    const handleChallenge = async (friendId: string, name: string) => {
        const channel = supabase.channel(`comm:${friendId}`);
        await channel.subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
                await channel.send({
                    type: 'broadcast',
                    event: 'match_challenge',
                    payload: { leader_name: user.username, leader_id: user.id, is_x1: true }
                });
                alert(`Desafio enviado para ${name}!`);
                setTimeout(() => supabase.removeChannel(channel), 2000);
            }
        });
    };

    const acceptChallenge = async (challengerId: string, challengerName: string) => {
        try {
            const { data: challengerData } = await supabase.from('users').select('*').eq('id', challengerId).single();
            if (!challengerData) throw new Error('Opponent not found');

            const { data: newMatch, error } = await supabase
                .from('matches')
                .insert([{ player1_id: user.id, player2_id: challengerId, status: 'in_progress' }])
                .select().single();

            if (error) throw error;

            if (newMatch) {
                const responseChannel = supabase.channel(`comm:${challengerId}`);
                await responseChannel.subscribe(async (status) => {
                    if (status === 'SUBSCRIBED') {
                        await responseChannel.send({
                            type: 'broadcast',
                            event: 'challenge_accepted',
                            payload: { match_id: newMatch.id, opponent: user }
                        });
                        onMatchFound(newMatch.id, challengerData);
                        setTimeout(() => supabase.removeChannel(responseChannel), 2000);
                    }
                });
            }
        } catch (err: any) {
            alert(err.message);
        }
    };

    const handleSearchUsers = async (query: string) => {
        setSearchNickname(query);
        if (query.length < 2) {
            setSearchResults([]);
            return;
        }
        const { data } = await supabase.from('users').select('*').ilike('username', `${query}%`).neq('id', user.id).limit(5);
        if (data) setSearchResults(data);
    };

    const handleAddFriend = async (targetId: string) => {
        const { error } = await supabase.from('friends').insert([{ user_id: user.id, friend_id: targetId, status: 'pending' }]);
        if (error) alert(error.code === '23505' ? 'Request already sent' : 'Error sending request');
        else {
            setSearchNickname('');
            setSearchResults([]);
            alert('Convite enviado!');
        }
    };

    const handleAcceptFriend = async (requestId: string) => {
        const { error } = await supabase.from('friends').update({ status: 'accepted' }).eq('id', requestId);
        if (!error) fetchFriends();
    };

    const handleDeclineFriend = async (requestId: string) => {
        const { error } = await supabase.from('friends').delete().eq('id', requestId);
        if (!error) fetchFriends();
    };

    const handleInviteToParty = async (friendId: string) => {
        if (!partyId) {
            alert('Crie um grupo primeiro!');
            return;
        }
        const inviteChannel = supabase.channel(`comm:${friendId}`);
        await inviteChannel.subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
                await inviteChannel.send({
                    type: 'broadcast',
                    event: 'party_invite',
                    payload: { party_id: partyId, leader_name: user.username, leader_id: user.id }
                });
                alert('Convite enviado!');
                setTimeout(() => supabase.removeChannel(inviteChannel), 2000);
            }
        });
    };

    return (
        <div className="flex h-full w-full bg-[#0a0a0b] text-slate-100 overflow-hidden relative">
            {/* Background Glow */}
            <div className="fixed inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(139,92,246,0.1)_0%,rgba(10,10,11,0)_70%)] pointer-events-none" />

            <LobbySidebar
                user={user}
                partyId={partyId}
                activeView={activeView}
                onViewChange={setActiveView}
                onPartyJoined={setPartyId}
                onPartyLeft={() => setPartyId(null)}
                onSignOut={onSignOut}
                onGalleryOpen={onGalleryOpen}
            />

            <main className="flex-1 flex flex-col relative overflow-hidden">
                <header className="p-4 flex justify-center z-20">
                    <div className="px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-500">{onlineCount.toLocaleString()} Jogadores Online</span>
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto px-12 py-6 custom-scrollbar relative z-10">
                    {activeView === 'lobby' && (
                        <LobbyMain
                            searching={searching}
                            searchTime={searchTime}
                            onlineCount={onlineCount}
                            user={user}
                            onStartMatchmaking={findMatch}
                            onCancelMatchmaking={cancelSearch}
                            onStartBotMatch={startBotMatch}
                            partyId={partyId}
                        />
                    )}

                    {activeView === 'leaderboard' && (
                        <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="text-center space-y-2">
                                <h1 className="text-4xl font-black italic text-white uppercase tracking-tighter">Olimpo dos <span className="text-purple-500">Campeões</span></h1>
                                <p className="text-slate-500 font-bold uppercase text-[10px] tracking-[0.3em]">Os 20 Melhores Comandantes do Nexus</p>
                            </div>
                            <div className="bg-[#161618]/60 backdrop-blur-xl border border-white/5 rounded-[2.5rem] overflow-hidden shadow-2xl">
                                <table className="w-full text-left">
                                    <thead>
                                        <tr className="border-b border-white/5 bg-white/5">
                                            <th className="px-8 py-5 text-[10px] font-black uppercase text-slate-500 tracking-widest">Rank</th>
                                            <th className="px-8 py-5 text-[10px] font-black uppercase text-slate-500 tracking-widest">Comandante</th>
                                            <th className="px-8 py-5 text-[10px] font-black uppercase text-slate-500 tracking-widest text-right">Vitórias</th>
                                            <th className="px-8 py-5 text-[10px] font-black uppercase text-slate-500 tracking-widest text-right">ELO</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {leaderboard.map((u, i) => (
                                            <tr key={u.id} className="hover:bg-white/5 transition-colors group">
                                                <td className="px-8 py-6 font-black italic text-xl text-slate-500 group-hover:text-purple-400">#{i + 1}</td>
                                                <td className="px-8 py-6">
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center font-black text-purple-400">
                                                            {u.username[0].toUpperCase()}
                                                        </div>
                                                        <span className="font-bold text-white tracking-wide">{u.username}</span>
                                                    </div>
                                                </td>
                                                <td className="px-8 py-6 text-right font-black text-emerald-400">{u.wins}</td>
                                                <td className="px-8 py-6 text-right">
                                                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-500 font-black text-sm">
                                                        {u.elo}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {activeView === 'store' && (
                        <div className="max-w-6xl mx-auto space-y-12 animate-in fade-in zoom-in duration-700">
                            <div className="text-center relative">
                                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-purple-500/10 blur-[100px] pointer-events-none" />
                                <h1 className="text-5xl font-black italic text-white uppercase tracking-tighter">Nexus <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-emerald-400">Store</span></h1>
                                <p className="text-slate-500 font-bold uppercase text-[10px] tracking-[0.3em] mt-2">Cosméticos de Elite & Boosters</p>
                            </div>

                            <div className="grid grid-cols-3 gap-8">
                                {[
                                    { name: 'Arena do Caos', type: 'Skin de Mapa', price: 1500, color: 'from-purple-600 to-indigo-600' },
                                    { name: 'Drone Sentinela', type: 'Avatar Pet', price: 800, color: 'from-emerald-600 to-teal-600' },
                                    { name: 'Elite Pass S1', type: 'Passe de Batalha', price: 1000, color: 'from-amber-600 to-orange-600' }
                                ].map((item, i) => (
                                    <div key={i} className="group relative bg-[#161618]/60 backdrop-blur-xl border border-white/5 rounded-[2rem] p-8 overflow-hidden hover:-translate-y-2 transition-all duration-500 hover:shadow-2xl hover:shadow-purple-500/20">
                                        <div className={`absolute top-0 left-0 w-2 h-full bg-gradient-to-b ${item.price > 1000 ? 'from-purple-500' : 'from-emerald-500'}`} />
                                        <div className="mb-6 aspect-video bg-black/40 rounded-2xl flex items-center justify-center border border-white/5 group-hover:scale-105 transition-transform">
                                            <div className={`w-16 h-16 rounded-full bg-gradient-to-br ${item.color} blur-2xl opacity-40 group-hover:opacity-80 transition-opacity`} />
                                            <Trophy size={48} className="absolute text-white/10" />
                                        </div>
                                        <h3 className="text-xl font-black text-white italic uppercase mb-1">{item.name}</h3>
                                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-6">{item.type}</p>
                                        <button className="w-full py-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white text-white hover:text-black font-black text-sm uppercase transition-all flex items-center justify-center gap-3">
                                            {item.price} Nexus Credits
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {activeView === 'profile' && (
                        <div className="max-w-4xl mx-auto space-y-12 animate-in fade-in slide-in-from-top-4 duration-700">
                            <div className="flex flex-col items-center">
                                <div className="w-32 h-32 rounded-[2.5rem] bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white font-black text-5xl shadow-2xl shadow-purple-500/40 border-4 border-white/10 mb-6">
                                    {user.username[0].toUpperCase()}
                                </div>
                                <h1 className="text-4xl font-black italic text-white uppercase tracking-tighter mb-2">{user.username}</h1>
                                <div className="flex gap-4">
                                    <div className="px-4 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 font-black text-[10px] uppercase tracking-widest">Platina I</div>
                                    <div className="px-4 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-black text-[10px] uppercase tracking-widest">Nível 42</div>
                                </div>
                            </div>

                            <div className="grid grid-cols-4 gap-6">
                                {[
                                    { label: 'ELO Máximo', val: user.elo + 240, icon: Trophy, color: 'text-amber-500' },
                                    { label: 'Partidas', val: user.wins + user.losses, icon: Swords, color: 'text-slate-400' },
                                    { label: 'Desistências', val: user.surrender_count_week || 0, icon: Zap, color: 'text-rose-500' },
                                    { label: 'Nexus Credits', val: '2.4k', icon: Coins, color: 'text-emerald-400' }
                                ].map((stat, i) => (stat.label === 'Desistências' && (user.surrender_count_week ?? 0) >= 5 ? { ...stat, label: 'Alerta! Desistências', color: 'text-rose-600 animate-pulse' } : stat)).map((stat, i) => (
                                    <div key={i} className="bg-[#161618]/60 backdrop-blur-xl border border-white/5 rounded-3xl p-6 text-center">
                                        <stat.icon size={24} className={`mx-auto mb-3 ${stat.color}`} />
                                        <p className="text-[9px] font-black uppercase text-slate-500 tracking-widest mb-1">{stat.label}</p>
                                        <p className="text-2xl font-black text-white italic">{stat.val}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {activeView === 'settings' && (
                        <div className="max-w-2xl mx-auto space-y-12 animate-in fade-in slide-in-from-right-4 duration-500">
                            <div className="space-y-2">
                                <h1 className="text-4xl font-black italic text-white uppercase tracking-tighter">Ajustes do <span className="text-purple-500">Sistema</span></h1>
                                <p className="text-slate-500 font-bold uppercase text-[10px] tracking-[0.3em]">Configure sua Experiência de Combate</p>
                            </div>

                            <div className="space-y-6">
                                {[
                                    { label: 'Volume Geral', val: '80%', type: 'range' },
                                    { label: 'Efeitos Visuais', val: 'Ultra', type: 'toggle' },
                                    { label: 'Modo Janela', val: 'Tela Cheia', type: 'toggle' },
                                    { label: 'Ocultar Identidade', val: 'Ativado', type: 'toggle' }
                                ].map((s, i) => (
                                    <div key={i} className="flex items-center justify-between p-6 bg-white/[0.02] border border-white/5 rounded-2xl hover:bg-white/5 transition-colors cursor-pointer group">
                                        <span className="font-bold text-slate-300 group-hover:text-white transition-colors uppercase text-xs tracking-widest">{s.label}</span>
                                        <span className="font-black text-purple-400 italic">{s.val}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <footer className="p-4 text-center text-slate-600 text-[10px] font-bold uppercase tracking-[0.2em] relative z-20">
                    Nexus Tactics v3.1.0 • Todos os Direitos Reservados
                </footer>
            </main>

            <SocialPanel
                friends={friends}
                pendingInvites={pendingInvites}
                searchResults={searchResults}
                searchNickname={searchNickname}
                onSearch={handleSearchUsers}
                onAddFriend={handleAddFriend}
                onAcceptFriend={handleAcceptFriend}
                onDeclineFriend={handleDeclineFriend}
                onRemoveFriend={(id) => { }} // Placeholder
                onChallenge={handleChallenge}
                onInviteToParty={handleInviteToParty}
            />
        </div>
    );
};
