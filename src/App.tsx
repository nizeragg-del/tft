import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import seedrandom from 'seedrandom';
import { CardTemplate, CardInstance, GameState, GamePhase, Team } from './types';
import { CARD_TEMPLATES, MONSTER_TEMPLATES, WAVES } from './data';
import { ABILITIES } from './abilities';
import { ShoppingCart, LayoutGrid, Users, Trophy, Heart, Coins, ArrowUpCircle, RefreshCw, Shield, Swords, Zap, LogOut, Loader2, X, BookOpen } from 'lucide-react';
import { supabase } from './supabase';
import { Auth } from './Auth';
import { Matchmaking } from './Matchmaking';
import { CardGallery } from './CardGallery';
import { User } from './types';

const TIER_COSTS = { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5 };
const XP_COST = 4;
const XP_AMOUNT = 4;
const REROLL_COST = 2;
const PHASE_DURATION = { PLANNING: 30, COMBAT: 45 };

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
            className={`w-full h-full object-cover rounded-lg ${className}`}
            onError={() => {
                if (status === 'trying_jpg') setStatus('trying_png');
                else setStatus('error');
            }}
        />
    );
};

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
        projectiles: []
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
            config: {
                broadcast: { self: false }
            }
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
                        // Refresh profile to see new ELO
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
            // We flip the rows and columns for a mirrored view
            oppRows.forEach((row, rIdx) => {
                row.forEach((unit, cIdx) => {
                    if (unit) {
                        // Flip coordinates for mirrored perspective
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
            projectiles: []
        });
    };

    // Initialize Shop
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

    // Timer Logic
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
                        const nextState = endCombat(prev);
                        if (opponent?.id === 'bot-id') {
                            // After combat ends, bot prepares for next round
                            // This will be called via useEffect on round change
                        }
                        return nextState;
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

        // Generate Enemies (PvE or Mock PvP if no real opponent)
        const wave = WAVES[state.round];
        if (wave && wave.length > 0) {
            // PvE Round
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
        } else if (!opponent) {
            // Mock PvP only if no real opponent
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
        // If opponent exists, handleOpponentBoardSync has already populated newBoard[0] and newBoard[1]

        // ========== APPLY SYNERGIES ==========
        const playerUnits = newBoard.flat().filter(u => u && u.team === 'PLAYER') as CardInstance[];
        const traitCounts: Record<string, number> = {};
        const uniqueTemplates = new Set<string>();

        // Count unique traits
        playerUnits.forEach(u => {
            if (!uniqueTemplates.has(u.templateId)) {
                const template = CARD_TEMPLATES.find(t => t.id === u.templateId);
                template?.traits.forEach(trait => {
                    traitCounts[trait] = (traitCounts[trait] || 0) + 1;
                });
                uniqueTemplates.add(u.templateId);
            }
        });

        // Apply Synergy Bonuses
        playerUnits.forEach(unit => {
            const template = CARD_TEMPLATES.find(t => t.id === unit.templateId);
            if (!template) return;

            template.traits.forEach(trait => {
                const count = traitCounts[trait] || 0;

                // Protector: Shield at start
                if (trait === 'Protector' && count >= 2) {
                    unit.currentShield = (unit.currentShield || 0) + (count >= 4 ? 300 : 150);
                }

                // Assassin: Bonus AD
                if (trait === 'Assassin' && count >= 2) {
                    unit.ad = (unit.ad || 0) + (count >= 4 ? 40 : 20);
                }

                // Mage: Start with bonus mana
                if (trait === 'Mage' && count >= 2) {
                    unit.currentMana = (count >= 4 ? 40 : 20);
                }

                // Brawler: Bonus HP
                if (trait === 'Brawler' && count >= 2) {
                    const hpBonus = count >= 4 ? 400 : 200;
                    unit.maxHp += hpBonus;
                    unit.currentHp += hpBonus;
                }

                // Cybernetic: Bonus AD and HP
                if (trait === 'Cybernetic' && count >= 3) {
                    unit.ad = (unit.ad || 0) + (count >= 6 ? 50 : 25);
                    const hpBonus = count >= 6 ? 300 : 150;
                    unit.maxHp += hpBonus;
                    unit.currentHp += hpBonus;
                }

                // Void: Mark for true damage (handled in abilities)
                // Celestial: Lifesteal
                // Chrono: AS boost
                if (trait === 'Chrono' && count >= 2) {
                    unit.as = (unit.as || 0.6) * (count >= 4 ? 1.4 : 1.2);
                }

                // Blademaster: Chance to double attack (would need combat loop)
            });
        });

        return { ...state, board: newBoard, phase: 'COMBAT', timer: PHASE_DURATION.COMBAT, graveyard: [] };
    };

    const endCombat = (state: GameState): GameState => {
        // Economy & XP
        const interest = Math.min(5, Math.floor(state.gold / 10));
        const newGold = state.gold + 5 + interest;
        const newXp = state.xp + 2;

        // Calculate Damage
        const enemyUnits = state.board.flat().filter(u => u && u.team === 'ENEMY' && !u.isDead);
        const playerUnits = state.board.flat().filter(u => u && u.team === 'PLAYER' && !u.isDead);

        let damageTaken = 0;
        if (enemyUnits.length > 0) {
            damageTaken = 2 + enemyUnits.length * 2 + Math.floor(state.round / 5);
        }

        const newHealth = Math.max(0, state.health - damageTaken);

        // Reset Board positions
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

        // Restore from Graveyard
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

        // Check level up from passive XP
        let finalXp = newXp;
        let finalLevel = state.level;
        const xpNeeded = finalLevel * 4;

        if (finalXp >= xpNeeded) {
            finalXp -= xpNeeded;
            finalLevel += 1;
        }

        // Check Match Conclusion
        if (opponent?.id === 'bot-id' && enemyUnits.length === 0 && playerUnits.length > 0) {
            const botDamage = 2 + playerUnits.length * 2 + Math.floor(state.round / 5);
            setOpponent(prev => prev ? { ...prev, health: Math.max(0, (prev.health ?? 100) - botDamage) } : null);
        }

        // Broadcast health to opponent
        if (channelRef.current) {
            channelRef.current.send({
                type: 'broadcast',
                event: 'sync_health',
                payload: { health: newHealth }
            });
        }

        return {
            ...state,
            phase: 'PLANNING',
            timer: 30,
            round: state.round + 1,
            gold: Math.min(newGold, 100),
            xp: finalXp,
            level: finalLevel,
            health: newHealth,
            board: mergedBoard,
            bench: mergedBench,
            shop: generateShop(finalLevel),
            floatingTexts: [],
            projectiles: []
        };
    };

    // Bot Strategic Turn Logic
    useEffect(() => {
        if (opponent?.id === 'bot-id' && game.phase === 'PLANNING' && game.timer === PHASE_DURATION.PLANNING) {
            runBotTurn();
        }
    }, [game.round, game.phase]);

    const runBotTurn = () => {
        setBotState(prev => {
            if (!prev) return null;

            let { gold, level, xp, board, bench } = { ...prev };

            // 1. Income
            const interest = Math.min(5, Math.floor(gold / 10));
            gold += 5 + interest;
            xp += 2;

            // 2. Buy XP if rich or close to level up
            while (gold >= 4 && level < 9 && (xp + 4 >= level * 4 || gold > 30)) {
                gold -= 4;
                xp += 4;
                if (xp >= level * 4) {
                    xp -= level * 4;
                    level++;
                }
            }

            // 3. Buy & Merge Units (Simulated Shop)
            // Bot buys 3 units each round fitting its level
            for (let i = 0; i < 3; i++) {
                if (gold < 4) break;
                const pool = CARD_TEMPLATES.filter(t => t.tier <= Math.ceil(level / 2));
                const template = pool[Math.floor(Math.random() * pool.length)];

                // Simplified merge: if it has 2 of the same, make 2-star, else add to bench
                const existingIndex = bench.findIndex(u => u?.templateId === template.id && u.stars === 1);
                const existingIndex2 = bench.findIndex((u, idx) => u?.templateId === template.id && u.stars === 1 && idx !== existingIndex);

                if (existingIndex !== -1 && existingIndex2 !== -1) {
                    // Triple! Clear bench and add 2-star to bench (next turn will place it)
                    bench[existingIndex] = null;
                    bench[existingIndex2] = null;
                    const emptySpot = bench.indexOf(null);
                    if (emptySpot !== -1) {
                        bench[emptySpot] = {
                            id: Math.random().toString(36).substr(2, 9),
                            templateId: template.id,
                            stars: 2,
                            currentHp: template.hp * 1.8,
                            maxHp: template.hp * 1.8,
                            currentMana: 0,
                            team: 'ENEMY',
                            position: { x: -1, y: -1 }
                        };
                    }
                    gold -= TIER_COSTS[template.tier as keyof typeof TIER_COSTS];
                } else {
                    const emptySpot = bench.indexOf(null);
                    if (emptySpot !== -1) {
                        bench[emptySpot] = {
                            id: Math.random().toString(36).substr(2, 9),
                            templateId: template.id,
                            stars: 1,
                            currentHp: template.hp,
                            maxHp: template.hp,
                            currentMana: 0,
                            team: 'ENEMY',
                            position: { x: -1, y: -1 }
                        };
                        gold -= TIER_COSTS[template.tier as keyof typeof TIER_COSTS];
                    }
                }
            }

            // 4. Strategic Positioning
            // Clear current board and place from bench up to level
            const newBoard: (CardInstance | null)[][] = Array(2).fill(null).map(() => Array(7).fill(null));
            const allBotUnits = [...bench.filter(Boolean), ...board.flat().filter(Boolean)] as CardInstance[];
            // Sort: highest stars first
            allBotUnits.sort((a, b) => b.stars - a.stars);

            const toPlace = allBotUnits.slice(0, level);

            toPlace.forEach(unit => {
                const template = CARD_TEMPLATES.find(t => t.id === unit.templateId);
                const isTank = template?.traits.some(t => ['Protector', 'Brawler'].includes(t));

                let placed = false;
                // Tank -> Front row (Row 1 for Bot)
                if (isTank) {
                    for (let x = 0; x < 7; x++) {
                        if (!newBoard[1][x]) {
                            newBoard[1][x] = { ...unit, position: { x, y: 1 }, startPosition: { x, y: 1 } };
                            placed = true;
                            break;
                        }
                    }
                }

                // DPS/Assassin or if No Tank Space -> Back row (Row 0 for Bot)
                if (!placed) {
                    for (let x = 0; x < 7; x++) {
                        if (!newBoard[0][x]) {
                            newBoard[0][x] = { ...unit, position: { x, y: 0 }, startPosition: { x, y: 0 } };
                            placed = true;
                            break;
                        }
                    }
                }
            });

            // Update Bench (everything not placed)
            const remaining = allBotUnits.filter(u => !toPlace.find(p => p.id === u.id));
            const newBench = Array(9).fill(null);
            remaining.slice(0, 9).forEach((u, i) => newBench[i] = u);

            // Sync with Game Board (Bottom rows for player, Top for enemy)
            setGame(gamePrev => {
                const syncBoard = gamePrev.board.map(r => [...r]);
                newBoard.forEach((row, y) => {
                    row.forEach((u, x) => {
                        syncBoard[y][x] = u ? { ...u, team: 'ENEMY' } : null;
                    });
                });
                return { ...gamePrev, board: syncBoard };
            });

            return { ...prev, gold, level, xp, board: newBoard, bench: newBench };
        });
    };

    const handleMatchEnd = async (isWinner: boolean) => {
        if (!user || !opponent) return;

        if (opponent.id === 'bot-id') {
            alert(isWinner ? "VITÓRIA! Você derrotou a IA do Nexus." : "DERROTA! A IA foi superior desta vez.");
            setMatchId(null);
            setOpponent(null);
            setBotState(null);
            return;
        }

        if (!matchId) return;

        // Update match status for PvP
        const { error: updateError } = await supabase
            .from('matches')
            .update({
                status: 'finished',
                winner_id: isWinner ? user.id : opponent.id
            })
            .eq('id', matchId);

        if (!updateError) {
            alert(isWinner ? "VICTORY! ELO atualizado." : "DEFEAT! Better luck next time.");
            setMatchId(null);
            setOpponent(null);
            if (user) fetchUserProfile(user.id);
        }
    };

    // Combat Tick Logic & VFX update
    useEffect(() => {
        combatIntervalRef.current = setInterval(() => {
            setGame(prev => {
                // 1. Update VFX Lifespans
                const newFloatingTexts = prev.floatingTexts?.map(t => ({ ...t, life: t.life - 1 })).filter(t => t.life > 0) || [];
                const now = Date.now();
                const newProjectiles = prev.projectiles?.filter(p => now - p.startTime < p.duration) || [];

                if (prev.phase !== 'COMBAT') {
                    return { ...prev, floatingTexts: newFloatingTexts, projectiles: newProjectiles };
                }

                const newBoard = prev.board.map(r => [...r]);
                const units: CardInstance[] = [];
                for (const row of newBoard) {
                    for (const cell of row) {
                        if (cell && !cell.isDead) units.push(cell);
                    }
                }

                const newGraveyard = [...prev.graveyard];
                let roundGoldGain = 0;

                for (const unit of units) {
                    // Stun Logic
                    if (unit.isStunned) {
                        unit.stunDuration = (unit.stunDuration || 0) - 1;
                        if (unit.stunDuration <= 0) unit.isStunned = false;
                        continue;
                    }

                    const template = CARD_TEMPLATES.find(t => t.id === unit.templateId) || MONSTER_TEMPLATES.find(t => t.id === unit.templateId);
                    if (!template) continue;

                    const attackSpeed = (unit.as || template.as) || 0.6;
                    const cooldownShot = 1000 / attackSpeed;

                    let nearestEnemy: CardInstance | null = null;
                    let minDist = Infinity;

                    // Find Target
                    for (const other of units) {
                        if (other.team !== unit.team && !other.isDead) {
                            const dist = Math.abs(other.position.x - unit.position.x) + Math.abs(other.position.y - unit.position.y);
                            if (dist < minDist) {
                                minDist = dist;
                                nearestEnemy = other;
                            }
                        }
                    }

                    if (!nearestEnemy) continue;

                    // Action: Ability (Mana Check)
                    if (unit.currentMana >= template.manaMax && unit.team === 'PLAYER') { // Simplified: Player units focus logic
                        unit.currentMana = 0;
                        if (ABILITIES[template.name]) {
                            ABILITIES[template.name]({
                                unit,
                                board: newBoard,
                                units,
                                setGame,
                                rng: () => Math.random()
                            });
                            newFloatingTexts.push({
                                id: Math.random().toString(),
                                value: 'ULT!',
                                type: 'mana',
                                x: unit.position.x,
                                y: unit.position.y,
                                life: 3
                            });
                        }
                        continue;
                    }

                    // Action: Attack OR Move
                    if (minDist <= template.range) {
                        const timeSinceLast = now - (unit.lastAttackTime || 0);
                        if (timeSinceLast >= cooldownShot) {
                            unit.lastAttackTime = now;
                            const ad = unit.ad || template.ad;
                            const dmg = Math.max(1, Math.floor(unit.stars * ad * 0.15));

                            // Apply Damage
                            const enemy = nearestEnemy;
                            if (enemy.currentShield && enemy.currentShield > 0) {
                                if (enemy.currentShield >= dmg) enemy.currentShield -= dmg;
                                else {
                                    const rem = dmg - enemy.currentShield;
                                    enemy.currentShield = 0;
                                    enemy.currentHp -= rem;
                                }
                            } else {
                                enemy.currentHp -= dmg;
                            }

                            unit.currentMana = Math.min(template.manaMax, unit.currentMana + 10);

                            // VFX: Floating Damage
                            newFloatingTexts.push({
                                id: Math.random().toString(),
                                value: dmg.toString(),
                                type: 'damage',
                                x: enemy.position.x,
                                y: enemy.position.y,
                                life: 3
                            });

                            // VFX: Projectile
                            if (template.range > 1) {
                                newProjectiles.push({
                                    id: Math.random().toString(),
                                    sourcePos: { ...unit.position },
                                    targetPos: { ...enemy.position },
                                    startTime: now,
                                    duration: 300
                                });
                            }

                            if (enemy.currentHp <= 0) {
                                enemy.isDead = true;
                                // Economy: Gold Drop if Monster
                                if (enemy.team === 'ENEMY' && MONSTER_TEMPLATES.some(m => m.id === enemy.templateId)) {
                                    const dropAmount = Math.floor(Math.random() * 2) + 1;
                                    roundGoldGain += dropAmount;
                                    newFloatingTexts.push({
                                        id: Math.random().toString(),
                                        value: `+${dropAmount}G`,
                                        type: 'gold',
                                        x: enemy.position.x,
                                        y: enemy.position.y,
                                        life: 5
                                    });
                                }
                            }
                        }
                    } else {
                        // Action: Move (Better Pathing)
                        const dx = Math.sign(nearestEnemy.position.x - unit.position.x);
                        const dy = Math.sign(nearestEnemy.position.y - unit.position.y);

                        const candidates = [
                            { x: unit.position.x + dx, y: unit.position.y + dy },
                            { x: unit.position.x + dx, y: unit.position.y },
                            { x: unit.position.x, y: unit.position.y + dy }
                        ];

                        for (const cand of candidates) {
                            if (cand.x >= 0 && cand.x < 7 && cand.y >= 0 && cand.y < 4 && !newBoard[cand.y][cand.x]) {
                                newBoard[unit.position.y][unit.position.x] = null;
                                const movedUnit = { ...unit, position: { x: cand.x, y: cand.y } };
                                newBoard[cand.y][cand.x] = movedUnit;
                                Object.assign(unit, movedUnit); // Update reference in local array
                                break;
                            }
                        }
                    }
                }

                return {
                    ...prev,
                    board: newBoard,
                    gold: prev.gold + roundGoldGain,
                    floatingTexts: newFloatingTexts,
                    projectiles: newProjectiles,
                    graveyard: newGraveyard
                };
            });
        }, 200);

        return () => { if (combatIntervalRef.current) clearInterval(combatIntervalRef.current); };
    }, [game.phase]);

    const buyCard = (shopIndex: number) => {
        const card = game.shop[shopIndex];
        if (!card || game.gold < TIER_COSTS[card.tier]) return;

        const firstEmptyBench = game.bench.indexOf(null);
        if (firstEmptyBench === -1) return;

        const newInstance: CardInstance = {
            id: Math.random().toString(36).substr(2, 9),
            templateId: card.id,
            stars: 1,
            currentHp: card.hp,
            maxHp: card.hp,
            currentMana: 0,
            team: 'PLAYER',
            position: { x: -1, y: -1 },
            benchIndex: firstEmptyBench
        };

        setGame((prev: GameState) => {
            const newShop = [...prev.shop];
            newShop[shopIndex] = null;
            const tempBench = [...prev.bench];
            tempBench[firstEmptyBench] = newInstance;

            const { bench: finalBench, board: finalBoard } = checkMerges(tempBench, prev.board);

            const result = {
                ...prev,
                gold: prev.gold - TIER_COSTS[card.tier as keyof typeof TIER_COSTS],
                shop: newShop,
                bench: finalBench,
                board: finalBoard
            };
            broadcastBoard(finalBoard);
            return result;
        });
    };

    const checkMerges = (currentBench: (CardInstance | null)[], currentBoard: (CardInstance | null)[][]): { bench: (CardInstance | null)[], board: (CardInstance | null)[][] } => {
        let newBench = [...currentBench];
        const newBoard = currentBoard.map(row => [...row]);

        let merged = false;

        // Collect all player units
        const allUnits: { unit: CardInstance, type: 'board' | 'bench', x?: number, y?: number, index?: number }[] = [];

        newBoard.forEach((row, y) => row.forEach((u, x) => {
            if (u && u.team === 'PLAYER' && u.stars < 3) allUnits.push({ unit: u, type: 'board', x, y });
        }));
        newBench.forEach((u, i) => {
            if (u && u.stars < 3) allUnits.push({ unit: u, type: 'bench', index: i });
        });

        // Group by ID_Stars
        const groups: Record<string, typeof allUnits> = {};
        allUnits.forEach(item => {
            const key = `${item.unit.templateId}_${item.unit.stars}`;
            if (!groups[key]) groups[key] = [];
            groups[key].push(item);
        });

        // Process Merges
        Object.values(groups).forEach(group => {
            if (group.length >= 3) {
                // Prioritize keeping Board unit, then Bench
                group.sort((a, b) => {
                    if (a.type === 'board' && b.type === 'bench') return -1;
                    if (a.type === 'bench' && b.type === 'board') return 1;
                    return 0;
                });

                const target = group[0];
                const sacrifice1 = group[1];
                const sacrifice2 = group[2];

                // Upgrade Target
                const upgradedUnit = {
                    ...target.unit,
                    stars: (target.unit.stars + 1) as 1 | 2 | 3,
                    maxHp: target.unit.maxHp * 1.8,
                    currentHp: target.unit.maxHp * 1.8,
                    currentMana: 0,
                    currentShield: 0,
                    isDead: false, // Revive if dead
                    isStunned: false
                };

                if (target.type === 'board') {
                    newBoard[target.y!][target.x!] = upgradedUnit;
                } else {
                    newBench[target.index!] = upgradedUnit;
                }

                // Remove Sacrifices
                [sacrifice1, sacrifice2].forEach(sac => {
                    if (sac.type === 'board') newBoard[sac.y!][sac.x!] = null;
                    else newBench[sac.index!] = null;
                });

                merged = true;
            }
        });

        if (merged) {
            return checkMerges(newBench, newBoard);
        }

        return { bench: newBench, board: newBoard };
    };

    const sellUnit = (index: number | { x: number, y: number }, from: 'bench' | 'board') => {
        setGame(prev => {
            const newGold = prev.gold + 1; // Simplificado: 1g por venda por enquanto, ou calcular (tier * stars * 0.5)
            const newBoard = prev.board.map(r => [...r]);
            const newBench = [...prev.bench];

            if (from === 'bench') {
                const card = newBench[index as number];
                if (card) {
                    // Refunds
                    const refund = Math.floor((TIER_COSTS[CARD_TEMPLATES.find(c => c.id === card.templateId)?.tier || 1] || 1) * card.stars * 0.7);
                    newBench[index as number] = null;
                    return { ...prev, gold: prev.gold + Math.max(1, refund), bench: newBench };
                }
            } else {
                const { x, y } = index as { x: number, y: number };
                const unit = newBoard[y][x];
                if (unit) {
                    const refund = Math.floor((TIER_COSTS[CARD_TEMPLATES.find(c => c.id === unit.templateId)?.tier || 1] || 1) * unit.stars * 0.7);
                    newBoard[y][x] = null;
                    return { ...prev, gold: prev.gold + Math.max(1, refund), board: newBoard };
                }
            }
            const result = prev;
            broadcastBoard(prev.board); // Still broadcast just in case, though ideally only on change
            return result;
        });
        setSelectedInBench(null);
        setSelectedInBoard(null);
    };

    const handleBoardClick = (row: number, col: number) => {
        // CASE 1: Bench -> Board (Placement)
        if (selectedInBench !== null) {
            if (game.phase !== 'PLANNING') {
                setSelectedInBench(null);
                return;
            }
            setGame(prev => {
                const newBoard = prev.board.map(r => [...r]);
                const newBench = [...prev.bench];
                const existingInSlot = newBoard[row][col];

                if (existingInSlot && existingInSlot.team === 'ENEMY') return prev;

                const currentUnits = newBoard.flat().filter(u => u && u.team === 'PLAYER').length;
                if (!existingInSlot && currentUnits >= prev.level) return prev; // Cap reached

                const card = newBench[selectedInBench];
                if (!card) return prev;

                const nextUnit = { ...card, position: { x: col, y: row }, startPosition: { x: col, y: row }, benchIndex: undefined };
                newBoard[row][col] = nextUnit;
                newBench[selectedInBench] = existingInSlot ? { ...existingInSlot, benchIndex: selectedInBench, position: { x: -1, y: -1 } } : null;

                broadcastBoard(newBoard);
                return { ...prev, board: newBoard, bench: newBench };
            });
            setSelectedInBench(null);
            return;
        }

        // Move Board Unit
        if (selectedInBoard) {
            if (game.phase !== 'PLANNING') {
                setSelectedInBoard(null);
                return;
            }
            setGame(prev => {
                const newBoard = prev.board.map(r => [...r]);
                const sourceUnit = newBoard[selectedInBoard.y][selectedInBoard.x];
                if (!sourceUnit) return prev;

                const targetUnit = newBoard[row][col];
                if (targetUnit && targetUnit.team === 'ENEMY') return prev;

                newBoard[selectedInBoard.y][selectedInBoard.x] = targetUnit ? { ...targetUnit, position: { x: selectedInBoard.x, y: selectedInBoard.y }, startPosition: { x: selectedInBoard.x, y: selectedInBoard.y } } : null;
                newBoard[row][col] = { ...sourceUnit, position: { x: col, y: row }, startPosition: { x: col, y: row } };

                broadcastBoard(newBoard);
                return { ...prev, board: newBoard };
            });
            setSelectedInBoard(null);
            return;
        }

        // CASE 3: Select Board Unit
        const clickedUnit = game.board[row][col];
        if (clickedUnit && clickedUnit.team === 'PLAYER') {
            setSelectedInBoard({ x: col, y: row });
        }
    };

    const recallToBench = (x: number, y: number) => {
        setGame(prev => {
            const firstEmpty = prev.bench.indexOf(null);
            if (firstEmpty === -1) return prev;

            const newBoard = prev.board.map(r => [...r]);
            const unit = newBoard[y][x];
            if (!unit) return prev;

            const newBench = [...prev.bench];
            newBench[firstEmpty] = { ...unit, position: { x: -1, y: -1 }, benchIndex: firstEmpty, startPosition: undefined };
            newBoard[y][x] = null;

            broadcastBoard(newBoard);
            return { ...prev, board: newBoard, bench: newBench };
        });
        setSelectedInBoard(null);
    };

    const rerollShop = () => {
        if (game.gold < REROLL_COST) return;
        setGame((prev: GameState) => ({
            ...prev,
            gold: prev.gold - REROLL_COST,
            shop: generateShop(prev.level)
        }));
    };

    const buyXP = () => {
        if (game.gold < XP_COST) return;
        setGame((prev: GameState) => {
            let newXp = prev.xp + XP_AMOUNT;
            let newLevel = prev.level;
            const xpNeeded = newLevel * 4;
            if (newXp >= xpNeeded) {
                newXp -= xpNeeded;
                newLevel += 1;
            }
            return { ...prev, gold: prev.gold - XP_COST, xp: newXp, level: newLevel };
        });
    };

    const handleBenchClick = (index: number) => {
        // CASE 1: Bench -> Bench (Swap/Move)
        if (selectedInBench !== null) {
            if (game.phase !== 'PLANNING') {
                setSelectedInBench(null);
                return;
            }
            if (selectedInBench === index) {
                setSelectedInBench(null);
                return;
            }
            setGame(prev => {
                const newBench = [...prev.bench];
                const sourceUnit = newBench[selectedInBench];
                const targetUnit = newBench[index];

                newBench[selectedInBench] = targetUnit ? { ...targetUnit, benchIndex: selectedInBench } : null;
                newBench[index] = sourceUnit ? { ...sourceUnit, benchIndex: index } : null;

                return { ...prev, bench: newBench };
            });
            setSelectedInBench(null);
            return;
        }

        // CASE 2: Board -> Bench (Swap/Recall)
        if (selectedInBoard) {
            if (game.phase !== 'PLANNING') {
                setSelectedInBoard(null);
                return;
            }
            setGame(prev => {
                const newBoard = prev.board.map(r => [...r]);
                const newBench = [...prev.bench];
                const { x, y } = selectedInBoard;
                const sourceUnit = newBoard[y][x];
                const targetUnit = newBench[index];

                if (!sourceUnit) return prev;

                // Recall Board Unit to Bench
                newBoard[y][x] = targetUnit ? { ...targetUnit, position: { x, y }, startPosition: { x, y }, benchIndex: undefined } : null;
                newBench[index] = { ...sourceUnit, benchIndex: index, position: { x: -1, y: -1 }, startPosition: undefined };

                return { ...prev, board: newBoard, bench: newBench };
            });
            setSelectedInBoard(null);
            return;
        }

        // CASE 3: Select Bench Unit (Allowed in all phases)
        if (game.bench[index]) {
            setSelectedInBench(index);
        }
    };

    if (sessionLoading) {
        return (
            <div className="h-screen bg-[#0a0a0c] flex items-center justify-center">
                <Loader2 className="w-12 h-12 text-purple-500 animate-spin" />
            </div>
        );
    }

    if (!user) {
        return <Auth onAuthComplete={() => { }} />;
    }

    if (!matchId) {
        return (
            <div className="h-screen bg-[#0a0a0c] flex flex-col items-center justify-center p-4 relative overflow-hidden">
                {/* Header for Lobby */}
                <div className="absolute top-8 left-8 right-8 flex justify-between items-center z-20">
                    <div className="flex items-center gap-3 px-4 py-2 bg-white/5 border border-white/10 rounded-xl">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center font-bold text-sm">
                            {user.username[0].toUpperCase()}
                        </div>
                        <div className="flex flex-col leading-none">
                            <span className="text-sm font-bold text-white">{user.username}</span>
                            <span className="text-[10px] text-purple-300 font-black uppercase tracking-wider">{user.elo} ELO</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setIsGalleryOpen(true)}
                            className="p-3 bg-white/5 border border-white/10 rounded-xl hover:bg-purple-500/10 hover:border-purple-500/20 text-slate-400 hover:text-purple-400 transition-all flex items-center gap-2 font-bold text-sm mr-2"
                        >
                            <BookOpen size={18} /> COLEÇÃO
                        </button>
                        <button
                            onClick={handleSignOut}
                            className="p-3 bg-white/5 border border-white/10 rounded-xl hover:bg-rose-500/10 hover:border-rose-500/20 text-slate-400 hover:text-rose-500 transition-all flex items-center gap-2 font-bold text-sm"
                        >
                            <LogOut size={18} /> LOGOUT
                        </button>
                    </div>
                </div>

                <Matchmaking user={user} onMatchFound={handleMatchFound} />

                {isGalleryOpen && <CardGallery onClose={() => setIsGalleryOpen(false)} />}
            </div>
        );
    }

    return (
        <div className="flex flex-col h-screen bg-[#0a0a0c] text-white p-4 font-['Outfit'] overflow-hidden relative selection:bg-purple-500/30">
            {/* Background Ambience */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
                <div className="absolute top-[-50%] left-[-20%] w-[80%] h-[80%] bg-purple-900/10 blur-[150px] rounded-full mix-blend-screen" />
                <div className="absolute bottom-[-50%] right-[-20%] w-[80%] h-[80%] bg-blue-900/10 blur-[150px] rounded-full mix-blend-screen" />
            </div>

            {/* Top Bar (Stats & Info) */}
            <div className="flex justify-between items-center mb-4 bg-[#15151a]/80 backdrop-blur-md p-3 rounded-2xl border border-white/5 relative z-20 shadow-lg">
                <div className={`absolute left-0 bottom-0 h-0.5 bg-gradient-to-r from-purple-500 to-blue-500 transition-all duration-1000 ease-linear shadow-[0_0_10px_rgba(139,92,246,0.5)]`}
                    style={{ width: `${(game.timer / (game.phase === 'PLANNING' ? PHASE_DURATION.PLANNING : PHASE_DURATION.COMBAT)) * 100}%` }} />

                <div className="flex items-center gap-6">
                    {/* User Profile */}
                    <div className="flex items-center gap-3 px-4 py-2 bg-white/5 border border-white/10 rounded-xl">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center font-bold text-sm">
                            {user.username[0].toUpperCase()}
                        </div>
                        <div className="flex flex-col leading-none">
                            <span className="text-sm font-bold text-white">{user.username}</span>
                            <span className="text-[10px] text-purple-300 font-black uppercase tracking-wider">{user.elo} ELO</span>
                        </div>
                    </div>

                    <div className="w-px h-8 bg-white/5" />

                    <div className="flex items-center gap-2 text-amber-400 bg-amber-400/10 px-3 py-1.5 rounded-lg border border-amber-400/20">
                        <Coins size={18} />
                        <span className="text-xl font-bold">{game.gold}</span>
                    </div>

                    <div className="flex items-center gap-3 relative group cursor-help">
                        {/* XP Circle */}
                        <div className="relative w-10 h-10 flex items-center justify-center">
                            <svg className="absolute inset-0 w-full h-full -rotate-90">
                                <circle cx="20" cy="20" r="16" className="stroke-white/10 fill-none" strokeWidth="3" />
                                <circle
                                    cx="20" cy="20" r="16"
                                    className="stroke-blue-500 fill-none transition-all duration-500"
                                    strokeWidth="3"
                                    strokeDasharray={100}
                                    strokeDashoffset={100 - ((game.xp / (game.level * 4)) * 100)}
                                    strokeLinecap="round"
                                />
                            </svg>
                            <span className="text-sm font-black relative z-10">{game.level}</span>
                        </div>
                        <div className="flex flex-col leading-tight">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Nível</span>
                            <span className="text-[10px] text-slate-500">{game.xp} / {game.level * 4} XP</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 text-slate-300">
                        <Users size={18} />
                        <span className="text-lg font-bold">
                            {game.board.flat().filter(u => u && u.team === 'PLAYER').length} <span className="text-slate-600 text-sm">/ {game.level}</span>
                        </span>
                    </div>
                </div>

                <div className="absolute left-1/2 -translate-x-1/2 bg-black/40 px-6 py-2 rounded-xl text-slate-200 font-black uppercase tracking-[0.2em] text-sm border border-white/5 flex items-center gap-3 shadow-inner">
                    {game.phase === 'PLANNING' ? <LayoutGrid size={14} className="text-blue-400" /> : <Swords size={14} className="text-rose-500 animate-pulse" />}
                    {game.phase === 'PLANNING' ? 'Planejamento' : 'Combate'}
                    <span className="w-px h-4 bg-white/10 mx-1" />
                    <span className="text-white font-mono">{game.timer}s</span>
                </div>

                <div className="flex items-center gap-4">
                    {opponent?.id === 'bot-id' && (
                        <button
                            onClick={() => {
                                if (window.confirm("Deseja mesmo desistir da partida contra a IA? Isso encerrará seu treino.")) {
                                    handleMatchEnd(false);
                                }
                            }}
                            className="flex items-center gap-2 px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 rounded-lg text-rose-500 text-[10px] font-black uppercase tracking-widest transition-all group"
                        >
                            <X size={14} className="group-hover:rotate-90 transition-transform" />
                            Sair
                        </button>
                    )}
                    {opponent && (
                        <div className="flex items-center gap-3 px-3 py-1.5 bg-rose-500/10 border border-rose-500/20 rounded-xl animate-in slide-in-from-right-4 duration-500">
                            <div className="flex flex-col items-end leading-none">
                                <span className="text-[10px] text-rose-300 font-black uppercase tracking-tighter truncate max-w-[80px]">{opponent.username}</span>
                                <span className="text-[9px] text-rose-500/50 font-bold tracking-widest">{opponent.elo} ELO</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-rose-400">
                                <Heart size={14} fill="currentColor" className="drop-shadow-[0_0_5px_rgba(244,63,94,0.5)]" />
                                <span className="text-sm font-black">{opponent.health ?? 100}</span>
                            </div>
                        </div>
                    )}
                    <div className="flex items-center gap-2 text-rose-500 bg-rose-500/10 px-3 py-1.5 rounded-lg border border-rose-500/20">
                        <Heart size={18} fill="currentColor" />
                        <span className="text-xl font-bold">{game.health}</span>
                    </div>
                    <div className="text-[10px] text-slate-500 font-bold px-3 py-1 bg-white/5 rounded-lg border border-white/5">
                        ROUND {game.round}
                    </div>
                    <button
                        onClick={handleSignOut}
                        className="p-2.5 bg-white/5 border border-white/10 rounded-xl hover:bg-rose-500/10 hover:border-rose-500/20 text-slate-400 hover:text-rose-500 transition-all"
                        title="Sair"
                    >
                        <LogOut size={18} />
                    </button>
                </div>
            </div>

            {/* Main Content Area (Board) */}
            <div className="flex-1 relative flex items-center justify-center mb-4 z-10 perspective-[1000px]">
                {/* Thematic Board Container: Dark Mossy/Grass Theme */}
                <div className="w-full max-w-5xl aspect-[7/4] bg-[#0E1512] rounded-3xl border-4 border-[#2A3E32] p-4 grid grid-rows-4 grid-cols-7 gap-2 relative shadow-[0_0_50px_rgba(34,197,94,0.1)] transform transition-all duration-500 overflow-hidden">

                    {/* Texture/Grass Effect */}
                    <div className="absolute inset-0 opacity-20 pointer-events-none"
                        style={{
                            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%2322c55e' fill-opacity='0.2'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
                        }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-b from-[#152e22]/50 via-transparent to-[#0a120e]/80 pointer-events-none" />

                    {/* Center Line */}
                    <div className="absolute inset-x-0 top-1/2 h-0.5 bg-emerald-500/10 pointer-events-none blur-[1px]" />

                    {/* VFX: Floating Text */}
                    <AnimatePresence>
                        {game.floatingTexts?.map(text => (
                            <motion.div
                                key={text.id}
                                initial={{ opacity: 1, y: 0, scale: 1 }}
                                animate={{ opacity: 0, y: -60, scale: 1.5 }}
                                transition={{ duration: 0.8 }}
                                className={`absolute z-[100] font-black pointer-events-none drop-shadow-md select-none
                                    ${text.type === 'damage' ? 'text-white text-lg' :
                                        text.type === 'gold' ? 'text-amber-400 text-xl' :
                                            text.type === 'mana' ? 'text-blue-400 text-lg' : 'text-emerald-400 text-lg'}`}
                                style={{
                                    left: `${text.x * 14.28 + 3}%`,
                                    top: `${text.y * 25 + 5}%`,
                                }}
                            >
                                {text.type === 'gold' ? <span className="flex items-center gap-1"><Coins size={14} /> {text.value}</span> : text.value}
                            </motion.div>
                        ))}
                    </AnimatePresence>

                    {/* VFX: Projectiles */}
                    {game.projectiles?.map(p => (
                        <motion.div
                            key={p.id}
                            initial={{ left: `${p.sourcePos.x * 14.28 + 7}%`, top: `${p.sourcePos.y * 25 + 12}%`, opacity: 1 }}
                            animate={{ left: `${p.targetPos.x * 14.28 + 7}%`, top: `${p.targetPos.y * 25 + 12}%`, opacity: 0.5 }}
                            transition={{ duration: 0.3, ease: "linear" }}
                            className="absolute w-3 h-3 bg-blue-400 rounded-full shadow-[0_0_15px_#60a5fa] z-[90] pointer-events-none"
                        >
                            <div className="w-full h-full bg-white/50 rounded-full animate-ping" />
                        </motion.div>
                    ))}

                    {game.board.map((row, rIdx) =>
                        row.map((cell, cIdx) => (
                            <div
                                key={`${rIdx}-${cIdx}`}
                                onClick={() => handleBoardClick(rIdx, cIdx)}
                                className={`rounded-xl border transition-all duration-300 flex items-center justify-center cursor-pointer relative overflow-visible group
                                    ${selectedInBoard?.x === cIdx && selectedInBoard?.y === rIdx ? 'border-emerald-400 shadow-[0_0_20px_rgba(52,211,153,0.3)] z-20 bg-emerald-400/10' : ''}
                                    ${cell && !cell.isDead ? (cell.team === 'PLAYER' ? 'bg-[#1c2e24] border-emerald-500/40 hover:border-emerald-400' : 'bg-[#2a1a1a] border-rose-500/40') : 'bg-white/[0.02] border-white/5 hover:bg-white/5'}`}
                            >
                                {cell && !cell.isDead && (
                                    <div className="flex flex-col items-center w-full px-1 relative">
                                        {/* Sell Button Board */}
                                        {cell.team === 'PLAYER' && selectedInBoard?.x === cIdx && selectedInBoard?.y === rIdx && (
                                            <div
                                                className="absolute -top-3 -right-3 z-50 text-[10px] bg-red-500 hover:bg-red-600 text-white w-5 h-5 flex items-center justify-center rounded-full cursor-pointer shadow-lg animate-bounce"
                                                onClick={(e) => { e.stopPropagation(); sellUnit({ x: cIdx, y: rIdx }, 'board'); }}
                                                title="Vender (70%)"
                                            >
                                                $
                                            </div>
                                        )}

                                        {/* Unit Visual & Name Overlay */}
                                        <div className={`w-28 h-36 rounded-xl flex flex-col items-center justify-center text-lg shadow-2xl relative overflow-hidden border-2
                                            ${cell.team === 'PLAYER'
                                                ? 'bg-gradient-to-br from-indigo-900/90 to-purple-900 border-white ring-2 ring-purple-500/30'
                                                : 'bg-gradient-to-br from-rose-900 to-red-950 border-rose-500/40 grayscale-[0.2]'}`}
                                        >
                                            <UnitArt
                                                name={(CARD_TEMPLATES.find(t => t.id === cell.templateId) || MONSTER_TEMPLATES.find(t => t.id === cell.templateId))?.name || '?'}
                                                className="opacity-95"
                                            />

                                            {/* Stun Indicator */}
                                            {cell.isStunned && <div className="absolute inset-0 bg-yellow-400/50 animate-pulse flex items-center justify-center text-3xl">💫</div>}

                                            {/* Shield */}
                                            {(cell.currentShield || 0) > 0 && <div className="absolute inset-0 border-4 border-white/50 rounded-lg opacity-60 animate-pulse" />}

                                            {/* Name Overlay (Mockup Style) */}
                                            <div className="absolute bottom-0 left-0 right-0 bg-black/70 py-1 px-0.5 flex justify-center border-t border-white/10">
                                                <span className={`text-[10px] font-black uppercase truncate max-w-full tracking-wider ${cell.team === 'PLAYER' ? 'text-white' : 'text-rose-200'}`}>
                                                    {(CARD_TEMPLATES.find(t => t.id === cell.templateId) || MONSTER_TEMPLATES.find(t => t.id === cell.templateId))?.name}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Footer: Status Bars + Stars */}
                                        <div className="flex items-center gap-2 mt-2 w-full justify-center">
                                            {/* Bars */}
                                            <div className="flex flex-col gap-1 w-[60px]">
                                                <div className="w-full h-1.5 bg-black/60 rounded-full overflow-hidden border border-black/20 shadow-inner">
                                                    <div className={`h-full ${cell.team === 'PLAYER' ? 'bg-emerald-400' : 'bg-rose-500'}`} style={{ width: `${(cell.currentHp / cell.maxHp) * 100}%` }} />
                                                </div>
                                                <div className="w-full h-1.5 bg-black/60 rounded-full overflow-hidden border border-black/20 shadow-inner">
                                                    <div className="h-full bg-blue-400" style={{ width: `${cell.currentMana}%` }} />
                                                </div>
                                            </div>

                                            {/* Stars (Next to bars) */}
                                            {cell.stars > 1 && (
                                                <div className="flex gap-1">
                                                    {Array(cell.stars).fill(0).map((_, i) => (
                                                        <div key={i} className="w-2.5 h-2.5 rotate-45 bg-yellow-400 shadow-[0_0_5px_rgba(251,191,36,0.9)] border border-black/20" />
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>

                {/* Shop Modal / Overlay */}
                {isShopOpen && (
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 translate-y-0 w-[500px] bg-[#1a1a20] rounded-2xl border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.8)] z-50 animate-in slide-in-from-bottom-5 fade-in duration-300 flex flex-col overflow-hidden">
                        <div className="px-4 py-3 border-b border-white/5 flex justify-between items-center bg-[#15151a]">
                            <div className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                                <ShoppingCart size={14} className="text-green-400" /> Loja do Nexus
                            </div>
                            <button onClick={() => setIsShopOpen(false)} className="text-slate-500 hover:text-white transition-colors">✕</button>
                        </div>
                        <div className="p-2 grid grid-cols-1 gap-1 max-h-[400px] overflow-y-auto custom-scrollbar">
                            {game.shop.map((card, idx) => {
                                const tierColors: Record<number, string> = {
                                    1: 'border-slate-600/50 from-slate-900/90 to-slate-800/90',
                                    2: 'border-emerald-600/50 from-emerald-900/90 to-emerald-800/90',
                                    3: 'border-sky-600/50 from-sky-900/90 to-sky-800/90',
                                    4: 'border-violet-600/50 from-violet-900/90 to-violet-800/90',
                                    5: 'border-amber-500/50 from-amber-900/90 to-amber-800/90',
                                };
                                return (
                                    <div key={idx} onClick={() => buyCard(idx)}
                                        className={`relative h-20 rounded-lg border flex items-center p-3 gap-3 cursor-pointer transition-all hover:brightness-125 active:scale-[0.98]
                                            ${card ? `bg-gradient-to-r ${tierColors[card.tier]}` : 'bg-white/5 border-white/5 opacity-30 pointer-events-none'}`}>
                                        {card ? (
                                            <>
                                                <div className="w-12 h-16 rounded-lg bg-black/30 flex items-center justify-center text-xl font-bold border border-white/10 shadow-inner overflow-hidden">
                                                    <UnitArt name={card.name} />
                                                </div>
                                                <div className="flex-1 flex flex-col justify-center">
                                                    <div className="flex justify-between items-center">
                                                        <span className="font-bold text-sm text-white">{card.name}</span>
                                                        <div className="px-2 py-1 rounded bg-black/40 border border-white/10 text-amber-400 font-black text-xs flex items-center gap-1">
                                                            <Coins size={10} /> {TIER_COSTS[card.tier]}
                                                        </div>
                                                    </div>
                                                    <div className="flex gap-2 text-[10px] text-white/50 mt-0.5">
                                                        {card.traits.map(t => <span key={t}>{t}</span>)}
                                                    </div>
                                                </div>
                                                {/* Ability Mini Info */}
                                                <div className="flex flex-col items-end gap-1 text-[9px] text-white/40">
                                                    <span className="flex items-center gap-1"><Swords size={10} /> {card.ad}</span>
                                                    <span className="flex items-center gap-1"><Heart size={10} /> {card.hp}</span>
                                                </div>
                                            </>
                                        ) : <span className="m-auto text-xs font-bold uppercase tracking-widest opacity-50">Vendido</span>}
                                    </div>
                                )
                            })}
                        </div>
                        <div className="p-2 border-t border-white/5 bg-[#15151a] flex gap-2">
                            <button onClick={rerollShop} className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-colors">
                                <RefreshCw size={12} /> Atualizar (2g)
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Bottom Dock */}
            <div className="h-44 bg-[#15151a] rounded-2xl border border-white/5 flex p-4 gap-4 shadow-2xl z-30 relative">

                {/* 1. Synergies (Left) */}
                <div className="w-48 flex flex-col gap-2 overflow-hidden">
                    <div className="text-[10px] uppercase font-bold text-slate-500 tracking-widest flex items-center gap-2">
                        <Shield size={12} /> Sinergias
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-wrap content-start gap-1.5 align-content-start">
                        {(() => {
                            const units = game.board.flatMap(r => r).filter(u => u && u.team === 'PLAYER') as CardInstance[];
                            const traits: Record<string, number> = {};
                            const unique = new Set<string>();
                            units.forEach(u => {
                                if (!unique.has(u.templateId)) {
                                    CARD_TEMPLATES.find(t => t.id === u.templateId)?.traits.forEach(tr => traits[tr] = (traits[tr] || 0) + 1);
                                    unique.add(u.templateId);
                                }
                            });
                            const entries = Object.entries(traits);
                            if (entries.length === 0) return <span className="text-[10px] text-white/20 italic p-2">Nenhuma sinergia ativa</span>;

                            return entries.map(([trait, count]) => (
                                <div key={trait} className="group relative">
                                    <div className={`px-2 py-1 rounded text-[10px] font-bold border transition-colors cursor-help flex items-center gap-1
                                        ${count >= 2 ? 'bg-purple-500/20 border-purple-500 text-purple-200' : 'bg-white/5 border-white/10 text-slate-500'}`}>
                                        {trait} <span className="bg-black/30 px-1 rounded text-[9px]">{count}</span>
                                    </div>
                                    {/* Tooltip */}
                                    <div className="absolute bottom-full left-0 mb-2 w-32 bg-black/90 text-white text-[10px] p-2 rounded border border-white/10 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
                                        Efeito de {trait} (Exemplo)
                                    </div>
                                </div>
                            ));
                        })()}
                    </div>
                </div>

                <div className="w-[1px] bg-white/10 h-full" />

                {/* 2. Bench & Shop Toggle (Center) */}
                <div className="flex-1 flex flex-col justify-between">
                    <div className="flex justify-between items-end mb-1">
                        <div className="text-[10px] uppercase font-bold text-slate-500 tracking-widest pl-1">Banco de Reservas</div>
                        {/* Shop Toggle Button */}
                        <button
                            onClick={() => setIsShopOpen(!isShopOpen)}
                            className={`px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all shadow-lg
                             ${isShopOpen ? 'bg-green-500 text-black shadow-green-500/40 hover:bg-green-400' : 'bg-slate-700 text-slate-200 hover:bg-slate-600 border border-white/5'}`}
                        >
                            <ShoppingCart size={12} /> {isShopOpen ? 'Fechar Loja' : 'Abrir Loja'}
                        </button>
                    </div>

                    <div className="flex-1 bg-black/20 rounded-xl border border-white/5 p-2 flex gap-2">
                        {game.bench.map((cell, idx) => {
                            const template = cell ? CARD_TEMPLATES.find(t => t.id === cell.templateId) : null;
                            const tierColors: Record<number, string> = {
                                1: 'border-slate-600 from-slate-900 to-slate-800 shadow-slate-500/20 text-slate-200',
                                2: 'border-emerald-600 from-emerald-900 to-emerald-800 shadow-emerald-500/20 text-emerald-200',
                                3: 'border-sky-600 from-sky-900 to-sky-800 shadow-sky-500/20 text-sky-200',
                                4: 'border-violet-600 from-violet-900 to-violet-800 shadow-violet-500/20 text-violet-200',
                                5: 'border-amber-500 from-amber-900 to-amber-800 shadow-amber-500/20 text-amber-200',
                            };

                            return (
                                <div
                                    key={idx}
                                    onClick={() => handleBenchClick(idx)}
                                    className={`flex-1 rounded-lg border transition-all duration-200 flex flex-col items-center justify-center cursor-pointer relative overflow-hidden group
                                        ${selectedInBench === idx ? 'border-amber-400 bg-amber-400/10' :
                                            cell && template ? `bg-gradient-to-br ${tierColors[template.tier]}` : 'bg-white/[0.03] border-white/5 hover:bg-white/5'}`}
                                >
                                    {cell && template ? (
                                        <>
                                            <div className="w-20 h-28 rounded-xl flex items-center justify-center text-xl mb-1 drop-shadow-md bg-black/20 overflow-hidden ring-2 ring-white/10 group-hover:ring-white/30 transition-all">
                                                <UnitArt name={template.name} />
                                            </div>
                                            <span className="text-[9px] font-bold uppercase truncate max-w-[50px]">{template.name}</span>
                                            <div className="flex gap-0.5 mt-1">
                                                {Array(cell.stars).fill(0).map((_, i) => (
                                                    <div key={i} className="w-1 h-1 rounded-full bg-amber-400 shadow-[0_0_2px_rgba(251,191,36,0.8)]" />
                                                ))}
                                            </div>
                                            {/* Sell Button Bench */}
                                            {selectedInBench === idx && (
                                                <div
                                                    className="absolute -top-1 -right-1 z-50 text-[8px] bg-red-500 hover:bg-red-600 text-white w-4 h-4 flex items-center justify-center rounded-bl-lg cursor-pointer"
                                                    onClick={(e) => { e.stopPropagation(); sellUnit(idx, 'bench'); }}
                                                >
                                                    $
                                                </div>
                                            )}
                                        </>
                                    ) : <div className="text-white/5 text-[8px] font-mono">{idx + 1}</div>}
                                </div>
                            )
                        })}
                    </div>
                </div>

                <div className="w-[1px] bg-white/10 h-full" />

                {/* 3. Actions (Right) */}
                <div className="w-40 flex flex-col gap-2">
                    <button
                        onClick={buyXP}
                        className="h-20 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl font-bold flex items-center justify-between px-4 hover:brightness-110 active:scale-95 transition-all shadow-lg shadow-blue-500/20 text-white group"
                    >
                        <div className="flex flex-col items-start leading-none gap-1">
                            <span className="text-[10px] opacity-70">Comprar XP</span>
                            <span className="text-sm font-black text-blue-100">+4 XP</span>
                        </div>
                        <div className="bg-black/20 p-2 rounded-lg group-hover:bg-black/30 transition-colors">
                            <ArrowUpCircle size={16} />
                        </div>
                    </button>

                    {(selectedInBench !== null || selectedInBoard !== null) ? (
                        <button
                            onClick={() => {
                                if (selectedInBench !== null) sellUnit(selectedInBench, 'bench');
                                else if (selectedInBoard !== null) sellUnit(selectedInBoard, 'board');
                            }}
                            className="h-10 bg-rose-500/20 border border-rose-500/50 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-rose-500/30 active:scale-95 transition-all text-rose-400 group animate-in slide-in-from-right-2"
                        >
                            <ShoppingCart size={14} className="group-hover:rotate-12 transition-transform" />
                            <span className="text-xs uppercase tracking-tight">Vender Unidade</span>
                        </button>
                    ) : (
                        <button
                            onClick={rerollShop}
                            className="h-10 bg-[#252530] border border-white/10 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-white/10 active:scale-95 transition-all text-slate-300 hover:text-white"
                        >
                            <RefreshCw size={14} />
                            <span className="text-xs uppercase tracking-wide">Atualizar</span>
                            <span className="text-[10px] bg-black/40 px-1.5 rounded text-amber-500 font-black">2g</span>
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default App;
