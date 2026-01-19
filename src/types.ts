export type Tier = 1 | 2 | 3 | 4 | 5;
export type GamePhase = 'PLANNING' | 'COMBAT';
export type Team = 'PLAYER' | 'ENEMY';

export interface User {
    id: string;
    username: string;
    email: string;
    elo: number;
    wins: number;
    losses: number;
}

export interface CardTemplate {
    id: string;
    name: string;
    tier: Tier;
    hp: number;
    ad: number;
    ap: number;
    manaMax: number;
    as: number; // Attack Speed
    range: number;
    traits: string[];
    abilityName: string;
    abilityDescription: string;
    lore?: string; // Narrative description [NEW]
}

export interface CardInstance {
    id: string;
    templateId: string;
    stars: 1 | 2 | 3;
    currentHp: number;
    maxHp: number;
    currentMana: number;
    currentShield?: number;
    isStunned?: boolean;
    stunDuration?: number;
    team: Team;
    position: { x: number; y: number };
    startPosition?: { x: number; y: number };
    benchIndex?: number;
    isDead?: boolean;
    ad?: number; // Attack Damage (for synergy bonuses)
    as?: number; // Attack Speed (for synergy bonuses)
    lastAttackTime?: number; // [NEW]
}

export interface FloatingText {
    id: string;
    value: string;
    type: 'damage' | 'heal' | 'mana' | 'gold';
    x: number;
    y: number;
    life: number;
}

export interface Projectile {
    id: string;
    sourcePos: { x: number, y: number };
    targetPos: { x: number, y: number };
    startTime: number;
    duration: number;
}

export interface GameState {
    gold: number;
    level: number;
    xp: number;
    shop: (CardTemplate | null)[];
    bench: (CardInstance | null)[];
    board: (CardInstance | null)[][];
    health: number;
    round: number;
    phase: GamePhase;
    timer: number;
    graveyard: CardInstance[];
    floatingTexts: FloatingText[]; // [NEW]
    projectiles: Projectile[]; // [NEW]
}
