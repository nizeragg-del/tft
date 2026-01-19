import React, { useEffect, useState } from 'react';
import { supabase } from './supabase';
import { User } from './types';
import { Users, UserPlus, LogOut, Trash2, Crown, Loader2, Mail, X } from 'lucide-react';

interface PartyLobbyProps {
    user: User;
    partyId: string | null;
    onPartyJoined: (id: string) => void;
    onPartyLeft: () => void;
}

export const PartyLobby: React.FC<PartyLobbyProps> = ({ user, partyId, onPartyJoined, onPartyLeft }) => {
    const [members, setMembers] = useState<any[]>([]);
    const [isLeader, setIsLeader] = useState(false);
    const [loading, setLoading] = useState(false);
    const [invites, setInvites] = useState<any[]>([]);

    useEffect(() => {
        if (!partyId) {
            // Listen for invites when not in a party
            const inviteChannel = supabase.channel(`comm:${user.id}`)
                .on('broadcast', { event: 'party_invite' }, (payload) => {
                    setInvites(prev => [...prev.filter(i => i.party_id !== payload.payload.party_id), payload.payload]);
                })
                .subscribe();

            return () => { supabase.removeChannel(inviteChannel); };
        }

        // Fetch initial members
        fetchMembers();

        // Subscribe to party changes
        const partyChannel = supabase.channel(`party:${partyId}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'party_members',
                filter: `party_id=eq.${partyId}`
            }, () => {
                fetchMembers();
            })
            .on('postgres_changes', {
                event: 'DELETE',
                schema: 'public',
                table: 'parties',
                filter: `id=eq.${partyId}`
            }, () => {
                onPartyLeft();
            })
            .on('broadcast', { event: 'kick' }, (payload) => {
                if (payload.payload.user_id === user.id) {
                    onPartyLeft();
                    alert('You have been kicked from the party');
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(partyChannel);
        };
    }, [partyId, user.id]);

    const fetchMembers = async () => {
        if (!partyId) return;

        // Get party details
        const { data: party } = await supabase.from('parties').select('*').eq('id', partyId).single();
        if (party) {
            setIsLeader(party.leader_id === user.id);
        }

        // Get members
        const { data: membersData } = await supabase
            .from('party_members')
            .select(`
                user:users(*)
            `)
            .eq('party_id', partyId);

        if (membersData) {
            setMembers(membersData.map(m => m.user));
        }
    };

    const createParty = async () => {
        setLoading(true);
        const { data: party, error } = await supabase
            .from('parties')
            .insert([{ leader_id: user.id }])
            .select()
            .single();

        if (party) {
            const { error: memberError } = await supabase
                .from('party_members')
                .insert([{ party_id: party.id, user_id: user.id }]);

            if (!memberError) onPartyJoined(party.id);
        }
        setLoading(false);
    };

    const joinParty = async (targetPartyId: string) => {
        setLoading(true);
        const { error } = await supabase
            .from('party_members')
            .insert([{ party_id: targetPartyId, user_id: user.id }]);

        if (!error) {
            onPartyJoined(targetPartyId);
            setInvites(prev => prev.filter(i => i.party_id !== targetPartyId));
        } else {
            alert('Failed to join party. It might be full or closed.');
        }
        setLoading(false);
    };

    const leaveParty = async () => {
        if (!partyId) return;
        setLoading(true);

        if (isLeader) {
            // Disband party (RLS/Cascade will handle members)
            await supabase.from('parties').delete().eq('id', partyId);
        } else {
            // Just leave
            await supabase.from('party_members').delete().eq('party_id', partyId).eq('user_id', user.id);
        }

        onPartyLeft();
        setLoading(false);
    };

    const kickMember = async (targetUserId: string) => {
        if (!partyId || !isLeader) return;

        const { error } = await supabase
            .from('party_members')
            .delete()
            .eq('party_id', partyId)
            .eq('user_id', targetUserId);

        if (!error) {
            // Broadcast kick event
            supabase.channel(`party:${partyId}`).send({
                type: 'broadcast',
                event: 'kick',
                payload: { user_id: targetUserId }
            });
        }
    };

    if (!partyId) {
        return (
            <div className="space-y-6">
                <button
                    onClick={createParty}
                    disabled={loading}
                    className="w-full bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl py-6 flex flex-col items-center justify-center gap-2 transition-all group"
                >
                    <div className="p-3 bg-purple-500/20 rounded-xl group-hover:scale-110 transition-transform">
                        <UserPlus className="text-purple-400" />
                    </div>
                    <span className="text-sm font-bold text-white uppercase tracking-wider">Create Party</span>
                </button>

                {invites.length > 0 && (
                    <div className="space-y-3">
                        <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest pl-2">Pending Invites</div>
                        {invites.map((invite) => (
                            <div key={invite.party_id} className="bg-purple-500/10 border border-purple-500/20 p-4 rounded-2xl flex items-center justify-between animate-in slide-in-from-right-4 duration-300">
                                <div className="flex items-center gap-3">
                                    <Mail size={18} className="text-purple-400" />
                                    <div>
                                        <div className="text-sm font-bold text-white">{invite.leader_name}'s Party</div>
                                        <div className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter">Wants you to join</div>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setInvites(prev => prev.filter(i => i.party_id !== invite.party_id))}
                                        className="p-2 text-slate-500 hover:text-rose-500 transition-colors"
                                    >
                                        <X size={18} />
                                    </button>
                                    <button
                                        onClick={() => joinParty(invite.party_id)}
                                        className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all"
                                    >
                                        JOIN
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between mb-2">
                <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest pl-2">Party Members ({members.length})</div>
                <button onClick={leaveParty} className="text-[10px] text-rose-500 hover:text-rose-400 font-bold uppercase tracking-widest flex items-center gap-1">
                    <LogOut size={12} /> {isLeader ? 'Disband' : 'Leave'}
                </button>
            </div>

            <div className="space-y-2">
                {members.map((member) => {
                    const partyLeaderId = members[0]?.id; // Fallback to first if not found, though should be set in fetchMembers
                    const isMemberLeader = member.id === members.find(m => m.id === member.id && partyId)?.id; // This is a bit redundant, let's simplify

                    return (
                        <div key={member.id} className="flex items-center gap-3 p-3 bg-white/5 border border-white/5 rounded-2xl">
                            <div className="w-10 h-10 bg-gradient-to-br from-slate-700 to-slate-800 rounded-xl flex items-center justify-center font-bold text-slate-400 uppercase relative">
                                {member.username[0]}
                                {/* Check against parties table leader_id if possible, but for now we'll assume first member is leader in some contexts or use a better state */}
                                {isLeader && member.id === user.id && (
                                    <div className="absolute -top-1 -right-1 bg-amber-500 rounded-full p-0.5">
                                        <Crown size={8} className="text-white" />
                                    </div>
                                )}
                                {!isLeader && member.id !== user.id && members.length > 0 && (
                                    /* How to know who is the leader if it's not us? We need to store leaderId in state */
                                    null
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="text-sm font-bold text-white truncate flex items-center gap-2">
                                    {member.username}
                                    {member.id === user.id && <span className="text-[8px] bg-white/10 px-1.5 py-0.5 rounded text-slate-400 font-black">YOU</span>}
                                </div>
                                <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{member.elo} ELO</div>
                            </div>
                            {isLeader && member.id !== user.id && (
                                <button
                                    onClick={() => kickMember(member.id)}
                                    className="p-2 text-slate-600 hover:text-rose-500 transition-colors"
                                >
                                    <Trash2 size={16} />
                                </button>
                            )}
                        </div>
                    );
                })}
            </div>

            {isLeader && (
                <p className="text-[10px] text-center text-slate-600 font-medium italic">Invite friends from the list below!</p>
            )}
        </div>
    );
};
