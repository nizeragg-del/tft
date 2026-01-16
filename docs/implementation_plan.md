# CardTactics: Nexus - Plano de Implementação & Especificação Técnica

Este documento serve como o "prompt completo" e guia técnico para construir um jogo premium estilo TFT com interface baseada em cartas.

## 🕹️ Mecânicas Centrais do Jogo

### 1. Economia & Progressão
- **Ouro**: Ganho por rodada.
  - Base: 5 de ouro.
  - Juros: +1 de ouro para cada 10 acumulados (máximo +5).
  - Sequência (Streak): Bônus por vitórias ou derrotas consecutivas.
- **Nível (Leveling)**: Pague 4 de ouro por 4 de XP.
  - O nível determina quantas cartas podem estar no tabuleiro.
  - O nível afeta a probabilidade de aparecerem cartas de tiers altos.
- **Rerolling**: Pague 2 de ouro para atualizar a loja.

### 2. As Cartas (Unidades)
- **Tiers**: 1 a 5 (custos e probabilidades diferentes).
- **Atributos**: Vida (HP), Dano de Ataque (AD), Poder de Habilidade (AP), Mana (Barra azul), Velocidade de Ataque.
- **Estrelas (Upgrades)**:
  - 3x 1-estrela = 2-estrelas (Atributos melhorados).
  - 3x 2-estrelas = 3-estrelas (Atributos máximos, brilho visual).
- **Sinergias (Traits)**: Cartas pertencem a Origens (ex: Cibernético, Vazio) e Classes (ex: Assassino, Protetor). Ativar limites (2/4/6) concede buffs para todo o time.

### 3. Sistema de Combate
- **Auto-Battle**: As cartas se movem e atacam automaticamente.
- **Sistema de Mana**: Mana ganha por acerto. Em 100%, ativa a habilidade única da carta.
- **Posicionamento em Grid**: Grid hexagonal ou quadrado (ex: 7x4). Posicionamento estratégico de tanques na frente e carregadores (carries) atrás.

---

## 🎨 Identidade Visual (Design Premium)
- **Tema**: Modo Escuro / Cyber-Arcano.
- **Cores**:
  - Fundos em Marinho profundo/Preto.
  - Acentos em Neon (Roxo para Épico, Dourado para Lendário).
  - Glassmorphism para a Loja e barras laterais.
- **Animações**:
  - Vibração suave da carta ao passar o mouse.
  - Partículas quando as cartas se fundem.
  - Números de dano flutuantes durante o combate.
- **Tipografia**: "Inter" ou "Outfit" para um visual moderno e limpo.

---

## 🛠️ Stack Tecnológica
- **Frontend**: Vite + React (TypeScript).
- **Lógica do Jogo**: Máquina de estado customizada (React Context ou Zustand) para lógica sincronizada de combate e loja.
- **Animações**: `framer-motion` para transições de UI complexas e movimentos de combate.
- **Estilização**: CSS Vanilla com variáveis modernas (HSL).
- **Backend (Opcional/Escalável)**: Supabase para rankings de jogadores, inventário persistente e perfis de usuário.

---

## 🚀 Prompt Final de Execução ("A Mágica")
> "Construa um Web App premium usando as especificações acima. Comece criando o sistema de design no `index.css` com foco em estética dark-mode. Implemente os sistemas de 'Loja' e 'Banco' primeiro, incluindo a lógica de fusão de 3 estrelas. Depois, desenvolva o grid de combate e uma IA básica para combate automático por turnos. Use Vite e React para a implementação."

## Plano de Verificação
### Testes Automatizados
- `npm run test` (se frameworks de teste forem configurados).
- Verificações de regressão visual via subagente de navegação.
### Verificação Manual
- Testar a lógica de fusão de 3 cartas.
- Verificar cálculos de juros de ouro após várias rodadas.
- Validar layout responsivo em diferentes tamanhos de tela.
- Testar movimento e venda de cartas e verificar retorno de unidades mortas.

## 🆕 Refinamentos de Gameplay
### UI de XP
- Círculo de progresso em SVG ao redor do indicador de nível.
- `stroke-dasharray` dinâmico baseado em `currentXP / maxXP`.

### Gestão de Unidades
- **Re-posicionamento**: Permitir arrastar/clicar para mover unidades já posicionadas no tabuleiro (Board -> Board).
- **Movimentação no Banco**: Permitir trocar unidades de lugar no banco (Bench -> Bench).
- **Retorno ao Banco**: Permitir mover do Tabuleiro para o Banco (Board -> Bench).
- **Venda**: Adicionar botão/atalho para vender unidades por 50% do valor.
- **Ressurreição**: Garantir que `endCombat` restaure unidades mortas usando `isDead: false` e `startPosition`.

### Redesign de Interface (Layout)
- **Grid Central**: O Tabuleiro (Board) ocupa o centro da tela.
- **Painel Inferior**:
    - **Esquerda**: Lista de Sinergias (com tooltips).
    - **Centro**: Banco de unidades + Botão "Loja no Nexus" (Abre Modal).
    - **Direita**: Botões de ação (XP, Atualizar).
- **Loja Modal**: Overlay sobre a tela ou popup animado contendo as cartas à venda.

### 2. Sinergias Ativas (Lógica Real)
- **Cálculo no Início do Combate**:
  - Contar traits únicos ativos no board.
  - Aplicar buffs diretos nas unidades (`unit.ad += 10`, `unit.maxHp += 200`, etc).
- **Efeitos Planejados**:
  - **Vanguard (Protector)**: Todos Protectors ganham escudo no início.
  - **Assassin**: Ganham Crítico/Dano.
  - **Mage**: Iniciam com mais Mana.
  - **Brawler**: Ganham Vida Máxima.

### 3. Feedback Visual (Juiciness)
- **Floating Text**: Criar componente simples que renderiza `+20 text` sobre a unidade.
- **Skill Activation**: Piscar unidade ou texto "ULT!".

## 🌐 Arquitetura Multiplayer (PvP em Tempo Real)

### 1. Backend: Supabase
**Por que Supabase?**
- Realtime Channels (WebSocket) para sincronização de estado.
- PostgreSQL para persistência (contas, histórico, rankings).
- Auth integrado.
- Row Level Security (RLS) para segurança.
- Gratuito até 500MB de DB + 2GB de largura de banda.

### 2. Schema do Banco de Dados

#### Tabela: `users`
- `id` (UUID, PK)
- `username` (TEXT, UNIQUE)
- `email` (TEXT)
- `elo` (INT, default 1000)
- `wins` (INT, default 0)
- `losses` (INT, default 0)
- `created_at` (TIMESTAMP)

#### Tabela: `matches`
- `id` (UUID, PK)
- `player1_id` (UUID, FK -> users)
- `player2_id` (UUID, FK -> users)
- `winner_id` (UUID, FK -> users, nullable)
- `status` (TEXT: 'waiting', 'in_progress', 'completed')
- `created_at` (TIMESTAMP)
- `ended_at` (TIMESTAMP, nullable)

#### Tabela: `match_states` (Opcional - para replay)
- `id` (UUID, PK)
- `match_id` (UUID, FK -> matches)
- `round` (INT)
- `player1_board` (JSONB)
- `player2_board` (JSONB)
- `timestamp` (TIMESTAMP)

### 3. Sincronização em Tempo Real

**Supabase Realtime Channels:**
- **Lobby Channel**: `lobby:public`
  - Broadcast: Jogadores procurando partida.
  - Presence: Quem está online.
- **Match Channel**: `match:{match_id}`
  - Broadcast: Ações de jogo (comprar, posicionar, vender).
  - Presence: Conexão dos 2 jogadores.

**Fluxo de Sincronização:**
1. **Fase de Planejamento**: Cada jogador gerencia seu próprio estado localmente.
2. **Início do Combate**: Ambos enviam `board_ready` via Realtime.
3. **Simulação de Combate**: Ambos rodam a mesma lógica determinística.
4. **Fim do Combate**: Sincronizam HP/resultado.

### 4. Matchmaking

**Simples (MVP):**
1. Jogador clica em "Find Match".
2. Insere registro em `matches` com `status='waiting'`.
3. Escuta Realtime para outro jogador.
4. Quando 2 jogadores estão waiting, atualiza `match` para `in_progress`.

**Avançado (Futuro):**
- Matchmaking por ELO (±100 pontos).
- Fila com timeout (30s).
- Lógica de reconexão.

### 5. Gerenciamento de Estado do Jogo

**Arquitetura:**
```
Estado Local (React)  <-->  Supabase Realtime  <-->  Estado Remoto (Oponente)
       |
       v
  Simulação Local (Determinística)
```

**Sincronização de Ações:**
- `BUY_UNIT`: `{ type: 'buy', shopIndex: 2, benchIndex: 5 }`
- `PLACE_UNIT`: `{ type: 'place', benchIndex: 5, x: 3, y: 2 }`
- `SELL_UNIT`: `{ type: 'sell', boardX: 3, boardY: 2 }`
- `REROLL_SHOP`: `{ type: 'reroll' }`
- `BUY_XP`: `{ type: 'buy_xp' }`

**Combate Determinístico:**
- Ambos jogadores rodam a mesma seed de RNG.
- Seed = `match_id + round_number`.
- Garante que o combate seja idêntico em ambos os lados.

### 6. Segurança & Anti-Cheat

**Row Level Security (RLS):**
```sql
-- Apenas jogadores da partida podem ler/escrever
CREATE POLICY "Players can access their matches"
ON matches FOR ALL
USING (auth.uid() = player1_id OR auth.uid() = player2_id);
```

**Validação no Servidor (Edge Functions):**
- Validar ações (ouro suficiente, limite de unidades, etc).
- Prevenir trapaças (modificar ouro, HP, etc).
- Para MVP: Confiança no cliente (validar depois).

### 7. Passos de Implementação

1. **Configurar Projeto Supabase**
2. **Instalar Dependências**
3. **Criar Cliente Supabase**
4. **Implementar Autenticação**
5. **Implementar Matchmaking**
6. **Sincronizar Ações de Jogo**
7. **Sincronização de Combate**
8. **Fim de Jogo**

### 8. Resumo da Stack Tecnológica

- **Frontend**: React + TypeScript.
- **Backend**: Supabase (Realtime + PostgreSQL + Auth).
- **Sincronização**: Supabase Realtime Channels.
- **Combate Determinístico**: Seeded RNG (seedrandom.js).
- **Deployment**: Vercel/Netlify (frontend) + Supabase (backend).

## 📦 Expansão de Conteúdo (Set 1: Cyber-Arcane)

### 1. Refatoração do Sistema de Habilidades
- **Solução**: Mapa de funções `ABILITY_MAP`.
- Cada habilidade: `(unit, context) => void`.

### 2. Novas Sinergias (Traits)
- **Cybernetic (3/6)**: Ganham AD e Vida.
- **Celestial (2/4)**: Cura de equipe.
- **Void (2/4)**: Dano Verdadeiro.
- **Chrono (2/4/6)**: Velocidade de ataque acumulativa.
- **Blademaster (2/4)**: Ataque duplo.

### 3. Roster Planejado (30 Unidades)
Divididas em Tiers 1 a 5, cada uma com habilidades únicas e sinergias específicas.
