import React from 'react';
import { ShoppingCart, RefreshCw, ArrowUpCircle, Trash2 } from 'lucide-react';
import { CARD_TEMPLATES } from './data';
import UnitArt from './UnitArt';

interface BattlefieldActionsProps {
    game: any;
    isShopOpen: boolean;
    onToggleShop: () => void;
    onBuyXP: () => void;
    onReroll: () => void;
    onBenchClick: (idx: number) => void;
    onSellUnit: (idx: any, type: 'bench' | 'board') => void;
    selectedInBench: number | null;
    selectedInBoard: { x: number, y: number } | null;
}

export const BattlefieldActions: React.FC<BattlefieldActionsProps> = ({
    game,
    isShopOpen,
    onToggleShop,
    onBuyXP,
    onReroll,
    onBenchClick,
    onSellUnit,
    selectedInBench,
    selectedInBoard
}) => {
    return (
        <footer className="fixed bottom-0 left-0 right-0 p-6 z-50 bg-[#161618]/80 backdrop-blur-xl border-t border-white/5">
            <div className="max-w-7xl mx-auto flex items-end justify-between gap-8 h-32">
                {/* Bench (Left/Center) */}
                <div className="flex-1 flex flex-col h-full">
                    <div className="flex items-center justify-between mb-3 px-1">
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Banco de Reservas</span>
                        <button
                            onClick={onToggleShop}
                            className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all
                                ${isShopOpen ? 'bg-emerald-500 text-black shadow-[0_0_15px_rgba(16,185,129,0.4)]' : 'bg-white/5 border border-white/10 text-slate-400 hover:text-white'}`}
                        >
                            <ShoppingCart size={12} />
                            {isShopOpen ? 'Fechar Loja' : 'Abrir Loja'}
                        </button>
                    </div>

                    <div className="flex-1 grid grid-cols-9 gap-2.5">
                        {game.bench.map((cell: any, idx: number) => {
                            const template = cell ? CARD_TEMPLATES.find(t => t.id === cell.templateId) : null;
                            const isSelected = selectedInBench === idx;

                            return (
                                <div
                                    key={idx}
                                    onClick={() => onBenchClick(idx)}
                                    className={`rounded-2xl border transition-all duration-300 flex flex-col items-center justify-center cursor-pointer relative group overflow-hidden
                                        ${isSelected ? 'bg-purple-500/10 border-purple-400 shadow-[0_0_20px_rgba(139,92,246,0.2)]' :
                                            cell ? 'bg-white/5 border-white/10 hover:border-white/20' :
                                                'bg-white/[0.02] border-white/5 border-dashed hover:bg-white/5'}`}
                                >
                                    {cell && template ? (
                                        <div className="w-full h-full p-1 flex flex-col items-center justify-center relative">
                                            {/* Unit Mini Art */}
                                            <div className="w-12 h-16 rounded-lg bg-black/20 flex items-center justify-center overflow-hidden mb-1 ring-1 ring-white/5 group-hover:ring-white/20 transition-all">
                                                <UnitArt name={template.name} />
                                            </div>

                                            <span className="text-[8px] font-black uppercase tracking-tighter text-slate-400 truncate max-w-full group-hover:text-white transition-colors">
                                                {template.name}
                                            </span>

                                            {/* Stars */}
                                            <div className="flex gap-0.5 mt-0.5">
                                                {Array(cell.stars).fill(0).map((_, i) => (
                                                    <div key={i} className="w-1 h-1 rounded-full bg-amber-400" />
                                                ))}
                                            </div>

                                            {/* Sell Indicator */}
                                            {isSelected && (
                                                <div
                                                    onClick={(e) => { e.stopPropagation(); onSellUnit(idx, 'bench'); }}
                                                    className="absolute inset-x-0 bottom-0 bg-rose-500 text-white py-1 flex items-center justify-center animate-in slide-in-from-bottom-2"
                                                >
                                                    <Trash2 size={12} />
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="text-[10px] font-bold text-white/5">{idx + 1}</div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Economic Actions (Right) */}
                <div className="flex flex-col gap-3 min-w-[240px]">
                    <button
                        onClick={onBuyXP}
                        className="w-full bg-purple-600 hover:bg-purple-500 text-white p-4 rounded-2xl font-black flex items-center justify-between group transition-all shadow-[0_8px_30px_rgba(139,92,246,0.3)] hover:-translate-y-1 active:translate-y-0"
                    >
                        <div className="text-left leading-tight">
                            <div className="text-[10px] uppercase opacity-70 tracking-widest font-black">Comprar XP</div>
                            <div className="text-sm font-black">+4 XP</div>
                        </div>
                        <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center group-hover:scale-110 group-hover:bg-white/30 transition-all shadow-inner">
                            <ArrowUpCircle size={20} />
                        </div>
                    </button>

                    <button
                        onClick={onReroll}
                        className="w-full bg-[#252528] hover:bg-[#2c2c30] text-slate-100 p-4 rounded-2xl font-black flex items-center justify-between border border-white/5 transition-all shadow-xl group hover:-translate-y-1 active:translate-y-0"
                    >
                        <div className="flex items-center gap-3">
                            <RefreshCw size={18} className="text-slate-400 group-hover:rotate-180 transition-transform duration-700" />
                            <span className="text-xs uppercase tracking-[0.2em] font-black">Atualizar</span>
                        </div>
                        <div className="flex items-center gap-1.5 bg-amber-500/20 px-2.5 py-1 rounded-lg text-amber-500 text-[10px] font-black border border-amber-500/20">
                            2G
                        </div>
                    </button>
                </div>
            </div>
        </footer>
    );
};
