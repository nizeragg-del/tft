import React from 'react';
import { Augment } from './types';
import { Sparkles, TrendingUp, Zap, Shield, Sword, Coins, GraduationCap } from 'lucide-react';

interface AugmentSelectionProps {
    options: Augment[];
    onSelect: (augment: Augment) => void;
}

export const AugmentSelection: React.FC<AugmentSelectionProps> = ({ options, onSelect }) => {
    const getIcon = (type: string, id: string) => {
        if (id.includes('gold') || id.includes('rich')) return <Coins className="text-amber-400" size={32} />;
        if (id.includes('study') || id.includes('wise')) return <GraduationCap className="text-blue-400" size={32} />;
        if (id.includes('force') || id.includes('sword')) return <Sword className="text-rose-400" size={32} />;
        if (id.includes('resilience') || id.includes('shield')) return <Shield className="text-emerald-400" size={32} />;

        switch (type) {
            case 'COMBAT': return <Zap className="text-rose-400" size={32} />;
            case 'ECON': return <TrendingUp className="text-amber-400" size={32} />;
            default: return <Sparkles className="text-purple-400" size={32} />;
        }
    };

    const getTypeColor = (type: string) => {
        switch (type) {
            case 'COMBAT': return 'from-rose-500/20 to-orange-500/20 border-rose-500/30';
            case 'ECON': return 'from-amber-500/20 to-yellow-500/20 border-amber-500/30';
            case 'UTILITY': return 'from-blue-500/20 to-cyan-500/20 border-blue-500/30';
            default: return 'from-purple-500/20 to-indigo-500/20 border-purple-500/30';
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md animate-in fade-in duration-500">
            <div className="max-w-6xl w-full p-8 space-y-12">
                <div className="text-center space-y-4 animate-in slide-in-from-top-8 duration-700">
                    <h2 className="text-5xl font-black text-white italic tracking-tighter uppercase">
                        Escolha seu <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-400">Aprimoramento</span>
                    </h2>
                    <p className="text-slate-400 text-xl font-medium">Bônus permanentes para moldar sua estratégia nesta partida.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {options.map((augment, idx) => (
                        <button
                            key={augment.id}
                            onClick={() => onSelect(augment)}
                            className={`group relative flex flex-col items-center text-center p-8 bg-gradient-to-br ${getTypeColor(augment.type)} border-2 rounded-[2rem] transition-all hover:scale-105 hover:shadow-2xl hover:shadow-purple-500/20 active:scale-95 animate-in zoom-in-95 duration-500`}
                            style={{ animationDelay: `${idx * 150}ms` }}
                        >
                            <div className="absolute -top-4 -right-4 bg-white/10 backdrop-blur-md border border-white/20 rounded-full px-4 py-1 text-[10px] font-black text-white uppercase tracking-widest">
                                Tier {augment.tier}
                            </div>

                            <div className="mb-8 p-6 bg-black/40 rounded-3xl border border-white/5 group-hover:scale-110 transition-transform duration-500">
                                {getIcon(augment.type, augment.id)}
                            </div>

                            <h3 className="text-2xl font-black text-white uppercase tracking-tight mb-4 group-hover:text-purple-300 transition-colors">
                                {augment.name}
                            </h3>

                            <p className="text-slate-300 leading-relaxed font-medium">
                                {augment.description}
                            </p>

                            <div className="mt-8 pt-6 border-t border-white/5 w-full">
                                <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${augment.type === 'COMBAT' ? 'text-rose-400' :
                                        augment.type === 'ECON' ? 'text-amber-400' : 'text-blue-400'
                                    }`}>
                                    {augment.type}
                                    {augment.type === 'ECON' && ' • ECONOMIA'}
                                    {augment.type === 'COMBAT' && ' • COMBATE'}
                                    {augment.type === 'UTILITY' && ' • UTILIDADE'}
                                </span>
                            </div>
                        </button>
                    ))}
                </div>

                <div className="text-center pt-8">
                    <p className="text-slate-500 font-bold uppercase tracking-widest text-xs animate-pulse">
                        Sua escolha é permanente e não pode ser desfeita
                    </p>
                </div>
            </div>
        </div>
    );
};
