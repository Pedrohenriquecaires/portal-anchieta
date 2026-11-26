# Portal Anchieta — Sistema acadêmico

Portal funcional com cargos **Coordenador**, **Professor** e **Aluno** — notas, provas, atividades, frequência e apresentação Antes × Depois.

## Como abrir

Execute `..\start.bat` ou abra `index.html` com Live Server / servidor local.

Versão anterior (ANTES): pasta `antes/` (marca antiga EduConnect).

## Login demo

| Cargo | Login | Senha |
| --- | --- | --- |
| Coordenador | `admin` | `Admin@123` |
| Professor Ana Ribeiro | RA `2601001` | CPF `39085214700` |
| Aluno Gustavo Henrique Mira | RA `2609681` | CPF `46580142898` |
| Aluna Marina Costa Silva | RA `2609742` | CPF `51273486901` |

## Apresentação

- Login → **Ver apresentação Antes × Depois**
- 16 slides em pares 1:1 (`antes/` × `depois-mirror.html`)
- Botão **Frases** (tecla `N`) para teleprompter

## Redesign 2026.2 — o que mudou no front

Arquivos: `styles.css` (reescrito), `effects.js` (novo) e o login em `index.html`. A lógica (`script.js`, `academic.js`, `slides.js`) não foi alterada.

| Princípio do PDF | Como foi aplicado |
| --- | --- |
| Design tokens | Cor, forma, espaço, elevação e **movimento** em variáveis no `:root`, com tema claro e escuro. As views não usam cor fixa |
| Hierarquia | Um título, uma frase e as ações por tela. As métricas ficam em destaque e as ações primária, tonal e texto são distintas |
| Estados | Hover, foco visível, pressionado (ripple), disabled, loading (spinner/shimmer), erro (shake + alert), vazio e sucesso (snackbar com barra de tempo) |
| Movimento com propósito | Os blocos aparecem em sequência ao entrar na tela. Os cards de métricas, ações rápidas, demos do login e "8 melhorias" **expandem no hover**. Os botões de ícone da AppBar e o FAB "Voltar ao topo" **expandem e mostram o rótulo** |
| Feedback destrutivo | Todo "Remover/Excluir" abre o Dialog de confirmação (Desafio C), com Esc e foco preso no dialog |
| Acessibilidade | Tudo o que expande no hover também expande com foco do teclado. Em telas touch, o conteúdo já aparece aberto. `prefers-reduced-motion` desliga as animações |
| Responsividade | Testado em 1366×768, 768×1024 e 360×800, sem rolagem horizontal |

## Estilo Aurora (DESIGN.md) — versão atual

O visual segue o design system "Aurora sobre um terminal à meia-noite", adaptado para faculdade:

- **Tema escuro como identidade.** A superfície é em camadas (Void `#0b0c0e` → Abyss `#0e111b` → Deep Sea `#0d172b` → Cobalt Panel `#12244f`) e o texto é acromático. O tema claro "luz do dia" continua no botão da AppBar.
- **Tipografia.** Figtree 500 nos títulos, Inter 300/400 no corpo e IBM Plex Mono em RA, notas e códigos.
- **Ações.** A ação primária é uma pílula branca (escura no tema claro). A secundária é "ghost", só com contorno. O acento azul→violeta aparece uma vez por tela (ex.: "Ver provas").
- **Brilhos aurora** (roxo + rosa) ficam só no fundo, no login e no hero. Os cards não têm brilho: têm borda fina, e no hover ganham sombra e mudam de camada.
- **Toque de faculdade.** No login, os editores de código do DESIGN.md viraram um boletim flutuante, o cálculo da média em `media.js` e um lembrete de prova.

### Correção: excluir aluno na Coordenação

Antes, ao remover uma conta demo (ex.: Marina), ela voltava para o fim da lista. Agora as contas demo excluídas ficam registradas em `localStorage["educonnect-removed-seeds"]` e não são recriadas. O usuário removido também sai de todas as turmas.

Para restaurar as contas demo na apresentação, rode `localStorage.clear()` no console do navegador e recarregue a página.

### Slides Antes × Depois

O `depois-mirror.html` foi refeito com o mesmo `styles.css` e os mesmos componentes do portal. Assim, os slides do DEPOIS mostram exatamente o design atual e acompanham mudanças futuras. Os arquivos antigos `depois-mirror.css` e `depois-mirror.js` foram removidos. As âncoras dos slides continuam as mesmas (`#hero`, `#desempenho`, `#componentes`, `#perfil`, `#estados`). O slide 12 usa `#light` para mostrar que o tema claro também existe, já que os outros slides são escuros.

## Publicar na Vercel

1. Dê dois cliques em `..\deploy-vercel.bat`. Ele precisa do Node.js, que o `start.bat` também usa.
2. Na primeira vez, entre na Vercel pelo navegador e responda às perguntas como o próprio `.bat` mostra. Use o nome de projeto `portal-anchieta`.
3. Para atualizar o site depois de qualquer mudança, rode o `.bat` de novo.

O site é estático: os dados ficam no `localStorage` de cada visitante (veja a seção sobre banco de dados).

## Banco de dados (PostgreSQL / Neon) — versão 2.0

O portal tem um **banco de dados real** e sincronização em **tempo real** entre computadores.

### Arquitetura
```
Navegador (HTML/CSS/JS)  ──►  API (Vercel Functions, pasta api/)  ──►  PostgreSQL (Neon)
   db.js: cache local +          /api/login  /api/state  /api/sync      9 tabelas relacionais
   sincronização a cada 3 s      /api/stats  /api/reset  /api/health    + log de auditoria + VIEW
```

- **`db.js`** carrega os dados do banco, carrega o portal, envia cada alteração para `/api/sync` e, a cada 3 s, busca o que outras pessoas mudaram. Por exemplo: o professor lança uma nota e o aluno recebe um aviso na hora.
- **Segurança:** as senhas ficam com hash **bcrypt** e nunca saem do servidor. O login é conferido no servidor e devolve um token assinado (HMAC, 12 h). Cada alteração é checada pelo papel de quem fez: o aluno não consegue lançar nota nem pela API.
- **Tabelas:** `usuarios`, `turmas`, `turma_alunos` (matrículas), `notas`, `provas`, `atividades`, `entregas` e `faltas`, com chaves estrangeiras e `ON DELETE CASCADE`. Há ainda `log_alteracoes` (auditoria) e a VIEW `vw_boletim`, que calcula média e faltas por aluno.
- **Tela "Banco de dados"** (só a coordenação vê): conexão, latência, registros por tabela, log ao vivo, boletim calculado em SQL e o botão **Restaurar banco**.
- **Modo local:** sem banco conectado (por exemplo, no `start.bat`), o portal funciona como antes, salvando no navegador.

### Ativar na Vercel
1. Projeto → **Storage** → **Create Database** → **Neon** → conectar ao projeto. Isso cria a variável `DATABASE_URL`.
2. Faça um novo deploy (`git push`). No primeiro acesso, a API cria as tabelas e grava os dados de demonstração (`api/_lib/seed.js`).
3. Opcional: crie a variável `SESSION_SECRET` com um texto aleatório, para assinar os tokens.

Para mudar os dados iniciais, edite `api/_lib/seed.js`, publique e clique em **Banco de dados → Restaurar banco**.
