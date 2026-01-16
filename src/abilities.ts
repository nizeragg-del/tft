import { CardInstance, GameState } from './types';

type AbilityContext = {
    unit: CardInstance;
    board: (CardInstance | null)[][];
    units: CardInstance[];
    setGame: React.Dispatch<React.SetStateAction<GameState>>;
};

export const ABILITIES: Record<string, (ctx: AbilityContext) => void> = {
    // ========== TIER 1 ==========
    'Vanguard': ({ unit }) => {
        unit.currentShield = (unit.currentShield || 0) + 200 * unit.stars;
    },
    'Stinger': ({ unit, units }) => {
        const target = findNearestEnemy(unit, units);
        if (target) {
            target.currentHp -= 100 * unit.stars;
            if (target.currentHp <= 0) target.isDead = true;
        }
    },
    'Ranger': ({ unit }) => {
        // Rapid Fire: AS boost
        unit.as = (unit.as || 0.75) * 1.5;
    },
    'Scrap': ({ unit }) => {
        unit.currentShield = (unit.currentShield || 0) + 150 * unit.stars;
    },
    'Acolyte': ({ unit, units }) => {
        const allies = units.filter(u => u.team === unit.team && !u.isDead && u !== unit);
        if (allies.length > 0) {
            const lowest = allies.reduce((prev, curr) =>
                curr.currentHp < prev.currentHp ? curr : prev
            );
            lowest.currentHp = Math.min(lowest.maxHp, lowest.currentHp + 200 * unit.stars);
        }
    },
    'Drone': ({ unit, units }) => {
        const enemies = units.filter(u => u.team !== unit.team && !u.isDead);
        for (let i = 0; i < Math.min(2, enemies.length); i++) {
            const target = enemies[Math.floor(Math.random() * enemies.length)];
            target.currentHp -= 80 * unit.stars;
            if (target.currentHp <= 0) target.isDead = true;
        }
    },

    // ========== TIER 2 ==========
    'Oracle': ({ unit, units }) => {
        const target = findNearestEnemy(unit, units);
        if (target) {
            target.currentHp -= 150 * unit.stars;
            if (target.currentHp <= 0) target.isDead = true;
        }
    },
    'Brawler': ({ unit, units }) => {
        units.forEach(other => {
            if (other.team !== unit.team && !other.isDead) {
                const dist = Math.abs(other.position.x - unit.position.x) + Math.abs(other.position.y - unit.position.y);
                if (dist <= 1) {
                    other.isStunned = true;
                    other.stunDuration = 3;
                }
            }
        });
    },
    'Shadowblade': ({ unit, units }) => {
        const target = findNearestEnemy(unit, units);
        if (target) {
            target.currentHp -= 200 * unit.stars;
            if (target.currentHp <= 0) target.isDead = true;
        }
    },
    'Sentinel': ({ unit }) => {
        unit.currentShield = (unit.currentShield || 0) + 300 * unit.stars;
    },
    'Blaster': ({ unit, units }) => {
        const enemies = units.filter(u => u.team !== unit.team && !u.isDead);
        for (let i = 0; i < Math.min(3, enemies.length); i++) {
            const target = enemies[Math.floor(Math.random() * enemies.length)];
            target.currentHp -= 100 * unit.stars;
            if (target.currentHp <= 0) target.isDead = true;
        }
    },
    'Nomad': ({ unit, units }) => {
        const target = findNearestEnemy(unit, units);
        if (target) {
            target.currentHp -= 180 * unit.stars;
            if (target.currentHp <= 0) target.isDead = true;
        }
    },

    // ========== TIER 3 ==========
    'Sniper': ({ unit, units }) => {
        units.forEach(other => {
            if (other.team !== unit.team && !other.isDead) {
                if (other.position.y === unit.position.y) {
                    other.currentHp -= 150 * unit.stars;
                    if (other.currentHp <= 0) other.isDead = true;
                }
            }
        });
    },
    'Void Terror': ({ unit, units }) => {
        const target = findNearestEnemy(unit, units);
        if (target) {
            target.currentHp -= 250 * unit.stars;
            if (target.currentHp <= 0) target.isDead = true;
        }
    },
    'Flux Mage': ({ unit, units }) => {
        const target = findNearestEnemy(unit, units);
        if (target) {
            target.isStunned = true;
            target.stunDuration = 4;
        }
    },
    'Warlord': ({ unit, units }) => {
        units.forEach(other => {
            if (other.team !== unit.team && !other.isDead) {
                const dist = Math.abs(other.position.x - unit.position.x) + Math.abs(other.position.y - unit.position.y);
                if (dist <= 1) {
                    other.currentHp -= 150 * unit.stars;
                    if (other.currentHp <= 0) other.isDead = true;
                }
            }
        });
    },
    'Nanomancer': ({ unit, units }) => {
        const target = findNearestEnemy(unit, units);
        if (target) {
            const drain = 200 * unit.stars;
            target.currentHp -= drain;
            unit.currentHp = Math.min(unit.maxHp, unit.currentHp + drain);
            if (target.currentHp <= 0) target.isDead = true;
        }
    },
    'Skyguardian': ({ unit }) => {
        unit.currentShield = (unit.currentShield || 0) + 9999;
    },

    // ========== TIER 4 ==========
    'Titan': ({ unit, units }) => {
        units.forEach(other => {
            if (other.team !== unit.team && !other.isDead) {
                const dist = Math.abs(other.position.x - unit.position.x) + Math.abs(other.position.y - unit.position.y);
                if (dist <= 2) {
                    other.currentHp -= 200 * unit.stars;
                    if (other.currentHp <= 0) other.isDead = true;
                }
            }
        });
    },
    'Arcane Dragon': ({ unit, units }) => {
        units.forEach(other => {
            if (other.team !== unit.team && !other.isDead) {
                other.currentHp -= 300 * unit.stars;
                if (other.currentHp <= 0) other.isDead = true;
            }
        });
    },
    'Phantom': ({ unit, units }) => {
        const target = findNearestEnemy(unit, units);
        if (target && target.currentHp < target.maxHp * 0.3) {
            target.currentHp = 0;
            target.isDead = true;
        } else if (target) {
            target.currentHp -= 150 * unit.stars;
            if (target.currentHp <= 0) target.isDead = true;
        }
    },
    'Stormcaller': ({ unit, units }) => {
        units.forEach(other => {
            if (other.team !== unit.team && !other.isDead) {
                other.isStunned = true;
                other.stunDuration = 3;
            }
        });
    },
    'Mech-Pilot': ({ unit }) => {
        unit.maxHp += 500 * unit.stars;
        unit.currentHp += 500 * unit.stars;
        unit.ad = (unit.ad || 110) + 50 * unit.stars;
    },
    'Highblade': ({ unit, units }) => {
        units.forEach(other => {
            if (other.team !== unit.team && !other.isDead) {
                if (other.position.y === unit.position.y) {
                    other.currentHp -= 250 * unit.stars;
                    if (other.currentHp <= 0) other.isDead = true;
                }
            }
        });
    },

    // ========== TIER 5 (Legendary) ==========
    'The Core': ({ unit, units }) => {
        units.forEach(other => {
            if (other.team !== unit.team && !other.isDead) {
                other.currentHp -= 400 * unit.stars;
                if (other.currentHp <= 0) other.isDead = true;
            }
        });
    },
    'Void Mother': ({ unit }) => {
        unit.currentHp = Math.min(unit.maxHp, unit.currentHp + 300 * unit.stars);
    },
    'Time Keeper': ({ unit, units }) => {
        units.forEach(other => {
            if (other.team !== unit.team && !other.isDead) {
                other.isStunned = true;
                other.stunDuration = 6;
            }
        });
    },
    'Starforger': ({ unit, units }) => {
        units.forEach(other => {
            if (other.team === unit.team && !other.isDead) {
                other.currentShield = (other.currentShield || 0) + 500 * unit.stars;
            }
        });
    },
    'Deathwhisper': ({ unit, units }) => {
        const target = findNearestEnemy(unit, units);
        if (target && target.maxHp < 2000) {
            target.currentHp = 0;
            target.isDead = true;
        }
    },
    'Omega': ({ unit, units }) => {
        units.forEach(other => {
            if (other.team !== unit.team && !other.isDead) {
                const dist = Math.abs(other.position.x - unit.position.x) + Math.abs(other.position.y - unit.position.y);
                if (dist <= 2) {
                    other.currentHp -= 600 * unit.stars;
                    if (other.currentHp <= 0) other.isDead = true;
                }
            }
        });
    },

    // MONSTERS
    'Krug': ({ unit }) => {
        unit.currentShield = (unit.currentShield || 0) + 300;
    },
    'Murk Wolf': ({ unit, units }) => {
        const target = findNearestEnemy(unit, units);
        if (target) {
            target.currentHp -= 80;
            if (target.currentHp <= 0) target.isDead = true;
        }
    }
};

// Helper
function findNearestEnemy(unit: CardInstance, allUnits: CardInstance[]): CardInstance | null {
    let nearest: CardInstance | null = null;
    let minDist = Infinity;
    allUnits.forEach(other => {
        if (other.team !== unit.team && !other.isDead) {
            const dist = Math.abs(other.position.x - unit.position.x) + Math.abs(other.position.y - unit.position.y);
            if (dist < minDist) {
                minDist = dist;
                nearest = other;
            }
        }
    });
    return nearest;
}
