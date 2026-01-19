import React, { useEffect, useState } from 'react';
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

                <LobbyMain
                    searching={searching}
                    searchTime={searchTime}
                    onlineCount={onlineCount}
                    user={user}
                    onStartMatchmaking={() => partyId ? findMatch() : findMatch()}
                    onCancelMatchmaking={cancelSearch}
                    onStartBotMatch={startBotMatch}
                    partyId={partyId}
                />

                <footer className="p-4 text-center text-slate-600 text-[10px] font-bold uppercase tracking-[0.2em] relative z-20">
                    Nexus Tactics v2.5.0 • Todos os Direitos Reservados
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
