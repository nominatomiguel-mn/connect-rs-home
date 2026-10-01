# RS CONECT — Módulo Chamados (Colégio Raios de Sol)

## Situação atual
O projeto está zerado (template vazio). O módulo Chamados depende de uma base mínima que ainda não existe: banco de dados, login com lista de autorizados, papéis e setores. O plano cobre essa base (enxuta) + o módulo Chamados completo. Telas de Admin e login serão criadas do zero nesta etapa (nada existe para alterar) e ficam como fundação para os módulos 2 e 3.

## Fundação (mínima para o módulo funcionar)
1. **Lovable Cloud** — banco, login, storage e envio de e-mails.
2. **Banco de dados** (todas com RLS):
   - `authorized_emails` — lista de pessoas autorizadas: e-mail, nome, papel, ativo.
   - `profiles` — nome e dados básicos do usuário.
   - `user_roles` — papéis em tabela separada (admin, direcao, responsavel, colaborador).
   - `sectors` — setores de chamados; os 12 setores já entram criados (Limpeza, Manutenção, Papelaria, Materiais diversos para aulas, Xerox, Sala Interativa, Sala de leitura, Teatro, Parque, Quadra, Laboratório de ciências, Cozinha da nutrição).
   - `sector_responsibles` — qual usuário responde por qual setor (uma pessoa pode ter vários setores).
3. **Cadastro controlado**: ao tentar criar conta, um gatilho no banco verifica o e-mail em `authorized_emails`; e-mail fora da lista não consegue se cadastrar. Ao entrar, perfil e papel são criados a partir da lista.
4. **Telas básicas**: login/cadastro (`/auth`) em português; navegação inferior no celular, lateral no desktop. Painel do admin (mínimo): cadastrar pessoas autorizadas (nome, e-mail, papel) e atribuir responsáveis por setor.

## Módulo Chamados
### Colaborador
- Botão "Novo chamado": setor (lista dos ativos), título curto, descrição, local (texto livre, ex. "Sala 5"), prioridade (normal/urgente) e até 3 fotos (câmera ou galeria do celular).
- Lista "Meus chamados" com status; só vê os próprios.

### Responsável de setor
- Fila apenas com chamados dos setores atribuídos a ele; filtros por status e urgência; urgentes no topo.
- Altera status: aberto → em andamento → resolvido. Ao resolver: comentário e foto da solução (opcional).

### Admin
- Vê todos os chamados, com os mesmos filtros.

### Comentários e histórico
- Cada chamado tem comentários e um histórico automático (quem, quando, o quê — ex. mudança de status). Nada é apagado; só arquivado.

### Notificações por e-mail
- Novo chamado → e-mail ao responsável do setor.
- Mudança de status → e-mail ao colaborador que abriu.
- Enviado pelo serviço de e-mail do Lovable Cloud, com remetente configurado.

## Segurança (obrigatória, no banco)
- RLS em todas as tabelas: colaborador vê só os próprios chamados; responsável só os dos seus setores; admin vê tudo. Direção vê tudo (para o módulo 2).
- Fotos em bucket **privado** (`chamados`), caminho por chamado; acesso liberado só a quem pode ver o chamado (políticas de storage).
- Alteração de status permitida só ao responsável do setor ou admin, validado por política no banco (não só na interface).
- Papéis só em `user_roles` (nunca no perfil editável).

## Detalhes técnicos
- Rotas: `/auth`, `/` (Chamados, tela principal), `/chamados/novo`, `/chamados/$id`; `/admin` para pessoas autorizadas e setores. Área logada em `_authenticated/` (sem SSR, gate de sessão).
- Leitura/escrita do banco via server functions (`createServerFn`) com middleware de autenticação; validação com Zod; mensagens de erro em português.
- Fotos: upload direto ao storage privado pelo cliente; exibição por URL assinada de curta duração.
- E-mails disparados dentro das server functions que criam o chamado e alteram o status (falha de e-mail não bloqueia a operação; fica registrada no histórico).
- Design: azul e amarelo ("Raios de Sol"), cantos arredondados, botões grandes para toque, shadcn/ui, estados vazios e carregamento amigáveis em português.

## Verificação
1. Build sem erros; telas revisadas no navegador (celular e desktop).
2. RLS validada no banco: consultas simulando colaborador, responsável de dois setores e admin, confirmando quem vê o quê.
3. Fluxo completo testado: cadastro com e-mail autorizado, criação de chamado com fotos, troca de status pelo responsável, comentário de solução, histórico e e-mails disparados.
4. Cadastro com e-mail fora da lista é recusado.
