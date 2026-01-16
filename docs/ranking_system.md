# Sistema de Ranking (ELO) - Nexus TFT

O sistema de ranking do Nexus TFT utiliza o algoritmo **ELO**, amplamente usado em jogos competitivos como Xadrez e League of Legends, para garantir partidas equilibradas e uma progressão justa.

## Como funciona?

Cada jogador começa com **1000 pontos de ELO**. Ao final de cada partida, os pontos são recalculados com base no resultado e na diferença de nível entre você e seu oponente.

### Ganhando e Perdendo Pontos
- **Vitória contra oponente superior**: Você ganha muitos pontos (ex: +25 a +32).
- **Vitória contra oponente inferior**: Você ganha menos pontos (ex: +10 a +15).
- **Derrota**: Você perde pontos proporcionalmente à força do oponente.

### Fator K
O jogo utiliza um **Fator K de 32**, que determina a volatilidade máxima de uma partida. Isso significa que você nunca perderá ou ganhará mais de 32 pontos em um único duelo.

## Automação e Segurança
O cálculo é feito inteiramente no **Backend (PostgreSQL)** através de Triggers e Functions. Isso garante que:
1. O ELO não pode ser manipulado pelo cliente.
2. A atualização é instantânea assim que o HP de um jogador chega a zero ou há uma desistência.
3. O histórico de partidas é mantido de forma íntegra.

## Subindo de Rank
Para se tornar um **Nexus Commander**, você precisará demonstrar consistência:
- Estudar sinergias.
- Gerenciar sua economia (Juros).
- Adaptar seu posicionamento a cada round.

---
*Que a sorte esteja com você na Arena Nexus!*
