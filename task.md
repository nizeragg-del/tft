# Tarefa: Planejamento do Jogo de Cartas TFT

- [x] Definir Mecânicas Principais do Jogo (Estilo de Cartas TFT)
- [x] Esboçar Estratégia de UI/UX e Assets
- [x] Definir Stack Técnica
- [x] Criar "Prompt de Estrutura do Jogo" finalizado para o Usuário

# Fase de Implementação
- [x] Inicializar Projeto e Sistema de Design
- [x] Implementar Lógica de Loja e Banco (com fusão de 3 estrelas)
- [x] Criar Grid de Combate e Posicionamento
- [x] Desenvolver IA de Auto-Battle e Sistema de Mana
- [x] Polimento Final e Micro-animações de UI
- [x] Depuração e Correções de Tipos
- [x] Depuração e Correções de Tipos

# Fase de Mecânicas Avançadas
- [x] Implementar Sistema de Habilidades (Gatilho de Mana e Efeitos)
- [x] Melhorar IA (Consciência de Alcance e Seleção de Alvos)
- [x] Implementar Sistema de Sinergia/Trait (Bônus Ativos)
- [x] Implementar Sistema de Sinergia/Trait (Bônus Ativos)
- [x] Criar Rodadas PvE (Minions, Krugs, Lobos)
    - [x] Definir Modelos de Monstros em data.ts
    - [x] Criar Configuração de Ondas (Rodada -> Monstros)
    - [x] Implementar Lógica de Spawn em startCombat
- [x] Implementar Regras de Economia TFT
    - [x] XP Passivo (+2 por rodada)
    - [x] Lógica de Juros (1g por cada 10g armazenados)
    - [x] Drops de Saque PvE (Ouro/XP)
- [x] Implementar Recurso de Venda de Unidade
- [x] Implementar Reposicionamento do Tabuleiro (Mover unidades no tabuleiro)

# Fase de Polimento UI/UX
- [x] Design de Cartas Premium (Glassmorphism, Cores de Tier, Brilhos)
- [x] Feedback Visual para Dano/Cura
- [x] Implementar Limite de Unidades (Unidades <= Nível) e Contador de UI
- [x] Interface de Círculo de Progresso de XP
- [x] Redesenho da UI (Layout Inferior)
    - [x] Estrutura: Sinergias (Esquerda) | Banco (Centro) | Ações (Direita)
    - [x] Loja como Popup/Modal (Botão Verde dentro do Banco)
    - [x] Tooltip/Popup de Sinergias

# Polimento de UI
- [x] Barras de Vida/Mana Permanentes (Compactas)
- [x] Tabuleiro Temático (Musgo Escuro/Grama)

# Correções de Bugs
- [x] Corrigir Reanimação de Unidades (Sistema de Cemitério)

# Melhorias no Banco e UI
- [x] Aumentar Tamanho do Banco (UI)
- [x] Implementar Movimentação Banco-para-Banco
- [x] Implementar Movimentação Tabuleiro-para-Banco (Troca/Retorno)

# Sinergia e Visuais (Ativo)
- [ ] Implementar `calculateSynergyBonuses` em startCombat
- [ ] Aplicar Bônus de Sinergia Ativa (Stats)
- [x] **IA de Combate: Refatoração de Pathfinding e Inteligência de Ataque**
- [x] **Correção: Unidades mortas agindo e travando combate**
- [x] **Feedback Visual: Números de Dano Flutuantes (Floating Text)**
- [x] **Projetéis: Sistema de Tiro para Unidades Ranged**
- [ ] Polimento Visual para Ativação de Habilidades

# Expansão de Conteúdo (Set 1)
- [x] Projetar e Implementar 30 Unidades (6 per Tier)
- [x] Implementar Sistema para Habilidades Escaláveis (Refatoração)
- [x] Definir e Implementar Novas Sinergias (Traits)
- [/] Passagem de Equilíbrio (Stats e Custos)

# Multiplayer (PvP)
- [x] Configurar Projeto Supabase e Schema do Banco de Dados
- [x] Instalar Cliente Supabase e Configurar Auth
- [/] Implementar Sistema de Matchmaking
- [x] Implementar Sincronização de Estado do Jogo
- [x] Implementar Combate Determinístico (RNG com Seed)
- [x] Implementar Sistema de Fim de Jogo e ELO
- [x] Segurança e Anti-Cheat (Políticas RLS)
