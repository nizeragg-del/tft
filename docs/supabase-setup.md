# Guia de Configuração do Supabase

Este documento contém as instruções para configurar o Supabase após conectar o MCP.

## 📋 Pré-requisitos

- Conta no Supabase (https://supabase.com)
- MCP do Supabase conectado

## 🚀 Passo a Passo

### 1. Criar Projeto no Supabase

Via MCP ou Dashboard:
- Nome do projeto: `cardtactics-nexus`
- Região: Escolha a mais próxima (ex: `sa-east-1` para Brasil)
- Database Password: Anote em local seguro

### 2. Executar Schema SQL

**Via MCP (Recomendado):**
```
Use o MCP tool: apply_migration
- name: "initial_schema"
- query: <conteúdo do arquivo supabase-schema.sql>
```

**Via Dashboard:**
1. Vá em "SQL Editor"
2. Cole o conteúdo de `supabase-schema.sql`
3. Clique em "Run"

### 3. Configurar Authentication

**Via MCP ou Dashboard:**
1. Vá em "Authentication" > "Providers"
2. Habilite "Email" provider
3. **Desabilite** "Confirm Email" (para MVP - facilita testes)
4. Salve as configurações

### 4. Habilitar Realtime

**Via Dashboard:**
1. Vá em "Database" > "Replication"
2. Habilite Realtime para a tabela `matches`
3. Clique em "Save"

### 5. Obter Credenciais

**Via MCP:**
```
Use: get_project_url e get_publishable_keys
```

**Via Dashboard:**
1. Vá em "Settings" > "API"
2. Copie:
   - `Project URL` → `VITE_SUPABASE_URL`
   - `anon public` key → `VITE_SUPABASE_ANON_KEY`

### 6. Configurar Variáveis de Ambiente

Crie o arquivo `.env` na raiz do projeto:

```env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua_chave_anon_aqui
```

**⚠️ IMPORTANTE:** Adicione `.env` ao `.gitignore` para não commitar credenciais!

### 7. Verificar Instalação

Execute no terminal:
```bash
npm run dev
```

Abra o console do navegador. Você NÃO deve ver:
```
Supabase credentials not found. Multiplayer features will be disabled.
```

## ✅ Checklist de Verificação

- [ ] Projeto criado no Supabase
- [ ] Schema SQL executado com sucesso
- [ ] Tabelas criadas: `users`, `matches`, `match_states`
- [ ] RLS habilitado e políticas criadas
- [ ] Authentication configurado (Email provider)
- [ ] Realtime habilitado para `matches`
- [ ] Credenciais copiadas e salvas em `.env`
- [ ] Aplicação rodando sem warnings de Supabase

## 🧪 Testar Conexão

Adicione este código temporário em `App.tsx` (depois remover):

```tsx
import { supabase } from './supabase';

// No useEffect
useEffect(() => {
    const testConnection = async () => {
        const { data, error } = await supabase.from('users').select('count');
        if (error) {
            console.error('Supabase connection error:', error);
        } else {
            console.log('✅ Supabase connected successfully!', data);
        }
    };
    testConnection();
}, []);
```

## 📚 Próximos Passos

Após configuração completa:
1. Implementar UI de Login/Signup
2. Implementar Matchmaking
3. Sincronizar ações de jogo
4. Testar combate multiplayer

## 🆘 Troubleshooting

**Erro: "Invalid API key"**
- Verifique se copiou a chave `anon public` (não a `service_role`)
- Confirme que o `.env` está na raiz do projeto

**Erro: "relation does not exist"**
- Execute novamente o `supabase-schema.sql`
- Verifique se está no schema `public`

**Erro: "new row violates row-level security policy"**
- Confirme que as políticas RLS foram criadas
- Verifique se o usuário está autenticado

## 📞 Suporte

Se encontrar problemas, me avise que ajusto a configuração! 🚀
