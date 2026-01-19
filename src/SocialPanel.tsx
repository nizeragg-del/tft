import React, { useState } from 'react';
import { Search, Users, Mail, Swords, Zap, Trash2, X, UserPlus, Circle } from 'lucide-react';

interface SocialPanelProps {
    friends: any[];
    pendingInvites: any[];
    searchResults: any[];
    searchNickname: string;
    onSearch: (query: string) => void;
    onAddFriend: (id: string) => void;
    onAcceptFriend: (id: string) => void;
    onDeclineFriend: (id: string) => void;
    onRemoveFriend: (id: string) => void;
    onChallenge: (id: string, name: string) => void;
    onInviteToParty: (id: string) => void;
}

export const SocialPanel: React.FC<SocialPanelProps> = ({
    friends,
    pendingInvites,
    searchResults,
    searchNickname,
    onSearch,
    onAddFriend,
    onAcceptFriend,
    onDeclineFriend,
    onRemoveFriend,
    onChallenge,
    onInviteToParty
}) => {
    const [activeTab, setActiveTab] = useState<'friends' | 'invites'>('friends');

    return (
        <aside className="w-80 border-l border-white/5 flex flex-col bg-[#161618]/30 backdrop-blur-md relative z-30">
            <div className="p-6 border-b border-white/5">
                <div className="flex items-center gap-3 mb-6">
                    <Users className="text-purple-400" size={20} />
                    <h2 className="font-black text-lg text-white uppercase tracking-tight">Nexus Friends</h2>
                </div>

                <div className="flex p-1 bg-black/40 rounded-xl">
                    <button
                        onClick={() => setActiveTab('friends')}
                        className={`flex-1 py-2 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all ${activeTab === 'friends' ? 'bg-white/10 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                        AMIGOS ({friends.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('invites')}
                        className={`flex-1 py-2 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all relative ${activeTab === 'invites' ? 'bg-white/10 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                        CONVITES
                        {pendingInvites.length > 0 && (
                            <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white text-[8px] flex items-center justify-center rounded-full animate-pulse font-black">
                                {pendingInvites.length}
                            </span>
                        )}
                    </button>
                </div>
            </div>

            <div className="p-4 flex-1 flex flex-col overflow-hidden">
                <div className="relative mb-6">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                    <input
                        type="text"
                        placeholder="Search players..."
                        value={searchNickname}
                        onChange={(e) => onSearch(e.target.value)}
                        className="w-full bg-black/40 border border-white/5 rounded-2xl pl-10 pr-4 py-3 text-sm focus:ring-2 focus:ring-purple-500/50 text-slate-200 placeholder:text-slate-600 transition-all font-medium"
                    />

                    {searchResults.length > 0 && (
                        <div className="absolute top-full left-0 right-0 mt-2 bg-[#1a1a20] border border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2">
                            {searchResults.map((u) => (
                                <div key={u.id} className="flex items-center justify-between p-3 hover:bg-white/5 border-b border-white/5 last:border-0 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-400">
                                            {u.username[0].toUpperCase()}
                                        </div>
                                        <span className="text-sm font-bold text-white">{u.username}</span>
                                    </div>
                                    <button
                                        onClick={() => onAddFriend(u.id)}
                                        className="p-2 text-purple-400 hover:bg-purple-500/10 rounded-lg transition-colors"
                                    >
                                        <UserPlus size={18} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="space-y-2 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-white/5 flex-1">
                    {activeTab === 'friends' ? (
                        friends.map((friend) => (
                            <div key={friend.id} className="flex items-center gap-3 p-3 rounded-2xl hover:bg-white/5 transition-all cursor-pointer group border border-transparent hover:border-white/5">
                                <div className="relative">
                                    <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center font-bold text-slate-400 uppercase">
                                        {friend.username[0]}
                                    </div>
                                    <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-[#161618] bg-emerald-500"></span>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-bold text-sm text-white truncate">{friend.username}</p>
                                    <p className="text-[10px] text-slate-500 font-black uppercase tracking-wider">{friend.elo} ELO • LOBBY</p>
                                </div>
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={() => onChallenge(friend.id, friend.username)}
                                        className="p-2 text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                                        title="Challenge 1v1"
                                    >
                                        <Swords size={14} />
                                    </button>
                                    <button
                                        onClick={() => onInviteToParty(friend.id)}
                                        className="p-2 text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors"
                                        title="Invite to Party"
                                    >
                                        <Zap size={14} />
                                    </button>
                                </div>
                            </div>
                        ))
                    ) : (
                        pendingInvites.map((requester) => (
                            <div key={requester.id} className="flex items-center gap-3 p-3 bg-purple-500/5 border border-purple-500/20 rounded-2xl">
                                <div className="w-10 h-10 bg-purple-500/20 rounded-xl flex items-center justify-center font-bold text-purple-400 uppercase">
                                    {requester.username[0]}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-bold text-sm text-white truncate">{requester.username}</p>
                                    <p className="text-[10px] text-purple-400/60 font-black uppercase tracking-wider">Friend Request</p>
                                </div>
                                <div className="flex gap-1">
                                    <button
                                        onClick={() => onAcceptFriend(requester.requestId)}
                                        className="p-2 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500 hover:text-white rounded-lg transition-all"
                                    >
                                        <Circle size={10} className="fill-current" />
                                    </button>
                                    <button
                                        onClick={() => onDeclineFriend(requester.requestId)}
                                        className="p-2 bg-rose-500/20 text-rose-500 hover:bg-rose-500 hover:text-white rounded-lg transition-all"
                                    >
                                        <X size={14} />
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            <div className="mt-auto p-6 bg-white/5 border-t border-white/5 text-center">
                <button className="text-[10px] font-black text-purple-400 hover:text-purple-300 transition-colors uppercase tracking-[0.2em] flex items-center justify-center gap-2 mx-auto">
                    <UserPlus size={12} />
                    ADD NEW FRIEND
                </button>
            </div>
        </aside>
    );
};
