import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import seedrandom from 'seedrandom';
import { CardTemplate, CardInstance, GameState, GamePhase, Team, Augment } from './types';
import { CARD_TEMPLATES, MONSTER_TEMPLATES, WAVES } from './data';
import { ABILITIES } from './abilities';
import { AUGMENTS } from './augments';
import { AugmentSelection } from './AugmentSelection';
import { ShoppingCart, LayoutGrid, Users, Trophy, Heart, Coins, ArrowUpCircle, RefreshCw, Shield, Swords, Zap, LogOut, Loader2, X, BookOpen, Sparkles } from 'lucide-react';
import { supabase } from './supabase';
import { Auth } from './Auth';
import { Matchmaking } from './Matchmaking';
import { CardGallery } from './CardGallery';
import { User } from './types';
import { BattlefieldHUD } from './BattlefieldHUD';
import { BattlefieldSidebar } from './BattlefieldSidebar';
import { BattleBoard } from './BattleBoard';
import { BattlefieldActions } from './BattlefieldActions';
import { ShopModal } from './ShopModal';
import UnitArt from './UnitArt';

export const TIER_COSTS = { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5 };
export const XP_COST = 4;
export const XP_AMOUNT = 4;
export const REROLL_COST = 2;
export const PHASE_DURATION = { PLANNING: 30, COMBAT: 45 };

const App: React.FC = () => {
    const [game, setGame] = useState<GameState>({
        gold: 10,
        level: 1,
        xp: 0,
        shop: [],
        bench: Array(9).fill(null),
        board: Array(4).fill(null).map(() => Array(7).fill(null)),
        health: 100,
        round: 1,
        phase: 'PLANNING',
        timer: PHASE_DURATION.PLANNING,
        graveyard: [],
        floatingTexts: [],
        projectiles: [],
        activeAugments: [],
        augmentSelection: null
    });

    const [selectedInBench, setSelectedInBench] = useState<number | null>(null);
    const [selectedInBoard, setSelectedInBoard] = useState<{ x: number, y: number } | null>(null);
    const [isShopOpen, setIsShopOpen] = useState(false);
    const [user, setUser] = useState<User | null>(null);
    const [sessionLoading, setSessionLoading] = useState(true);
    const [matchId, setMatchId] = useState<string | null>(null);
    const [opponent, setOpponent] = useState<{ id: string; username: string; elo: number; health?: number } | null>(null);
    const [botState, setBotState] = useState<{
        gold: number;
        level: number;
        xp: number;
        health: number;
        board: (CardInstance | null)[][];
        bench: (CardInstance | null)[];
    } | null>(null);
    const [isGalleryOpen, setIsGalleryOpen] = useState(false);
    const channelRef = useRef<any>(null);
    const combatIntervalRef = useRef<any>(null);
    const combatRngRef = useRef<any>(null);

    useEffect(() => {
        if (!matchId) return;

        // Subscribe to match actions
        channelRef.current = supabase.channel(`match_actions:${matchId}`, {
            config: { broadcast: { self: false } }
        });

        channelRef.current
            .on('broadcast', { event: 'sync_board' }, (payload: any) => {
                handleOpponentBoardSync(payload.payload.board);
            })
            .on('broadcast', { event: 'sync_health' }, (payload: any) => {
                setOpponent(prev => prev ? { ...prev, health: payload.payload.health } : null);
            })
            .on('broadcast', { event: 'combat_start' }, (payload: any) => {
                if (game.phase === 'PLANNING') {
                    setGame(prev => startCombat(prev, payload.payload.seed));
                }
            })
            .subscribe();

        // Listen for match status changes (victory/defeat)
        const matchSubscription = supabase
            .channel(`match_status:${matchId}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'matches',
                    filter: `id=eq.${matchId}`
                },
                (payload) => {
                    const updatedMatch = payload.new;
                    if (updatedMatch.status === 'finished') {
                        const isWinner = updatedMatch.winner_id === user?.id;
                        alert(isWinner ? "VICTORY! Opponent surrendered or health reached zero." : "DEFEAT! Better luck next time.");
                        setMatchId(null);
                        setOpponent(null);
                        if (user) fetchUserProfile(user.id);
                    }
                }
            )
            .subscribe();

        return () => {
            if (channelRef.current) supabase.removeChannel(channelRef.current);
            supabase.removeChannel(matchSubscription);
        };
    }, [matchId, game.phase, user]);

    const broadcastBoard = (board: (CardInstance | null)[][]) => {
        if (!channelRef.current) return;
        // Only send rows 2 and 3 (player rows)
        const playerRows = [board[2], board[3]];
        channelRef.current.send({
            type: 'broadcast',
            event: 'sync_board',
            payload: { board: playerRows }
        });
    };

    const handleOpponentBoardSync = (oppRows: (CardInstance | null)[][]) => {
        setGame(prev => {
            const newBoard = prev.board.map(r => [...r]);
            // Put opponent units in rows 0 and 1
            oppRows.forEach((row, rIdx) => {
                row.forEach((unit, cIdx) => {
                    if (unit) {
                        const newX = 6 - cIdx;
                        const newY = 1 - rIdx;
                        newBoard[newY][newX] = {
                            ...unit,
                            team: 'ENEMY',
                            position: { x: newX, y: newY }
                        };
                    } else {
                        const newX = 6 - cIdx;
                        const newY = 1 - rIdx;
                        newBoard[newY][newX] = null;
                    }
                });
            });
            return { ...prev, board: newBoard };
        });
    };

    useEffect(() => {
        // Check active session
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session) fetchUserProfile(session.user.id);
            else setSessionLoading(false);
        });

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            if (session) fetchUserProfile(session.user.id);
            else {
                setUser(null);
                setSessionLoading(false);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    useEffect(() => {
        if (game.health <= 0) {
            handleMatchEnd(false);
        } else if (opponent?.id === 'bot-id' && opponent.health !== undefined && opponent.health <= 0) {
            handleMatchEnd(true);
        }
    }, [game.health, opponent?.health]);

    const fetchUserProfile = async (userId: string) => {
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', userId)
            .single();

        if (data) setUser(data);
        setSessionLoading(false);
    };

    const handleSignOut = async () => {
        await supabase.auth.signOut();
    };

    const handleMatchFound = (id: string, opp: { id: string; username: string; elo: number }) => {
        setMatchId(id);
        if (opp.id === 'bot-id') {
            setBotState({
                gold: 10,
                level: 1,
                xp: 0,
                health: 100,
                board: Array(2).fill(null).map(() => Array(7).fill(null)),
                bench: Array(9).fill(null)
            });
        } else {
            setBotState(null);
        }

        // Reset game state for new match
        setGame({
            gold: 10,
            level: 1,
            xp: 0,
            shop: generateShop(1),
            bench: Array(9).fill(null),
            board: Array(4).fill(null).map(() => Array(7).fill(null)),
            health: 100,
            round: 1,
            phase: 'PLANNING',
            timer: PHASE_DURATION.PLANNING,
            graveyard: [],
            floatingTexts: [],
            projectiles: [],
            activeAugments: [],
            augmentSelection: null
        });
    };

    const generateShop = useCallback((level: number) => {
        const newShop: (CardTemplate | null)[] = [];
        for (let i = 0; i < 5; i++) {
            let template;
            if (level < 3) template = CARD_TEMPLATES.filter(t => t.tier === 1)[Math.floor(Math.random() * CARD_TEMPLATES.filter(t => t.tier === 1).length)];
            else template = CARD_TEMPLATES[Math.floor(Math.random() * CARD_TEMPLATES.length)];
            newShop.push(template);
        }
        return newShop;
    }, []);

    useEffect(() => {
        setGame((prev: GameState) => ({ ...prev, shop: generateShop(prev.level) }));
    }, [generateShop]);

    useEffect(() => {
        const timer = setInterval(() => {
            setGame((prev: GameState) => {
                if (prev.timer <= 0) {
                    if (prev.phase === 'PLANNING') {
                        const seed = `${matchId || 'bot'}-${prev.round}`;
                        if (user?.id && matchId && channelRef.current) {
                            channelRef.current.send({
                                type: 'broadcast',
                                event: 'combat_start',
                                payload: { seed }
                            });
                        }
                        return startCombat(prev, seed);
                    } else {
                        return { ...prev, timer: 0 };
                    }
                }
                return { ...prev, timer: prev.timer - 1 };
            });
        }, 1000);
        return () => clearInterval(timer);
    }, [matchId, opponent]);

    const startCombat = (state: GameState, seed?: string): GameState => {
        const combatSeed = seed || Math.random().toString();
        combatRngRef.current = seedrandom(combatSeed);

        const newBoard = state.board.map(r => [...r]);

        // Generate Enemies
        const wave = WAVES[state.round];
        if (wave && wave.length > 0) {
            const validSpots: { x: number, y: number }[] = [];
            for (let y = 0; y < 2; y++) {
                for (let x = 0; x < 7; x++) {
                    if (!newBoard[y][x]) validSpots.push({ x, y });
                }
            }
            validSpots.sort(() => combatRngRef.current() - 0.5);

            wave.forEach((monsterId, idx) => {
                if (idx >= validSpots.length) return;
                const template = MONSTER_TEMPLATES.find(t => t.id === monsterId);
                if (template) {
                    const spot = validSpots[idx];
                    newBoard[spot.y][spot.x] = {
                        id: combatRngRef.current().toString(36).substr(2, 9),
                        templateId: template.id,
                        stars: 1,
                        currentHp: template.hp,
                        maxHp: template.hp,
                        currentMana: 0,
                        team: 'ENEMY',
                        position: spot,
                        isDead: false
                    };
                }
            });
        } else if (opponent?.id === 'bot-id' && botState) {
            for (let y = 0; y < 2; y++) {
                for (let x = 0; x < 7; x++) {
                    const botUnit = botState.board[y][x];
                    if (botUnit) {
                        newBoard[y][x] = {
                            ...botUnit,
                            currentHp: botUnit.maxHp,
                            currentMana: 0,
                            isDead: false,
                            team: 'ENEMY',
                            position: { x, y }
                        };
                    }
                }
            }
        } else if (!opponent) {
            const validSpots: { x: number, y: number }[] = [];
            for (let y = 0; y < 2; y++) {
                for (let x = 0; x < 7; x++) {
                    if (!newBoard[y][x]) validSpots.push({ x, y });
                }
            }
            validSpots.sort(() => combatRngRef.current() - 0.5);

            for (let i = 0; i < Math.min(state.level, validSpots.length); i++) {
                const randTemplate = CARD_TEMPLATES[Math.floor(combatRngRef.current() * CARD_TEMPLATES.length)];
                const spot = validSpots[i];
                newBoard[spot.y][spot.x] = {
                    id: combatRngRef.current().toString(36).substr(2, 9),
                    templateId: randTemplate.id,
                    stars: 1,
                    currentHp: randTemplate.hp,
                    maxHp: randTemplate.hp,
                    currentMana: 0,
                    team: 'ENEMY',
                    position: spot,
                    isDead: false
                };
            }
        }

        // Apply Synergies
        const playerUnits = newBoard.flat().filter(u => u && u.team === 'PLAYER') as CardInstance[];
        const traitCounts: Record<string, number> = {};
        const uniqueTemplates = new Set<string>();

        playerUnits.forEach(u => {
            if (!uniqueTemplates.has(u.templateId)) {
                const template = CARD_TEMPLATES.find(t => t.id === u.templateId);
                template?.traits.forEach(trait => {
                    traitCounts[trait] = (traitCounts[trait] || 0) + 1;
                });
                uniqueTemplates.add(u.templateId);
            }
        });

        playerUnits.forEach(unit => {
            const template = CARD_TEMPLATES.find(t => t.id === unit.templateId);
            if (!template) return;

            template.traits.forEach(trait => {
                const count = traitCounts[trait] || 0;
                if (trait === 'Protector' && count >= 2) {
                    unit.currentShield = (unit.currentShield || 0) + (count >= 4 ? 300 : 150);
                }
                if (trait === 'Assassin' && count >= 2) {
                    unit.ad = (unit.ad || 0) + (count >= 4 ? 40 : 20);
                }
                if (trait === 'Mage' && count >= 2) {
                    unit.currentMana = (count >= 4 ? 40 : 20);
                }
                if (trait === 'Brawler' && count >= 2) {
                    const hpBonus = count >= 4 ? 400 : 200;
                    unit.maxHp += hpBonus;
                    unit.currentHp += hpBonus;
                }
                if (trait === 'Chrono' && count >= 2) {
                    unit.as = (unit.as || 0.6) * (count >= 4 ? 1.4 : 1.2);
                }
            });

            state.activeAugments.forEach(augId => {
                if (augId === 'brute-force') unit.ad = (unit.ad || 0) + 20;
                if (augId === 'resilience') { unit.maxHp += 250; unit.currentHp += 250; }
                if (augId === 'arcane-mastery') unit.currentMana = Math.min(unit.currentMana + 30, (CARD_TEMPLATES.find(t => t.id === unit.templateId)?.manaMax || 100));
                if (augId === 'tactical-reposition') unit.as = (unit.as || 0.6) * 1.2;
            });
        });

        return { ...state, board: newBoard, phase: 'COMBAT', timer: PHASE_DURATION.COMBAT, graveyard: [] };
    };

    const endCombat = (state: GameState): GameState => {
        const interestLimit = state.activeAugments.includes('rich-get-richer') ? 7 : 5;
        const interest = Math.min(interestLimit, Math.floor(state.gold / 10));
        const newGold = state.gold + 5 + interest;
        const newXp = state.xp + 2;

        const enemyUnits = state.board.flat().filter(u => u && u.team === 'ENEMY' && !u.isDead);
        const playerUnits = state.board.flat().filter(u => u && u.team === 'PLAYER' && !u.isDead);

        let damageTaken = 0;
        if (enemyUnits.length > 0) {
            damageTaken = 2 + enemyUnits.length * 2 + Math.floor(state.round / 5);
        }

        const newHealth = Math.max(0, state.health - damageTaken);
        const newBoard = Array(4).fill(null).map(() => Array(7).fill(null));

        state.board.flat().forEach(unit => {
            if (unit && unit.team === 'PLAYER') {
                const { x, y } = unit.startPosition || unit.position;
                if (x >= 0 && x < 7 && y >= 0 && y < 4) {
                    newBoard[y][x] = {
                        ...unit,
                        position: { x, y },
                        startPosition: { x, y },
                        currentHp: unit.maxHp,
                        currentMana: 0,
                        currentShield: 0,
                        isStunned: false,
                        isDead: false
                    };
                }
            }
        });

        state.graveyard?.forEach(unit => {
            if (unit && unit.team === 'PLAYER') {
                const { x, y } = unit.startPosition || unit.position;
                if (x >= 0 && x < 7 && y >= 0 && y < 4) {
                    newBoard[y][x] = {
                        ...unit,
                        position: { x, y },
                        startPosition: { x, y },
                        currentHp: unit.maxHp,
                        currentMana: 0,
                        currentShield: 0,
                        isStunned: false,
                        isDead: false
                    };
                }
            }
        });

        const { bench: mergedBench, board: mergedBoard } = checkMerges(state.bench, newBoard);

        let finalXp = newXp;
        let finalLevel = state.level;
        const xpNeeded = finalLevel * 4;

        if (finalXp >= xpNeeded) {
            finalXp -= xpNeeded;
            finalLevel += 1;
        }

        if (state.activeAugments.includes('clear-mind') && state.bench.every(u => u === null)) {
            finalXp += 3;
            const nextXpNeeded = finalLevel * 4;
            if (finalXp >= nextXpNeeded && finalLevel < 9) {
                finalXp -= nextXpNeeded;
                finalLevel += 1;
            }
        }

        if (opponent?.id === 'bot-id' && enemyUnits.length === 0 && playerUnits.length > 0) {
            const botDamage = 2 + playerUnits.length * 2 + Math.floor(state.round / 5);
            setOpponent(prev => prev ? { ...prev, health: Math.max(0, (prev.health ?? 100) - botDamage) } : null);
        }

        if (channelRef.current) {
            channelRef.current.send({
                type: 'broadcast',
                event: 'sync_health',
                payload: { health: newHealth }
            });
        }

        const nextRound = state.round + 1;
        const isAugmentRound = [2, 5, 8].includes(nextRound);
        let augmentOptions: Augment[] | null = null;

        if (isAugmentRound) {
            const shuffled = [...AUGMENTS].sort(() => Math.random() - 0.5);
            augmentOptions = shuffled.slice(0, 3);
        }

        return {
            ...state,
            phase: 'PLANNING',
            timer: isAugmentRound ? 999 : 30,
            round: nextRound,
            gold: Math.min(newGold, 100),
            xp: finalXp,
            level: finalLevel,
            health: newHealth,
            board: mergedBoard,
            bench: mergedBench,
            shop: generateShop(finalLevel),
            floatingTexts: [],
            projectiles: [],
            augmentSelection: augmentOptions
        };
    };

    const handleSelectAugment = (augment: Augment) => {
        setGame(prev => {
            let { gold, xp, health, activeAugments } = { ...prev };
            if (augment.id === 'gold-rush') gold += 20;
            if (augment.id === 'rich-get-richer') gold += 10;
            if (augment.id === 'fast-study') {
                xp += 15;
                while (xp >= prev.level * 4 && prev.level < 9) {
                    xp -= prev.level * 4;
                    prev.level++;
                }
            }
            if (augment.id === 'nexus-blessing') health = Math.min(100, health + 20);
            return {
                ...prev,
                gold,
                xp,
                health,
                level: prev.level,
                activeAugments: [...activeAugments, augment.id],
                augmentSelection: null,
                timer: 30
            };
        });
    };

    useEffect(() => {
        if (opponent?.id === 'bot-id' && game.phase === 'PLANNING' && game.timer === PHASE_DURATION.PLANNING) {
            runBotTurn();
        }
    }, [game.round, game.phase]);

    const runBotTurn = () => {
        setBotState(prev => {
            if (!prev) return null;
            let { gold, level, xp, board, bench } = { ...prev };
            const interest = Math.min(5, Math.floor(gold / 10));
            gold += 5 + interest;
            xp += 2;
            while (gold >= 4 && level < 9 && (xp + 4 >= level * 4 || gold > 30)) {
                gold -= 4;
                xp += 4;
                if (xp >= level * 4) { xp -= level * 4; level++; }
            }
            const newBoard: (CardInstance | null)[][] = Array(2).fill(null).map(() => Array(7).fill(null));
            const allBotUnits = [...bench.filter(Boolean), ...board.flat().filter(Boolean)] as CardInstance[];
            allBotUnits.sort((a, b) => b.stars - a.stars);
            const toPlace = allBotUnits.slice(0, level);
            toPlace.forEach((unit, idx) => {
                const x = idx % 7;
                const y = Math.floor(idx / 7);
                newBoard[y][x] = { ...unit, position: { x, y }, startPosition: { x, y } };
            });
            setGame(gamePrev => {
                const syncBoard = gamePrev.board.map(r => [...r]);
                newBoard.forEach((row, y) => {
                    row.forEach((u, x) => {
                        syncBoard[y][x] = u ? { ...u, team: 'ENEMY' } : null;
                    });
                });
                return { ...gamePrev, board: syncBoard };
            });
            return { ...prev, gold, level, xp, board: newBoard };
        });
    };

    const handleMatchEnd = async (isWinner: boolean) => {
        if (!user || !opponent) return;
        if (opponent.id === 'bot-id') {
            alert(isWinner ? "VITÓRIA!" : "DERROTA!");
            setMatchId(null);
            setOpponent(null);
            return;
        }
        if (!matchId) return;
        const { error } = await supabase.from('matches').update({ status: 'finished', winner_id: isWinner ? user.id : opponent.id }).eq('id', matchId);
        if (!error) {
            alert(isWinner ? "VICTORY!" : "DEFEAT!");
            setMatchId(null);
            setOpponent(null);
            fetchUserProfile(user.id);
        }
    };

    useEffect(() => {
        combatIntervalRef.current = setInterval(() => {
            setGame(prev => {
                const newFloatingTexts = prev.floatingTexts?.map(t => ({ ...t, life: t.life - 1 })).filter(t => t.life > 0) || [];
                const now = Date.now();
                const newProjectiles = prev.projectiles?.filter(p => now - p.startTime < p.duration) || [];
                if (prev.phase !== 'COMBAT') return { ...prev, floatingTexts: newFloatingTexts, projectiles: newProjectiles };
                const newBoard = prev.board.map(r => [...r]);
                const units: CardInstance[] = [];
                for (const row of newBoard) for (const cell of row) if (cell && !cell.isDead) units.push(cell);
                const newGraveyard = [...prev.graveyard];
                let roundGoldGain = 0;
                for (const unit of units) {
                    if (unit.isDead) continue;
                    const template = CARD_TEMPLATES.find(t => t.id === unit.templateId) || MONSTER_TEMPLATES.find(t => t.id === unit.templateId);
                    if (!template) continue;
                    let nearestEnemy: CardInstance | null = null;
                    let minDist = Infinity;
                    for (const other of units) {
                        if (other.team !== unit.team && !other.isDead) {
                            const dist = Math.abs(other.position.x - unit.position.x) + Math.abs(other.position.y - unit.position.y);
                            if (dist < minDist) { minDist = dist; nearestEnemy = other; }
                        }
                    }
                    if (!nearestEnemy) continue;
                    if (minDist <= template.range) {
                        const timeSinceLast = now - (unit.lastAttackTime || 0);
                        if (timeSinceLast >= 1000 / (unit.as || template.as)) {
                            unit.lastAttackTime = now;
                            const ad = unit.ad || template.ad;
                            const dmg = Math.max(1, Math.floor(unit.stars * ad * 0.15));
                            nearestEnemy.currentHp -= dmg;
                            unit.currentMana = Math.min(template.manaMax, unit.currentMana + 10);
                            newFloatingTexts.push({ id: Math.random().toString(), value: dmg.toString(), type: 'damage', x: nearestEnemy.position.x, y: nearestEnemy.position.y, life: 3 });
                            if (nearestEnemy.currentHp <= 0) nearestEnemy.isDead = true;
                        }
                    } else {
                        const dx = Math.sign(nearestEnemy.position.x - unit.position.x);
                        const dy = Math.sign(nearestEnemy.position.y - unit.position.y);
                        if (!newBoard[unit.position.y + dy]?.[unit.position.x + dx]) {
                            newBoard[unit.position.y][unit.position.x] = null;
                            unit.position = { x: unit.position.x + dx, y: unit.position.y + dy };
                            newBoard[unit.position.y][unit.position.x] = unit;
                        }
                    }
                }
                const livingPlayerUnits = units.filter(u => u.team === 'PLAYER' && !u.isDead).length;
                const livingEnemyUnits = units.filter(u => u.team === 'ENEMY' && !u.isDead).length;
                if (livingPlayerUnits === 0 || livingEnemyUnits === 0) return endCombat({ ...prev, board: newBoard, gold: prev.gold + roundGoldGain, floatingTexts: newFloatingTexts, projectiles: newProjectiles, graveyard: newGraveyard });
                return { ...prev, board: newBoard, gold: prev.gold + roundGoldGain, floatingTexts: newFloatingTexts, projectiles: newProjectiles, graveyard: newGraveyard };
            });
        }, 200);
        return () => clearInterval(combatIntervalRef.current);
    }, [game.phase]);

    const buyCard = (shopIndex: number) => {
        const card = game.shop[shopIndex];
        if (!card || game.gold < TIER_COSTS[card.tier as keyof typeof TIER_COSTS]) return;
        const firstEmptyBench = game.bench.indexOf(null);
        if (firstEmptyBench === -1) return;
        setGame(prev => {
            const newShop = [...prev.shop];
            newShop[shopIndex] = null;
            const newBench = [...prev.bench];
            newBench[firstEmptyBench] = { id: Math.random().toString(36).substr(2, 9), templateId: card.id, stars: 1, currentHp: card.hp, maxHp: card.hp, currentMana: 0, team: 'PLAYER', position: { x: -1, y: -1 } };
            const { bench, board } = checkMerges(newBench, prev.board);
            return { ...prev, gold: prev.gold - TIER_COSTS[card.tier as keyof typeof TIER_COSTS], shop: newShop, bench, board };
        });
    };

    const checkMerges = (bench: (CardInstance | null)[], board: (CardInstance | null)[][]) => {
        let newBench = [...bench];
        let newBoard = board.map(r => [...r]);
        let merged = false;
        const allUnits = [...newBench.filter(Boolean), ...newBoard.flat().filter(Boolean)] as CardInstance[];
        const groups: Record<string, CardInstance[]> = {};
        allUnits.forEach(u => {
            const key = `${u.templateId}_${u.stars}`;
            if (!groups[key]) groups[key] = [];
            groups[key].push(u);
        });
        Object.values(groups).forEach(group => {
            if (group.length >= 3 && group[0].stars < 3) {
                const target = group[0];
                const sac1 = group[1];
                const sac2 = group[2];
                target.stars += 1 as any;
                target.maxHp *= 1.8;
                target.currentHp = target.maxHp;
                [sac1, sac2].forEach(sac => {
                    const benchIdx = newBench.findIndex(b => b?.id === sac.id);
                    if (benchIdx !== -1) newBench[benchIdx] = null;
                    else {
                        newBoard.forEach((row, y) => row.forEach((u, x) => {
                            if (u?.id === sac.id) newBoard[y][x] = null;
                        }));
                    }
                });
                merged = true;
            }
        });
        if (merged) return checkMerges(newBench, newBoard);
        return { bench: newBench, board: newBoard };
    };

    const sellUnit = (idx: any, type: 'bench' | 'board') => {
        setGame(prev => {
            const newBench = [...prev.bench];
            const newBoard = prev.board.map(r => [...r]);
            let refund = 1;
            if (type === 'bench') {
                const u = newBench[idx];
                if (u) {
                    const t = CARD_TEMPLATES.find(ct => ct.id === u.templateId);
                    if (t) refund = Math.max(1, Math.floor(TIER_COSTS[t.tier as keyof typeof TIER_COSTS] * u.stars * 0.7));
                    newBench[idx] = null;
                }
            } else {
                const u = newBoard[idx.y][idx.x];
                if (u) {
                    const t = CARD_TEMPLATES.find(ct => ct.id === u.templateId);
                    if (t) refund = Math.max(1, Math.floor(TIER_COSTS[t.tier as keyof typeof TIER_COSTS] * u.stars * 0.7));
                    newBoard[idx.y][idx.x] = null;
                }
            }
            return { ...prev, gold: prev.gold + refund, bench: newBench, board: newBoard };
        });
        setSelectedInBench(null);
        setSelectedInBoard(null);
    };

    const handleBoardClick = (y: number, x: number) => {
        if (game.phase !== 'PLANNING') return;
        if (selectedInBench !== null) {
            setGame(prev => {
                const newBoard = prev.board.map(r => [...r]);
                const newBench = [...prev.bench];
                const unit = newBench[selectedInBench];
                if (unit && !newBoard[y][x]) {
                    newBoard[y][x] = { ...unit, position: { x, y }, startPosition: { x, y } };
                    newBench[selectedInBench] = null;
                    broadcastBoard(newBoard);
                    return { ...prev, board: newBoard, bench: newBench };
                }
                return prev;
            });
            setSelectedInBench(null);
        } else if (selectedInBoard) {
            setGame(prev => {
                const newBoard = prev.board.map(r => [...r]);
                const unit = newBoard[selectedInBoard.y][selectedInBoard.x];
                if (unit) {
                    newBoard[selectedInBoard.y][selectedInBoard.x] = newBoard[y][x];
                    newBoard[y][x] = { ...unit, position: { x, y }, startPosition: { x, y } };
                    broadcastBoard(newBoard);
                    return { ...prev, board: newBoard };
                }
                return prev;
            });
            setSelectedInBoard(null);
        } else if (game.board[y][x]?.team === 'PLAYER') {
            setSelectedInBoard({ x, y });
        }
    };

    const handleBenchClick = (idx: number) => {
        if (game.phase !== 'PLANNING') return;
        if (selectedInBoard) {
            setGame(prev => {
                const newBoard = prev.board.map(r => [...r]);
                const newBench = [...prev.bench];
                const unit = newBoard[selectedInBoard.y][selectedInBoard.x];
                if (unit && !newBench[idx]) {
                    newBench[idx] = { ...unit, position: { x: -1, y: -1 }, startPosition: undefined };
                    newBoard[selectedInBoard.y][selectedInBoard.x] = null;
                    broadcastBoard(newBoard);
                    return { ...prev, board: newBoard, bench: newBench };
                }
                return prev;
            });
            setSelectedInBoard(null);
        } else if (game.bench[idx]) {
            setSelectedInBench(idx);
        }
    };

    const rerollShop = () => {
        if (game.gold < REROLL_COST) return;
        setGame(prev => ({ ...prev, gold: prev.gold - REROLL_COST, shop: generateShop(prev.level) }));
    };

    const buyXP = () => {
        if (game.gold < XP_COST) return;
        setGame(prev => {
            let { gold, xp, level } = { ...prev };
            gold -= XP_COST;
            xp += XP_AMOUNT;
            if (xp >= level * 4 && level < 9) { xp -= level * 4; level++; }
            return { ...prev, gold, xp, level };
        });
    };

    if (sessionLoading) return <div className="h-screen bg-[#0a0a0c] flex items-center justify-center"><Loader2 className="w-12 h-12 text-purple-500 animate-spin" /></div>;
    if (!user) return <Auth onAuthComplete={() => { }} />;
    if (!matchId) return <> <Matchmaking user={user} onMatchFound={handleMatchFound} onSignOut={handleSignOut} onGalleryOpen={() => setIsGalleryOpen(true)} /> {isGalleryOpen && <CardGallery onClose={() => setIsGalleryOpen(false)} />} </>;

    return (
        <div className="flex flex-col h-screen bg-[#0a0a0c] text-white font-['Outfit'] overflow-hidden relative">
            <BattlefieldHUD user={user} opponent={opponent} game={game} onSignOut={handleSignOut} />
            <main className="flex h-screen pt-16 pb-32 px-6 gap-6 relative z-10">
                <BattlefieldSidebar game={game} />
                <BattleBoard game={game} selectedInBoard={selectedInBoard} onBoardClick={handleBoardClick} onSellUnit={sellUnit} />
            </main>
            <BattlefieldActions
                game={game}
                isShopOpen={isShopOpen}
                onToggleShop={() => setIsShopOpen(!isShopOpen)}
                onBuyXP={buyXP}
                onReroll={rerollShop}
                onBenchClick={handleBenchClick}
                onSellUnit={sellUnit}
                selectedInBench={selectedInBench}
                selectedInBoard={selectedInBoard}
            />
            {isShopOpen && (
                <ShopModal
                    shop={game.shop}
                    gold={game.gold}
                    onBuyCard={buyCard}
                    onReroll={rerollShop}
                    onClose={() => setIsShopOpen(false)}
                />
            )}
            {game.augmentSelection && <AugmentSelection options={game.augmentSelection} onSelect={handleSelectAugment} />}
            {isGalleryOpen && <CardGallery onClose={() => setIsGalleryOpen(false)} />}
        </div>
    );
};

export default App;
