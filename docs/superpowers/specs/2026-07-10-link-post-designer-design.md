# Link por post para o designer

**Data:** 2026-07-10
**Status:** Aprovado

## Problema

No detalhe da campanha (`/admin/campaigns/[id]`), cada post mostra o comentário/ajuste
pedido pelo cliente (ex.: *"Ajustar a fonte da última frase."*) e um botão "Abrir no Drive".
Mas não existe um único link que empacote **o conteúdo do post + o ajuste solicitado**
para enviar a um designer. Hoje seria preciso mandar o print, o link do Drive e o texto do
ajuste separadamente.

## Objetivo

Cada post ganha um link compartilhável que abre uma página pública, somente leitura,
mostrando as imagens/slides, a legenda, o link do Drive e os ajustes pedidos (cliente e
revisão interna). O admin copia esse link e envia ao designer.

## Identificação do post na URL

Um "post" é um `ContentItem` único **ou** um grupo de slides de carrossel que compartilham
o mesmo `groupId`. A URL usa o **id do item representante**:

- Post único → o próprio `item.id`
- Carrossel → o `id` do primeiro slide (`slides[0].id`)

```
https://<dominio>/post/<id-do-item>
```

O `id` é um cuid (não-adivinhável). Mesmo modelo de segurança das páginas `/aprovar/[token]`
e `/revisar/[token]`: página pública, protegida apenas pela URL secreta. **Sem migração de
banco** — nenhum campo novo. (Alternativa considerada e descartada: criar um campo
`postToken` — migração desnecessária, YAGNI.)

**Middleware:** verificado que `src/middleware.ts` só protege `/admin/((?!login).*)` e
`/api/admin/:path*`. Logo, `/post/[id]` e `/api/post/[id]` já são públicos por padrão — **não
é preciso alterar o middleware**.

## Componentes

### 1. API pública — `GET /api/post/[id]/route.ts`

Espelha o padrão de `src/app/api/approval/[token]/route.ts`.

- Busca o `ContentItem` por `id` (com `campaign` + `client`, `approvalItem`, `internalReviewItem`).
- Se não encontrar → `404 { error: "Post não encontrado" }`.
- Determina o grupo:
  - Se `item.contentType === "CARROSSEL" && item.groupId` → busca todos os `ContentItem`
    com aquele `groupId`, ordenados por `order asc`.
  - Caso contrário → só o item.
- O comentário de cliente e o de revisão interna vêm do **item representante** (o item
  buscado pela URL, que é o representante tanto para único quanto para carrossel).
- Retorna JSON:

```
{
  campaignName, clientName,
  title, caption, scheduledDate, contentType, driveUrl,
  slides: [{ id, fileUrl, fileType, order }],
  clientComment, clientCommentResolved,
  internalComment, internalCommentResolved
}
```

- `try/catch` com `500 { error: "Erro ao buscar post" }`.

### 2. Página pública — `/post/[id]/page.tsx`

`"use client"`, tema escuro (`#0f0f0f`, bordas `white/10`), somente leitura.

- Estados: `loading`, `data` (fetch de `/api/post/[id]`), `lightboxUrl`.
- Cabeçalho: `Cliente · Campanha` + título do post.
- Galeria de slides:
  - Imagem (`fileType === "IMAGE"`) → miniatura clicável que abre lightbox (imagem grande,
    fecha com Esc / clique fora — padrão do lightbox já existente na página de campanha).
  - Vídeo → ícone 🎬.
- Legenda (quando houver).
- Destaque de ajustes:
  - `clientComment` → bloco âmbar "Ajuste do cliente: …".
  - `internalComment` → bloco violeta "Revisão interna: …".
  - Se ambos vazios, nenhum bloco é mostrado.
- Botão "🔗 Abrir no Drive" quando `driveUrl` existir.
- Estados de carregamento ("Carregando...") e erro/404 ("Post não encontrado.").
- Nenhuma ação de edição/aprovação.

### 3. Botão no admin — "🔗 Link p/ designer" (em todos os posts)

Copia a URL para a área de transferência com feedback "Copiado!" (~2s), reusando o padrão
de `copyLink` já existente.

- **Post único** — em `src/app/admin/(protected)/campaigns/[id]/page.tsx`, na linha de ações
  do card do post (junto de Editar/Remover). Copia `${window.location.origin}/post/${item.id}`.
- **Carrossel** — em `src/components/admin/CarouselCard.tsx`, na linha de botões (junto de
  "Editar / Adicionar slides"). Copia `${window.location.origin}/post/${slides[0].id}`.
- O estado de feedback ("Copiado!") é por post — clicar em um não deve marcar todos. No
  card único, o feedback pode ser controlado por `itemId` selecionado; no CarouselCard, por
  um estado local booleano do próprio componente.

## Fora de escopo (YAGNI)

- Nenhum campo/token novo no banco.
- Sem envio automático por e-mail/WhatsApp ao designer — apenas link copiável.
- Sem edição pelo designer — página estritamente de leitura.
- Sem controle de expiração próprio do link (segue vivo enquanto o item existir).

## Critérios de sucesso

1. Em qualquer post (único ou carrossel), o botão "Link p/ designer" copia uma URL válida.
2. Abrir essa URL (sem estar logado) mostra as imagens/slides, a legenda, o link do Drive e
   os ajustes do cliente e da revisão interna, quando existirem.
3. Um id inexistente mostra "Post não encontrado."
4. Nenhuma ação de edição/aprovação está disponível na página do designer.
