import { Augment } from './types';

export const AUGMENTS: Augment[] = [
    // COMBAT AUGMENTS
    {
        id: 'brute-force',
        name: 'Força Bruta',
        description: 'Suas unidades ganham +20 de Dano de Ataque (AD) permanentemente.',
        type: 'COMBAT',
        tier: 1
    },
    {
        id: 'resilience',
        name: 'Resiliência Ancestral',
        description: 'Suas unidades ganham +250 de Vida Máxima permanentemente.',
        type: 'COMBAT',
        tier: 1
    },
    {
        id: 'arcane-mastery',
        name: 'Maestria Arcana',
        description: 'Suas unidades começam o combate com 30 de Mana adicional.',
        type: 'COMBAT',
        tier: 2
    },
    {
        id: 'vampiric-touch',
        name: 'Toque Vampírico',
        description: 'Suas unidades curam 15% do dano causado por ataques básicos.',
        type: 'COMBAT',
        tier: 2
    },

    // ECON AUGMENTS
    {
        id: 'rich-get-richer',
        name: 'Rico Fica Mais Rico',
        description: 'Seu limite de juros aumenta para 7 (máximo de 70 ouro). Ganhe 10 de ouro agora.',
        type: 'ECON',
        tier: 2
    },
    {
        id: 'gold-rush',
        name: 'Corrida do Ouro',
        description: 'Ganhe 20 de ouro instantaneamente.',
        type: 'ECON',
        tier: 1
    },
    {
        id: 'wise-spending',
        name: 'Gasto Inteligente',
        description: 'Sempre que você atualizar a loja, ganhe 1 de XP.',
        type: 'ECON',
        tier: 2
    },
    {
        id: 'clear-mind',
        name: 'Mente Clara',
        description: 'Se seu banco estiver vazio no final do turno, ganhe 3 de XP.',
        type: 'ECON',
        tier: 2
    },

    // UTILITY AUGMENTS
    {
        id: 'fast-study',
        name: 'Estudo Acelerado',
        description: 'Ganhe 15 de XP instantaneamente.',
        type: 'UTILITY',
        tier: 1
    },
    {
        id: 'item-grab-bag',
        name: 'Sacola de Itens',
        description: 'Receba uma unidade Tier 4 aleatória agora.',
        type: 'UTILITY',
        tier: 2
    },
    {
        id: 'tactical-reposition',
        name: 'Reposicionamento Tático',
        description: 'Suas unidades no tabuleiro ganham 20% de Velocidade de Ataque.',
        type: 'UTILITY',
        tier: 1
    },
    {
        id: 'nexus-blessing',
        name: 'Bênção do Nexus',
        description: 'Cura 20 de vida do seu Comandante.',
        type: 'UTILITY',
        tier: 1
    }
];
