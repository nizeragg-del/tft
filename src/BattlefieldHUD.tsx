import { Heart, Coins, Users, LogOut, LayoutGrid, User as UserIcon, Zap } from 'lucide-react';
import { CardInstance } from './types';

interface BattlefieldHUDProps {
    user: any;
    opponent: any;
    game: any;
    onSignOut: () => void;
}

export const BattlefieldHUD: React.FC<BattlefieldHUDProps> = ({ user, opponent, game, onSignOut }) => {
    return (
        <header className="fixed top-0 left-0 right-0 h-16 px-6 flex items-center justify-between z-50 bg-[#161618]/80 backdrop-blur-xl border-b border-white/5">
            {/* Player Info (Left) */}
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-3 bg-white/5 rounded-xl px-4 py-2 border border-white/10 shrink-0">
                    <div className="w-8 h-8 rounded-lg bg-purple-500 flex items-center justify-center text-white font-bold text-sm shadow-[0_0_10px_rgba(139,92,246,0.5)]">
                        {user?.username?.[0].toUpperCase()}
                    </div>
                    <div className="hidden sm:block">
                        <div className="text-xs font-bold leading-tight text-white">{user?.username}</div>
                        <div className="text-[10px] text-slate-400 font-medium">{user?.elo} ELO</div>
                    </div>
                </div>

                <div className="flex items-center gap-2 bg-amber-500/10 rounded-xl px-4 py-2 border border-amber-500/20 shadow-sm shadow-amber-500/10">
                    <Coins size={14} className="text-amber-500 fill-amber-500/20" />
                    <span className="text-amber-500 font-bold">{game.gold}</span>
                </div>

                <div className="flex items-center gap-4 bg-white/5 rounded-xl px-4 py-2 border border-white/10 shrink-0">
                    <div className="flex flex-col items-center">
                        <span className="text-[10px] text-slate-500 font-black uppercase tracking-tighter">Nível</span>
                        <span className="font-bold text-white text-sm leading-none">{game.level}</span>
                    </div>
                    <div className="h-6 w-px bg-white/10"></div>
                    <div className="flex items-center gap-2 text-slate-400">
                        <Users size={14} />
                        <span className="text-sm font-bold">{game.board.flat().filter((u: any) => u && u.team === 'PLAYER').length}/{game.level}</span>
                    </div>
                </div>
            </div>

            {/* Phase Timer (Center) */}
            <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-3 bg-black/40 rounded-full px-6 py-2 border border-white/10 backdrop-blur-md shadow-lg">
                <LayoutGrid size={14} className="text-purple-400" />
                <span className="text-[10px] font-black tracking-[0.2em] uppercase text-white">
                    {game.phase === 'PLANNING' ? 'Planejamento' : 'Combate'}
                </span>
                <div className="w-px h-4 bg-white/10 mx-1"></div>
                <span className={`text-sm font-black transition-colors ${game.timer < 10 ? 'text-rose-500 animate-pulse' : 'text-purple-400'}`}>
                    {game.timer}s
                </span>
            </div>

            {/* Health & Opponent (Right) */}
            <div className="flex items-center gap-4">
                {/* Opponent Mini Profile */}
                {opponent && (
                    <div className="flex items-center gap-3 bg-white/5 rounded-xl pl-3 pr-4 py-1.5 border border-white/10 group transition-all">
                        <div className="relative">
                            <div className="w-8 h-8 rounded-lg bg-rose-500/20 flex items-center justify-center border border-rose-500/30 overflow-hidden">
                                {opponent.id === 'bot-id' ? <Zap size={18} className="text-rose-400" /> : <UserIcon size={18} className="text-rose-400" />}
                            </div>
                            <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-emerald-500 border-2 border-[#161618] rounded-full"></div>
                        </div>
                        <div className="flex flex-col">
                            <div className="flex items-center justify-between gap-4">
                                <span className="text-[10px] font-black text-slate-300 uppercase truncate max-w-[80px]">{opponent.username}</span>
                                <span className="text-[10px] font-black text-rose-500 italic">{opponent.health || 100} HP</span>
                            </div>
                            <div className="w-24 h-1 bg-white/10 rounded-full mt-1 overflow-hidden shrink-0">
                                <div
                                    className="h-full bg-rose-500 shadow-[0_0_8px_rgba(239,68,68,0.5)] transition-all duration-500"
                                    style={{ width: `${opponent.health || 0}%` }}
                                />
                            </div>
                        </div>
                    </div>
                )}

                <div className="flex items-center gap-2 bg-rose-500/10 rounded-xl px-4 py-2 border border-rose-500/20 shadow-sm shadow-rose-500/10">
                    <Heart size={16} className="text-rose-500 fill-rose-500/20" />
                    <span className="text-rose-500 font-bold">{game.health}</span>
                </div>

                <div className="px-4 py-2 bg-white/5 rounded-xl border border-white/10 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 shrink-0">
                    Round {game.round}
                </div>

                <button
                    onClick={onSignOut}
                    className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 transition-colors border border-white/10 text-slate-400 hover:text-white"
                >
                    <LogOut size={18} />
                </button>
            </div>
        </header>
    );
};

// Internal icon dependency fix (If needed, but Lucide has Zap)
