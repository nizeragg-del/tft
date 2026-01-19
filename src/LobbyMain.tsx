import React from 'react';
import { Swords, Search, Zap, Trophy, TrendingUp, Loader2, X, Circle } from 'lucide-react';

interface LobbyMainProps {
    searching: boolean;
    searchTime: number;
    onlineCount: number;
    user: any;
    onStartMatchmaking: () => void;
    onCancelMatchmaking: () => void;
    onStartBotMatch: () => void;
    partyId: string | null;
}

export const LobbyMain: React.FC<LobbyMainProps> = ({
    searching,
    searchTime,
    onlineCount,
    user,
    onStartMatchmaking,
    onCancelMatchmaking,
    onStartBotMatch,
    partyId
}) => {
    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    if (searching) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-500">
                <div className="relative mb-8">
                    <div className="w-48 h-48 border-4 border-purple-500/10 border-t-purple-500 rounded-full animate-spin mx-auto" />
                    <div className="absolute inset-0 flex items-center justify-center">
                        <Loader2 size={64} className="text-purple-400 animate-pulse" />
                    </div>
                </div>

                <div className="space-y-4">
                    <h3 className="text-4xl font-black text-white uppercase tracking-wider animate-pulse italic">
                        Buscando <span className="text-purple-500">Oponente...</span>
                    </h3>
                    <div className="text-3xl font-mono text-white/40 tracking-widest">{formatTime(searchTime)}</div>
                    <p className="text-slate-500 text-lg font-medium">Encontrando Comandantes com nível de poder similar</p>
                </div>

                <button
                    onClick={onCancelMatchmaking}
                    className="mt-8 px-10 py-4 bg-white/5 hover:bg-rose-500/10 border border-white/10 hover:border-rose-500/20 text-slate-400 hover:text-rose-500 rounded-2xl font-black transition-all flex items-center gap-3"
                >
                    <X size={20} /> CANCELAR FILA
                </button>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col items-center justify-center max-w-4xl mx-auto text-center px-12 animate-in fade-in zoom-in duration-700">
            {/* Hero Section */}
            <div className="mb-8 relative group">
                <div className="absolute inset-0 bg-purple-500 blur-[100px] opacity-20 group-hover:opacity-30 transition-opacity"></div>
                <div className="relative w-40 h-40 bg-gradient-to-br from-purple-500 to-blue-600 rounded-[2.5rem] flex items-center justify-center shadow-2xl shadow-purple-500/40 rotate-6 group-hover:rotate-0 transition-all duration-700 cursor-pointer">
                    <Swords size={60} className="text-white -rotate-6 group-hover:rotate-0 transition-all duration-700" />
                </div>
            </div>

            <h1 className="text-5xl font-black mb-4 tracking-tighter leading-none text-white italic uppercase">
                PRONTO PARA A <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-400">BATALHA?</span>
            </h1>

            <p className="text-slate-400 text-lg font-medium mb-8 max-w-xl">
                Teste suas táticas contra Comandantes de todo o Nexus no modo ranqueado ou treino.
            </p>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 gap-4 w-full max-w-md mb-8">
                <div className="bg-[#161618]/60 backdrop-blur-md border border-white/5 p-5 rounded-3xl text-left relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Trophy size={40} className="text-amber-500" />
                    </div>
                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500 mb-1">Seu Rank</p>
                    <div className="flex items-center gap-3">
                        <Trophy className="text-amber-500" size={20} />
                        <span className="text-2xl font-black text-white">{user?.elo || 1000}</span>
                    </div>
                </div>
                <div className="bg-[#161618]/60 backdrop-blur-md border border-white/5 p-5 rounded-3xl text-left relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <TrendingUp size={40} className="text-emerald-500" />
                    </div>
                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500 mb-1">Taxa de Vitória</p>
                    <div className="flex items-center gap-3">
                        <TrendingUp className="text-emerald-500" size={20} />
                        <span className="text-2xl font-black text-white">
                            {user?.wins + user?.losses > 0 ? Math.round((user.wins / (user.wins + user.losses)) * 100) : 0}%
                        </span>
                    </div>
                </div>
            </div>

            {/* Action Buttons */}
            <div className="w-full max-w-md space-y-3">
                <button
                    onClick={onStartMatchmaking}
                    className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white py-5 px-8 rounded-[1.5rem] font-black text-xl flex items-center justify-center gap-4 shadow-2xl shadow-purple-500/30 hover:scale-[1.02] active:scale-95 transition-all group"
                >
                    {partyId ? 'INICIAR GRUPO' : 'BUSCAR PARTIDA'}
                    <Search size={24} className="group-hover:translate-x-2 transition-transform" />
                </button>
                <button
                    onClick={onStartBotMatch}
                    className="w-full bg-white/5 border border-white/10 text-slate-300 py-4 rounded-[1.5rem] font-black flex items-center justify-center gap-3 hover:bg-white/10 hover:text-white transition-all group"
                >
                    <Zap size={18} className="text-amber-400 group-hover:scale-125 transition-transform" />
                    TREINAR CONTRA IA
                </button>
            </div>
        </div>
    );
};
