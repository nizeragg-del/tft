import React from 'react';
import { ShoppingCart, Coins, Swords, Heart, X } from 'lucide-react';
import { CardTemplate } from './types';
import UnitArt from './UnitArt';
import { TIER_COSTS } from './App';

interface ShopModalProps {
    shop: (CardTemplate | null)[];
    gold: number;
    onBuyCard: (idx: number) => void;
    onReroll: () => void;
    onClose: () => void;
}

export const ShopModal: React.FC<ShopModalProps> = ({
    shop,
    gold,
    onBuyCard,
    onReroll,
    onClose
}) => {
    const tierColors: Record<number, string> = {
        1: 'border-slate-500/30 from-slate-900/90 to-slate-800/90',
        2: 'border-emerald-500/30 from-emerald-900/90 to-emerald-800/90',
        3: 'border-sky-500/30 from-sky-900/90 to-sky-800/90',
        4: 'border-violet-500/30 from-violet-900/90 to-violet-800/90',
        5: 'border-amber-500/30 from-amber-900/90 to-amber-800/90',
    };

    return (
        <div className="absolute bottom-36 left-1/2 -translate-x-1/2 w-[700px] bg-[#1a1a20]/95 backdrop-blur-xl rounded-3xl border border-white/10 shadow-[0_0_80px_rgba(0,0,0,0.9)] z-[100] animate-in slide-in-from-bottom-10 fade-in duration-500 flex flex-col overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-white/5 flex justify-between items-center bg-black/20">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                        <ShoppingCart size={20} className="text-emerald-400" />
                    </div>
                    <div>
                        <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Loja do Nexus</h3>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Contratação de Unidades</p>
                    </div>
                </div>
                <button
                    onClick={onClose}
                    className="w-8 h-8 rounded-lg hover:bg-white/5 flex items-center justify-center text-slate-500 hover:text-white transition-all"
                >
                    <X size={18} />
                </button>
            </div>

            {/* Shop Cards */}
            <div className="p-4 grid grid-cols-5 gap-3 bg-black/10">
                {shop.map((card, idx) => {
                    if (!card) return (
                        <div key={idx} className="h-48 rounded-2xl bg-white/[0.02] border border-dashed border-white/5 flex items-center justify-center">
                            <span className="text-[10px] font-black uppercase tracking-widest opacity-20 rotate-45">Vendido</span>
                        </div>
                    );

                    const cost = TIER_COSTS[card.tier as keyof typeof TIER_COSTS];
                    const canAfford = gold >= cost;

                    return (
                        <div
                            key={idx}
                            onClick={() => onBuyCard(idx)}
                            className={`group relative h-48 rounded-2xl border transition-all duration-300 cursor-pointer overflow-hidden
                                ${canAfford ? 'hover:-translate-y-2 hover:shadow-2xl' : 'grayscale opacity-60 cursor-not-allowed'}
                                bg-gradient-to-b ${tierColors[card.tier]}`}
                        >
                            {/* Card Content */}
                            <div className="h-full flex flex-col p-3">
                                {/* Cost Tag */}
                                <div className="absolute top-2 right-2 px-2 py-1 rounded-lg bg-black/60 backdrop-blur-md border border-white/10 text-amber-400 font-black text-[10px] flex items-center gap-1 z-10">
                                    <Coins size={10} /> {cost}
                                </div>

                                {/* Art Container */}
                                <div className="flex-1 bg-black/40 rounded-xl mb-3 overflow-hidden ring-1 ring-white/5 group-hover:ring-white/20 transition-all">
                                    <UnitArt name={card.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                                </div>

                                {/* Info */}
                                <div className="space-y-1">
                                    <h4 className="font-black text-[11px] text-white uppercase tracking-tight truncate">{card.name}</h4>
                                    <div className="flex flex-wrap gap-1">
                                        {card.traits.map(t => (
                                            <span key={t} className="text-[8px] px-1.5 py-0.5 rounded-sm bg-black/30 text-slate-400 font-bold uppercase tracking-tighter transition-colors group-hover:text-white">
                                                {t}
                                            </span>
                                        ))}
                                    </div>
                                </div>

                                {/* Stats Overlay (Hover) */}
                                <div className="absolute inset-0 bg-black/80 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 p-4 text-center">
                                    <div className="flex gap-4">
                                        <div className="flex flex-col items-center">
                                            <Swords size={14} className="text-rose-400" />
                                            <span className="text-[10px] font-black">{card.ad}</span>
                                        </div>
                                        <div className="flex flex-col items-center">
                                            <Heart size={14} className="text-emerald-400" />
                                            <span className="text-[10px] font-black">{card.hp}</span>
                                        </div>
                                    </div>
                                    <span className="text-[9px] font-black uppercase tracking-widest text-emerald-400 mt-2">Clique para Comprar</span>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Actions */}
            <div className="px-6 py-4 bg-black/40 border-t border-white/5 flex justify-center">
                <button
                    onClick={onReroll}
                    disabled={gold < 2}
                    className={`flex items-center gap-3 px-8 py-3 rounded-2xl font-black text-xs uppercase tracking-[0.1em] transition-all shadow-xl
                        ${gold >= 2
                            ? 'bg-[#252528] hover:bg-[#2c2c30] text-slate-100 border border-white/10 hover:border-white/20 hover:-translate-y-1'
                            : 'bg-white/5 text-slate-600 border border-white/5 cursor-not-allowed opacity-50'}`}
                >
                    <div className="w-6 h-6 rounded-lg bg-black/40 flex items-center justify-center">
                        <Coins size={12} className="text-amber-500" />
                    </div>
                    Atualizar Loja
                    <span className="ml-2 px-2 py-0.5 rounded bg-amber-500/20 text-amber-500 text-[10px]">2G</span>
                </button>
            </div>
        </div>
    );
};
