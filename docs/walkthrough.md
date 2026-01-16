# CardTactics: Nexus - Walkthrough

O jogo foi implementado com sucesso seguindo a estética premium e as mecânicas de TFT (Teamfight Tactics) adaptadas para cartas.

## ✨ Funcionalidades Implementadas

### 1. Sistema de Gestão (Fase de Planejamento)
- **Loja de Unidades**: 5 slots com tiers diferentes (Cores: Cinza, Verde, Azul, Roxo, Dourado).
- **XP e Nível**: Jogador pode comprar XP para aumentar o nível e colocar mais unidades no tabuleiro.
- **Rerolagem**: Atualiza a loja por 2 de ouro.
- **Banco (Bench)**: 9 slots para guardar unidades antes de posicionar.
- **Merge 3-Estrelas**: Fusão automática ao conseguir 3 unidades iguais de mesmo nível de estrelas.

### 2. Sistema de Combate (Fase de Auto-Battle)
- **Timer de Fases**: Transição automática entre planejamento (30s) e combate (45s).
- **IA de Batalha**: Unidades se movem em direção ao inimigo mais próximo e atacam.
- **Barras de Status**: Vida (Verde/Vermelho) e Mana (Azul) visíveis em cada unidade.
- **Economia Dinâmica**: Ganho de ouro base + juros (1 bônus para cada 10 de ouro) a cada round.

### 3. Sistema Multiplayer (PvP)
- **Autenticação Segura**: Login e registro com Supabase Auth e perfis persistentes.
- **Matchmaking em Tempo Real**: Fila de espera para encontrar oponentes e criação automática de instâncias de partida.
- **Sincronização de Tabuleiro**: Ações como compra, venda e movimentação são espelhadas para o oponente instantaneamente.
- **Combate Determinístico**: Uso de RNG com seed (`match_id + round`) garante que a simulação de batalha seja idêntica para ambos os clientes.
- **Sistema de ELO Automatizado**: Cálculos de ranking processados no backend via triggers e funções PostgreSQL.

### 4. Design Premium
- **Estética Dark**: Fundo preto profundo com acentos em Neon Purple e Gold.
- **Interface Responsiva**: Layout otimizado com sidebar de loja e grid central de combate.
- **Efeito Glassmorphism**: Cartas e loja com transparências e glows suaves.

## 🛠️ Como Executar

> [!IMPORTANT]
> **Correções Aplicadas:**
> 1. Para contornar bloqueios de script no Windows, use `npm.cmd`.
> 2. O projeto usa Tailwind CSS 3 configurado para CommonJS para compatibilidade total.

### Passo a Passo

1. **Instale as dependências (Forçar modo CMD):**
   ```powershell
   npm.cmd install
   ```

2. **Inicie o servidor de desenvolvimento:**
   ```powershell
   npm.cmd run dev
   ```

3. **Configuração do Supabase:**
   - Siga as instruções em [supabase-setup.md](file:///C:/Users/ctb075/.gemini/antigravity/brain/42eead37-42f4-464d-a0f9-d8e010a488b4/supabase-setup.md) para configurar o banco de dados.
   - Adicione suas credenciais no arquivo `.env` (use `.env.example` como base).

4. **Acesse no navegador:**
   O jogo deve abrir na tela de login. Após entrar, você poderá buscar uma partida.

## Atualização de PvE & Economia
- **Sistema de Ondas**: Implementação das rodadas PvE clássicas do TFT.
    - Rodada 1-3: Minions.
    - Rodada 10: Krugs (Chefão).
    - Rodada 15: Lobos (Assassinos).
- **Regras de Economia**:
    - **XP Passivo**: +2 XP automaticamente a cada rodada.
    - **Juros**: +1 de Ouro para cada 10 de Ouro poupados (máximo +5).
- **Reformulação da Interface**:
    - **Cartas Premium**: Unidades da loja e do banco agora possuem glassmorphism, gradientes baseados no tier e efeitos de brilho.
    - **Polimento Visual**: Tipografia e layout melhorados para uma sensação de alta qualidade.

## 🐛 Correções Recentes & Polimento
- **Sistema de Reanimação de Unidades (Cemitério)**: Corrigido um bug onde as unidades morriam e desapareciam se fossem pisadas. Agora, um `graveyard` rastreia as unidades mortas e as reanima corretamente em suas posições iniciais após o combate.
- **Tabuleiro Temático**: Aplicado um tema "Musgo Escuro" com texturas de grama e detalhes em esmeralda.
- **UI Compacta**: As barras de Vida e Mana agora são permanentes, compactas e posicionadas abaixo das unidades para melhor visibilidade.

## Resolução de Problemas (Troubleshooting)
- **Servidor Local**: Rodando em `http://localhost:5176/`.
- **Hot Reload**: Configuração robusta; edições no `App.tsx` refletem imediatamente.

## 🕹️ Gameplay Sugerida
- Compre unidades na loja para completar trios e evoluir para 2 estrelas rapidamente.
- Posicione seus tanques (como o 'Vanguard') na linha de frente e unidades de dano ('Sniper') atrás.
- Economize ouro para ganhar juros e subir de nível para dominar o tabuleiro com mais unidades!
