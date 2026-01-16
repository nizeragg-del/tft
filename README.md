# TFT Card Game - CardTactics: Nexus

Este projeto é um jogo de cartas (TFT/Card Game) desenvolvido com React, Vite e Supabase.

## 🛠️ Tecnologias
- **React + TypeScript**
- **Vite**
- **Supabase** (Banco de Dados, Autenticação e Realtime)
- **CSS Vanilla** (Estilização)

## 🔐 Configuração de Variáveis de Ambiente

Para rodar este projeto localmente ou em produção, você precisará configurar as seguintes variáveis no arquivo `.env`:

```bash
VITE_SUPABASE_URL=https://sua-url-do-supabase.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-anonima-aqui
```

### Como obter estas chaves:
1. Vá para o [Supabase Dashboard](https://app.supabase.com).
2. Selecione o seu projeto (**TFT Card Game**).
3. Vá em **Project Settings** -> **API**.
4. Copie a `Project URL` e a `anon public` key.

## 🚀 Como Rodar Localmente

1. Clone o repositório:
   ```bash
   git clone https://github.com/nizeragg-del/tft.git
   ```
2. Instale as dependências:
   ```bash
   npm install
   ```
3. Configure o arquivo `.env` (use o `.env.example` como base).
4. Inicie o servidor de desenvolvimento:
   ```bash
   npm run dev
   ```

## 📂 Estrutura do Banco de Dados
O schema completo do banco de dados está disponível em `supabase-schema.sql`. Ele inclui:
- Gerenciamento de usuários e perfis.
- Rastreamento de partidas e resultados.
- Sistema de ELO automático.
- Sincronização em tempo real.
