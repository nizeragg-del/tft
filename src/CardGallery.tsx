import React, { useState } from 'react';
import { CardTemplate } from './types';
import { CARD_TEMPLATES } from './data';
import { X, Swords, Heart, Zap, Sparkles, BookOpen, Shield, Target } from 'lucide-react';

// Reusing UnitArt logic for consistency
const UnitArt = ({ name, className }: { name: string, className?: string }) => {
    const [status, setStatus] = useState<'trying_jpg' | 'trying_png' | 'error'>('trying_jpg');
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

    if (status === 'error' || !supabaseUrl) {
        return <span className="font-bold drop-shadow-md text-white/80">{name[0].toUpperCase()}</span>;
    }

    const cleanName = name.toLowerCase().replace(/[^a-z0-9]/g, '');
    const extension = status === 'trying_jpg' ? 'jpg' : 'png';
    const imageUrl = `${supabaseUrl}/storage/v1/object/public/card-art/${cleanName}.${extension}`;

    return (
        <img
            src={imageUrl}
            alt={name}
            className={`w-full h-full object-cover select-none ${className}`}
            onError={() => {
                if (status === 'trying_jpg') setStatus('trying_png');
                else setStatus('error');
            }}
        />
    );
};

interface CardGalleryProps {
    onClose: () => void;
}

export const CardGallery: React.FC<CardGalleryProps> = ({ onClose }) => {
    const [selectedCard, setSelectedCard] = useState<CardTemplate | null>(null);
    const [activeTier, setActiveTier] = useState<number | 'all'>('all');

    const filteredCards = activeTier === 'all'
        ? CARD_TEMPLATES
        : CARD_TEMPLATES.filter(c => c.tier === activeTier);

    const tierColors: Record<number, string> = {
        1: 'from-slate-500/20 to-slate-900/40 border-slate-500/30 text-slate-300',
        2: 'from-emerald-500/20 to-emerald-900/40 border-emerald-500/30 text-emerald-300',
        3: 'from-sky-500/20 to-sky-900/40 border-sky-500/30 text-sky-300',
        4: 'from-purple-500/20 to-purple-900/40 border-purple-500/30 text-purple-300',
        5: 'from-amber-500/20 to-amber-900/40 border-amber-500/30 text-amber-300',
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8 animate-in fade-in duration-300">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-[#060608]/95 backdrop-blur-xl" onClick={onClose} />

            <div className="relative w-full max-w-6xl h-full max-h-[90vh] bg-[#0a0a0c] border border-white/10 rounded-3xl shadow-[0_0_100px_rgba(0,0,0,0.5)] flex flex-col overflow-hidden">

                {/* Header */}
                <div className="px-8 py-6 border-b border-white/5 flex flex-col sm:flex-row justify-between items-center gap-4 bg-white/[0.02]">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center shadow-lg shadow-purple-500/20">
                            <BookOpen className="text-white" size={24} />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black text-white tracking-tight uppercase">Coleção Nexus</h1>
                            <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Enciclopédia de Unidades</p>
                        </div>
                    </div>

                    <div className="flex bg-white/5 p-1 rounded-xl border border-white/10">
                        {['all', 1, 2, 3, 4, 5].map((t) => (
                            <button
                                key={t}
                                onClick={() => setActiveTier(t as any)}
                                className={`px-4 py-2 rounded-lg text-xs font-black transition-all ${activeTier === t
                                        ? 'bg-white/10 text-white shadow-inner'
                                        : 'text-slate-500 hover:text-slate-300'
                                    }`}
                            >
                                {t === 'all' ? 'TODAS' : `T${t}`}
                            </button>
                        ))}
                    </div>

                    <button
                        onClick={onClose}
                        className="p-3 hover:bg-white/5 rounded-2xl text-slate-500 hover:text-white transition-all border border-transparent hover:border-white/10"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Main Content */}
                <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">

                    {/* Grid Area */}
                    <div className="flex-1 p-6 overflow-y-auto custom-scrollbar bg-black/20">
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4">
                            {filteredCards.map((card) => (
                                <div
                                    key={card.id}
                                    onClick={() => setSelectedCard(card)}
                                    className={`group relative aspect-[3/4] rounded-2xl border bg-gradient-to-b ${tierColors[card.tier]} cursor-pointer transition-all duration-300 hover:scale-[1.03] hover:shadow-2xl hover:z-10 overflow-hidden
                                        ${selectedCard?.id === card.id ? 'ring-2 ring-white scale-[1.03] z-10 shadow-2xl' : ''}`}
                                >
                                    <div className="absolute inset-0 overflow-hidden">
                                        <UnitArt name={card.name} className="group-hover:scale-110 transition-transform duration-700 opacity-80 group-hover:opacity-100" />
                                        <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0c] via-[#0a0a0c]/20 to-transparent" />
                                    </div>

                                    <div className="absolute bottom-4 left-4 right-4 text-center">
                                        <div className="text-[10px] font-black tracking-widest text-white/40 uppercase mb-1">Tier {card.tier}</div>
                                        <div className="text-sm font-black text-white truncate drop-shadow-lg">{card.name}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Details Area */}
                    <div className="w-full lg:w-[400px] border-l border-white/5 bg-[#0d0d11]/80 backdrop-blur-md p-8 overflow-y-auto custom-scrollbar select-none">
                        {selectedCard ? (
                            <div className="animate-in slide-in-from-right-10 duration-500 flex flex-col gap-6">
                                {/* Large Preview */}
                                <div className="relative aspect-square w-full rounded-3xl border border-white/10 overflow-hidden shadow-2xl bg-[#15151a]">
                                    <UnitArt name={selectedCard.name} />
                                    <div className="absolute inset-0 bg-gradient-to-t from-[#0d0d11] via-transparent to-transparent" />
                                    <div className="absolute bottom-6 left-6 flex flex-wrap gap-2">
                                        {selectedCard.traits.map(t => (
                                            <span key={t} className="px-3 py-1 bg-white/5 backdrop-blur-md border border-white/10 rounded-full text-[10px] font-black text-white/70 uppercase tracking-tighter">
                                                {t}
                                            </span>
                                        ))}
                                    </div>
                                </div>

                                {/* Typography & Lore */}
                                <div>
                                    <h2 className="text-3xl font-black text-white tracking-tighter uppercase leading-none">{selectedCard.name}</h2>
                                    <p className="text-xs text-purple-400 font-black uppercase tracking-widest mt-1 mb-4">{selectedCard.abilityName}</p>

                                    <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                                        <div className="flex items-center gap-2 text-white/40 text-[10px] font-black mb-2 uppercase">
                                            <Sparkles size={12} /> Habilidade
                                        </div>
                                        <p className="text-sm text-slate-300 font-medium leading-relaxed italic">
                                            "{selectedCard.abilityDescription}"
                                        </p>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div className="flex items-center gap-2 text-white/40 text-[10px] font-black uppercase tracking-widest">
                                        <BookOpen size={12} /> Crônicas do Nexus
                                    </div>
                                    <p className="text-sm text-slate-400 leading-relaxed font-medium">
                                        {selectedCard.lore || "A história desta unidade ainda está sendo escrita nos ecos do Vazio..."}
                                    </p>
                                </div>

                                {/* Stats Grid */}
                                <div className="grid grid-cols-2 gap-3 mt-4">
                                    <div className="bg-rose-500/5 border border-rose-500/10 rounded-2xl p-4 flex flex-col items-center justify-center group hover:bg-rose-500/10 transition-colors">
                                        <Heart className="text-rose-400 mb-1 group-hover:scale-110 transition-transform" size={18} />
                                        <span className="text-xs text-rose-300 font-black tracking-widest">{selectedCard.hp} HP</span>
                                    </div>
                                    <div className="bg-orange-500/5 border border-orange-500/10 rounded-2xl p-4 flex flex-col items-center justify-center group hover:bg-orange-500/10 transition-colors">
                                        <Swords className="text-orange-400 mb-1 group-hover:scale-110 transition-transform" size={18} />
                                        <span className="text-xs text-orange-300 font-black tracking-widest">{selectedCard.ad} AD</span>
                                    </div>
                                    <div className="bg-blue-500/5 border border-blue-500/10 rounded-2xl p-4 flex flex-col items-center justify-center group hover:bg-blue-500/10 transition-colors">
                                        <Zap className="text-blue-400 mb-1 group-hover:scale-110 transition-transform" size={18} />
                                        <span className="text-xs text-blue-300 font-black tracking-widest">{selectedCard.manaMax} MANA</span>
                                    </div>
                                    <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-2xl p-4 flex flex-col items-center justify-center group hover:bg-emerald-500/10 transition-colors">
                                        <Target className="text-emerald-400 mb-1 group-hover:scale-110 transition-transform" size={18} />
                                        <span className="text-xs text-emerald-300 font-black tracking-widest">{selectedCard.range} ALCANCE</span>
                                    </div>
                                </div>

                            </div>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-center opacity-30 select-none">
                                <BookOpen size={64} className="mb-4" />
                                <p className="text-sm font-black uppercase tracking-[0.2em]">Selecione uma carta<br />para ver os detalhes</p>
                            </div>
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
};
