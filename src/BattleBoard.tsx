import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Coins, Swords, Trash2 } from 'lucide-react';
import { CardInstance } from './types';
import { CARD_TEMPLATES, MONSTER_TEMPLATES } from './data';
import UnitArt from './UnitArt';

interface BattleBoardProps {
    game: any;
    selectedInBoard: { x: number, y: number } | null;
    onBoardClick: (y: number, x: number) => void;
    onSellUnit: (pos: { x: number, y: number }, type: 'board') => void;
}

export const BattleBoard: React.FC<BattleBoardProps> = ({
    game,
    selectedInBoard,
    onBoardClick,
    onSellUnit
}) => {
    return (
        <div className="flex-1 flex flex-col items-center justify-center relative perspective-[1200px]">
            <div className="w-full max-w-5xl aspect-[7/4] bg-emerald-950/5 rounded-[3rem] border border-emerald-500/20 p-8 relative overflow-hidden shadow-[0_0_100px_rgba(16,185,129,0.05)]">
                <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/10 to-transparent pointer-events-none opacity-50"></div>

                {/* VFX: Floating Text */}
                <AnimatePresence>
                    {game.floatingTexts?.map((text: any) => (
                        <motion.div
                            key={text.id}
                            initial={{ opacity: 1, y: 0, scale: 1 }}
                            animate={{ opacity: 0, y: -80, scale: 1.5 }}
                            transition={{ duration: 1 }}
                            className={`absolute z-[100] font-black pointer-events-none drop-shadow-lg select-none uppercase tracking-tighter
                                ${text.type === 'damage' ? 'text-white text-2xl' :
                                    text.type === 'gold' ? 'text-amber-400 text-3xl' :
                                        text.type === 'mana' ? 'text-blue-400 text-2xl' : 'text-emerald-400 text-2xl'}`}
                            style={{
                                left: `${text.x * 14.28 + 4}%`,
                                top: `${text.y * 25 + 10}%`,
                            }}
                        >
                            {text.type === 'gold' ? <span className="flex items-center gap-1"><Coins size={20} /> {text.value}</span> : text.value}
                        </motion.div>
                    ))}
                </AnimatePresence>

                {/* VFX: Projectiles */}
                {game.projectiles?.map((p: any) => (
                    <motion.div
                        key={p.id}
                        initial={{ left: `${p.sourcePos.x * 14.28 + 7}%`, top: `${p.sourcePos.y * 25 + 12}%`, opacity: 1 }}
                        animate={{ left: `${p.targetPos.x * 14.28 + 7}%`, top: `${p.targetPos.y * 25 + 12}%`, opacity: 0.5 }}
                        transition={{ duration: 0.3, ease: "linear" }}
                        className="absolute w-3 h-3 bg-blue-400 rounded-full shadow-[0_0_20px_#60a5fa] z-[90] pointer-events-none"
                    >
                        <div className="w-full h-full bg-white/50 rounded-full animate-ping" />
                    </motion.div>
                ))}

                {/* The Board Grid */}
                <div className="grid grid-rows-4 grid-cols-7 gap-3 relative z-10 h-full w-full">
                    {game.board.map((row: (CardInstance | null)[], rIdx: number) =>
                        row.map((cell, cIdx) => {
                            const isSelected = selectedInBoard?.x === cIdx && selectedInBoard?.y === rIdx;
                            const template = cell ? (CARD_TEMPLATES.find(t => t.id === cell.templateId) || MONSTER_TEMPLATES.find(t => t.id === cell.templateId)) : null;

                            return (
                                <div
                                    key={`${rIdx}-${cIdx}`}
                                    onClick={() => onBoardClick(rIdx, cIdx)}
                                    className={`rounded-2xl border transition-all duration-300 flex items-center justify-center cursor-pointer relative group
                                        ${isSelected ? 'border-purple-400 bg-purple-500/10 shadow-[0_0_30px_rgba(139,92,246,0.2)]' :
                                            cell && !cell.isDead ? 'bg-white/5 border-white/10 hover:border-white/20' :
                                                'bg-white/[0.02] border-white/5 hover:bg-white/10'}`}
                                >
                                    {cell && !cell.isDead && template && (
                                        <div className="flex flex-col items-center w-full h-full p-1 relative overflow-hidden rounded-2xl">
                                            {/* Unit Art */}
                                            <div className={`w-full h-full relative group-hover:scale-110 transition-transform duration-500 ease-out
                                                ${cell.team === 'PLAYER' ? '' : 'grayscale-[0.3] brightness-75'}`}>
                                                <UnitArt name={template.name} className="w-full h-full object-cover" />
                                            </div>

                                            {/* Health & Mana Bars */}
                                            <div className="absolute top-2 left-2 right-2 flex flex-col gap-1 z-30">
                                                <div className="h-1.5 w-full bg-black/40 rounded-full overflow-hidden border border-white/5">
                                                    <div className={`h-full transition-all duration-300 ${cell.team === 'PLAYER' ? 'bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.5)]' : 'bg-rose-500'}`}
                                                        style={{ width: `${(cell.currentHp / cell.maxHp) * 100}%` }} />
                                                </div>
                                                <div className="h-1 w-full bg-black/40 rounded-full overflow-hidden border border-white/5">
                                                    <div className="h-full bg-blue-500 transition-all duration-300" style={{ width: `${(cell.currentMana / template.manaMax) * 100}%` }} />
                                                </div>
                                            </div>

                                            {/* Stars */}
                                            <div className="absolute top-2 right-2 flex gap-0.5 z-40">
                                                {Array(cell.stars).fill(0).map((_, i) => (
                                                    <div key={i} className="w-1.5 h-1.5 rotate-45 bg-amber-400 shadow-[0_0_5px_rgba(251,191,36,0.8)] border border-black/20" />
                                                ))}
                                            </div>

                                            {/* Name Label */}
                                            <div className="absolute bottom-0 inset-x-0 bg-black/80 backdrop-blur-md py-1.5 px-1 border-t border-white/5 text-center">
                                                <span className="text-[10px] font-black uppercase tracking-widest text-white truncate block">
                                                    {template.name}
                                                </span>
                                            </div>

                                            {/* Effect Indicators */}
                                            {cell.isStunned && <div className="absolute inset-0 bg-amber-400/20 animate-pulse flex items-center justify-center text-3xl z-50">💫</div>}
                                            {(cell.currentShield || 0) > 0 && <div className="absolute inset-0 border-2 border-blue-400/50 rounded-2xl animate-pulse z-40" />}

                                            {/* Sell Indicator */}
                                            {isSelected && cell.team === 'PLAYER' && (
                                                <div
                                                    onClick={(e) => { e.stopPropagation(); onSellUnit({ x: cIdx, y: rIdx }, 'board'); }}
                                                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-rose-500 text-white p-3 rounded-full shadow-2xl hover:scale-110 active:scale-95 transition-all z-[60]"
                                                >
                                                    <Trash2 size={24} />
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
};
