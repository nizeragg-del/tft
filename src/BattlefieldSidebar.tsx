import { Shield, Sparkles, Coins, Info } from 'lucide-react';
import { CardInstance } from './types';
import { CARD_TEMPLATES } from './data';

interface BattlefieldSidebarProps {
    game: any;
}

export const BattlefieldSidebar: React.FC<BattlefieldSidebarProps> = ({ game }) => {
    const units = game.board.flatMap((r: any) => r).filter((u: any) => u && u.team === 'PLAYER') as CardInstance[];
    const traits: Record<string, number> = {};
    const unique = new Set<string>();

    units.forEach(u => {
        if (!unique.has(u.templateId)) {
            CARD_TEMPLATES.find(t => t.id === u.templateId)?.traits.forEach(tr => traits[tr] = (traits[tr] || 0) + 1);
            unique.add(u.templateId);
        }
    });

    const interestSlots = game.activeAugments?.includes('rich-get-richer') ? 7 : 5;
    const currentInterest = Math.min(interestSlots, Math.floor(game.gold / 10));

    return (
        <aside className="w-64 flex flex-col gap-8 py-6 z-20">
            {/* Synergies */}
            <div>
                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-slate-500 mb-4 px-1">
                    <Shield size={14} className="text-slate-600" />
                    Sinergias
                </div>
                <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-2 custom-scrollbar">
                    {Object.entries(traits).length === 0 ? (
                        <div className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl text-[10px] text-slate-600 font-bold uppercase text-center italic">
                            Nenhuma Sinergia Ativa
                        </div>
                    ) : (
                        Object.entries(traits).sort((a, b) => b[1] - a[1]).map(([trait, count]) => (
                            <div key={trait} className={`flex items-center justify-between p-3 rounded-2xl border transition-all cursor-default group
                                ${count >= 2 ? 'bg-purple-500/10 border-purple-500/30' : 'bg-white/5 border-white/10 opacity-60'}`}>
                                <div className="flex items-center gap-3">
                                    <Sparkles size={14} className={count >= 2 ? 'text-purple-400' : 'text-slate-500'} />
                                    <span className={`text-sm font-bold ${count >= 2 ? 'text-purple-100' : 'text-slate-400'}`}>{trait}</span>
                                </div>
                                <span className={`text-xs font-black px-2 py-0.5 rounded-lg border
                                    ${count >= 2 ? 'bg-purple-500/20 border-purple-500/30 text-purple-300' : 'bg-white/5 border-white/10 text-slate-500'}`}>
                                    {count}
                                </span>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Interest Meter */}
            <div>
                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-slate-500 mb-4 px-1">
                    <Coins size={14} className="text-amber-500/60" />
                    Interesse
                </div>
                <div className="p-5 bg-white/[0.03] rounded-[2rem] border border-white/5 backdrop-blur-sm relative overflow-hidden group">
                    <div className="flex flex-wrap items-center justify-center gap-3 relative z-10">
                        {Array.from({ length: interestSlots }).map((_, i) => (
                            <div
                                key={i}
                                className={`w-8 h-8 rounded-full border-2 transition-all duration-500 flex items-center justify-center
                                    ${i < currentInterest
                                        ? 'bg-amber-500/20 border-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.4)] animate-pulse'
                                        : 'bg-white/[0.02] border-white/10 opacity-30 shadow-none grayscale'}`}
                                title={`${(i + 1) * 10} Gold`}
                            >
                                <Coins size={14} className={i < currentInterest ? 'text-amber-500' : 'text-slate-600'} />
                            </div>
                        ))}
                    </div>

                    <div className="mt-4 flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500 group-hover:text-amber-400/60 transition-colors">
                        <Info size={10} />
                        +{currentInterest} Gold por round
                    </div>

                    {/* Background Detail */}
                    <div className="absolute top-0 right-0 -mr-4 -mt-4 opacity-5 pointer-events-none group-hover:opacity-10 transition-opacity">
                        <Coins size={80} />
                    </div>
                </div>
            </div>
        </aside>
    );
};
