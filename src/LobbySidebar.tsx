import React from 'react';
import { User, LogOut, Grid, Library, Trophy, ShoppingBag, Settings, ChevronRight, Users, Plus } from 'lucide-react';
import { PartyLobby } from './PartyLobby';

interface LobbySidebarProps {
    user: any;
    partyId: string | null;
    onPartyJoined: (id: string) => void;
    onPartyLeft: () => void;
    onSignOut: () => void;
    onGalleryOpen: () => void;
}

export const LobbySidebar: React.FC<LobbySidebarProps> = ({
    user,
    partyId,
    onPartyJoined,
    onPartyLeft,
    onSignOut,
    onGalleryOpen
}) => {
    return (
        <aside className="w-80 border-r border-white/5 flex flex-col p-6 bg-[#161618]/60 backdrop-blur-xl relative z-30">
            {/* User Profile */}
            <div className="flex items-center gap-3 mb-10 group cursor-pointer p-2 hover:bg-white/5 rounded-2xl transition-all">
                <div className="w-12 h-12 rounded-full bg-purple-500 flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-purple-500/20">
                    {user?.username?.[0].toUpperCase()}
                </div>
                <div>
                    <h3 className="font-bold text-sm tracking-wide text-white">{user?.username}</h3>
                    <p className="text-xs text-slate-400 font-medium">{user?.elo} ELO • Platinum I</p>
                </div>
                <ChevronRight size={18} className="text-slate-500 ml-auto group-hover:translate-x-1 transition-transform" />
            </div>

            {/* Party Section */}
            <div className="space-y-4 mb-10">
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 px-2">
                    <Users size={12} />
                    Party Lobby
                </div>
                <PartyLobby
                    user={user}
                    partyId={partyId}
                    onPartyJoined={onPartyJoined}
                    onPartyLeft={onPartyLeft}
                />
            </div>

            {/* Navigation */}
            <nav className="space-y-1 flex-1">
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-purple-500/10 text-purple-400 font-bold cursor-pointer">
                    <Grid size={18} />
                    Lobby
                </div>
                <div
                    onClick={onGalleryOpen}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl text-slate-400 hover:bg-white/5 hover:text-white transition-all cursor-pointer"
                >
                    <Library size={18} />
                    Collection
                </div>
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl text-slate-400 hover:bg-white/5 hover:text-white transition-all cursor-pointer">
                    <Trophy size={18} />
                    Leaderboards
                </div>
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl text-slate-400 hover:bg-white/5 hover:text-white transition-all cursor-pointer">
                    <ShoppingBag size={18} />
                    Nexus Store
                </div>
            </nav>

            {/* Bottom Actions */}
            <div className="mt-auto pt-6 border-t border-white/5 flex gap-3">
                <button className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-white/5 hover:bg-white/10 transition-all text-xs font-bold text-white">
                    <Settings size={14} />
                    Settings
                </button>
                <button
                    onClick={onSignOut}
                    className="px-4 py-3 rounded-xl bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white transition-all"
                >
                    <LogOut size={14} />
                </button>
            </div>
        </aside>
    );
};
