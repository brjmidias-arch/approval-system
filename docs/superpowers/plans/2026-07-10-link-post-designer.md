# Link por post para o designer — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cada post (único ou carrossel) ganha um link público, somente leitura, que mostra imagens/slides, legenda, link do Drive e os ajustes pedidos (cliente + revisão interna), copiável a partir do painel admin para enviar ao designer.

**Architecture:** Uma rota de API pública `GET /api/post/[id]` agrega os dados do post pelo id do item representante (item único ou primeiro slide do carrossel). Uma página pública `/post/[id]` consome essa API e renderiza tudo em modo leitura. No admin, um botão "Link p/ designer" copia `origin/post/<id>` em cada card de post.

**Tech Stack:** Next.js 14 App Router, React (client components), Prisma, TypeScript, Tailwind CSS.

## Global Constraints

- **Sem migração de banco** — nenhum campo/model novo no Prisma.
- **Sem alteração de middleware** — `src/middleware.ts` só protege `/admin/((?!login).*)` e `/api/admin/:path*`; `/post/*` e `/api/post/*` já são públicos.
- **Tema escuro:** fundo `#0f0f0f`, bordas `white/10`. Status: emerald (aprovado), amber (ajuste), red (reprovado), violet (interno).
- **Labels em português (pt-BR).**
- **Sem framework de testes** no projeto — verificação por `npm run lint`, `npm run build` e checagem manual (curl/navegador).
- Componentes interativos usam `"use client"`.
- `@` mapeia para `src/`.

---

## File Structure

- `src/app/api/post/[id]/route.ts` — **criar**. API pública `GET`: agrega o post e devolve JSON.
- `src/app/post/[id]/page.tsx` — **criar**. Página pública somente leitura do post.
- `src/app/admin/(protected)/campaigns/[id]/page.tsx` — **modificar**. Botão "Link p/ designer" no card de post único + estado de feedback por item.
- `src/components/admin/CarouselCard.tsx` — **modificar**. Botão "Link p/ designer" no card de carrossel + estado de feedback local.

---

## Task 1: API pública `GET /api/post/[id]`

**Files:**
- Create: `src/app/api/post/[id]/route.ts`

**Interfaces:**
- Consumes: `prisma` de `@/lib/prisma`.
- Produces: `GET /api/post/[id]` retornando JSON:
  ```ts
  {
    campaignName: string;
    clientName: string;
    title: string | null;
    caption: string | null;
    scheduledDate: string | null;
    contentType: string;
    driveUrl: string | null;
    slides: { id: string; fileUrl: string; fileType: string; order: number }[];
    clientComment: string | null;
    clientCommentResolved: boolean;
    internalComment: string | null;
    internalCommentResolved: boolean;
  }
  ```
  404 `{ error: "Post não encontrado" }` se o id não existir; 500 `{ error: "Erro ao buscar post" }` em falha.

- [ ] **Step 1: Criar a rota**

Create `src/app/api/post/[id]/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const item = await prisma.contentItem.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        fileUrl: true,
        fileType: true,
        title: true,
        caption: true,
        scheduledDate: true,
        contentType: true,
        groupId: true,
        driveUrl: true,
        order: true,
        campaign: { select: { name: true, client: { select: { name: true } } } },
        approvalItem: { select: { clientComment: true, clientCommentResolved: true } },
        internalReviewItem: { select: { comment: true, commentResolved: true } },
      },
    });

    if (!item) {
      return NextResponse.json({ error: "Post não encontrado" }, { status: 404 });
    }

    // Carrossel: agrega todos os slides do mesmo groupId. Único: só o item.
    const slidesRaw =
      item.contentType === "CARROSSEL" && item.groupId
        ? await prisma.contentItem.findMany({
            where: { groupId: item.groupId },
            orderBy: { order: "asc" },
            select: { id: true, fileUrl: true, fileType: true, order: true },
          })
        : [{ id: item.id, fileUrl: item.fileUrl, fileType: item.fileType, order: item.order }];

    return NextResponse.json({
      campaignName: item.campaign.name,
      clientName: item.campaign.client.name,
      title: item.title,
      caption: item.caption,
      scheduledDate: item.scheduledDate,
      contentType: item.contentType,
      driveUrl: item.driveUrl,
      slides: slidesRaw,
      clientComment: item.approvalItem?.clientComment ?? null,
      clientCommentResolved: item.approvalItem?.clientCommentResolved ?? false,
      internalComment: item.internalReviewItem?.comment ?? null,
      internalCommentResolved: item.internalReviewItem?.commentResolved ?? false,
    });
  } catch {
    return NextResponse.json({ error: "Erro ao buscar post" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: sem erros novos no arquivo criado.

- [ ] **Step 3: Verificação manual (com o dev server rodando)**

Com `npm run dev` ativo e um id de item válido do banco:
Run: `curl -s http://localhost:3000/api/post/<ID_VALIDO>`
Expected: JSON com `campaignName`, `slides` (>=1) e os campos de comentário.
Run: `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/post/nao-existe`
Expected: `404`.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/post/[id]/route.ts
git commit -m "feat: add public GET /api/post/[id] for designer link"
```

---

## Task 2: Página pública `/post/[id]`

**Files:**
- Create: `src/app/post/[id]/page.tsx`

**Interfaces:**
- Consumes: `GET /api/post/[id]` (formato JSON definido na Task 1).
- Produces: rota pública renderizada `/post/[id]`. Nenhuma exportação consumida por outra task.

- [ ] **Step 1: Criar a página**

Create `src/app/post/[id]/page.tsx`:

```tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";

interface Slide {
  id: string;
  fileUrl: string;
  fileType: string;
  order: number;
}

interface PostData {
  campaignName: string;
  clientName: string;
  title: string | null;
  caption: string | null;
  scheduledDate: string | null;
  contentType: string;
  driveUrl: string | null;
  slides: Slide[];
  clientComment: string | null;
  clientCommentResolved: boolean;
  internalComment: string | null;
  internalCommentResolved: boolean;
}

export default function PostPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<PostData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const fetchPost = useCallback(async () => {
    try {
      const res = await fetch(`/api/post/${id}`, { cache: "no-store" });
      if (!res.ok) { setNotFound(true); return; }
      setData(await res.json());
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchPost(); }, [fetchPost]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setLightboxUrl(null);
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  if (loading) return <div className="min-h-screen bg-[#0f0f0f] text-gray-400 p-8">Carregando...</div>;
  if (notFound || !data) return <div className="min-h-screen bg-[#0f0f0f] text-red-400 p-8">Post não encontrado.</div>;

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-white">
      <div className="max-w-2xl mx-auto p-6 space-y-5">
        {/* Cabeçalho */}
        <div>
          <p className="text-sm text-gray-400">
            {data.clientName} <span className="text-gray-600">·</span> {data.campaignName}
          </p>
          {data.title && <h1 className="text-xl font-semibold mt-0.5">{data.title}</h1>}
          {data.scheduledDate && (
            <p className="text-xs text-gray-500 mt-0.5">
              {new Date(data.scheduledDate).toLocaleDateString("pt-BR")}
            </p>
          )}
        </div>

        {/* Galeria */}
        <div className="flex gap-2 flex-wrap">
          {data.slides.map((slide, i) => (
            <div key={slide.id} className="w-28 h-28 rounded-lg overflow-hidden bg-black/40 relative shrink-0">
              {slide.fileType === "IMAGE" ? (
                <img
                  src={slide.fileUrl}
                  alt=""
                  className="w-full h-full object-cover cursor-zoom-in"
                  onClick={() => setLightboxUrl(slide.fileUrl)}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-2xl">🎬</div>
              )}
              <span className="absolute bottom-1 left-1 text-xs bg-black/60 text-white px-1 rounded">{i + 1}</span>
            </div>
          ))}
        </div>

        {/* Legenda */}
        {data.caption && <p className="text-sm text-gray-300 whitespace-pre-line">{data.caption}</p>}

        {/* Link do Drive */}
        {data.driveUrl && (
          <a
            href={data.driveUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-blue-400 hover:text-blue-300 bg-blue-900/20 border border-blue-500/20 px-3 py-2 rounded-lg transition-colors"
          >
            🔗 Abrir no Drive
          </a>
        )}

        {/* Ajuste do cliente */}
        {data.clientComment && (
          <div className="text-sm rounded-lg px-3 py-2.5 text-amber-400 bg-amber-900/20 border border-amber-500/20">
            <span className="opacity-70">Ajuste do cliente: </span>
            <span className={data.clientCommentResolved ? "line-through opacity-60" : ""}>{data.clientComment}</span>
            {data.clientCommentResolved && <span className="ml-1.5">✅</span>}
          </div>
        )}

        {/* Revisão interna */}
        {data.internalComment && (
          <div className="text-sm rounded-lg px-3 py-2.5 text-violet-300 bg-violet-900/20 border border-violet-500/20">
            <span className="opacity-70">Revisão interna: </span>
            <span className={data.internalCommentResolved ? "line-through opacity-60" : ""}>{data.internalComment}</span>
            {data.internalCommentResolved && <span className="ml-1.5">✅</span>}
          </div>
        )}
      </div>

      {/* Lightbox */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4"
          onClick={() => setLightboxUrl(null)}
        >
          <div className="relative max-w-4xl w-full" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setLightboxUrl(null)} className="absolute -top-10 right-0 text-white/60 hover:text-white text-sm">
              ✕ Fechar (Esc)
            </button>
            <img src={lightboxUrl} alt="" className="w-full rounded-xl object-contain max-h-[85vh]" />
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: sem erros novos.

- [ ] **Step 3: Verificação manual no navegador**

Com `npm run dev` ativo, abrir numa aba anônima (sem login):
`http://localhost:3000/post/<ID_DE_CARROSSEL>` → mostra os slides, legenda, Drive e o ajuste do cliente.
`http://localhost:3000/post/<ID_UNICO>` → mostra 1 imagem + dados.
`http://localhost:3000/post/nao-existe` → mostra "Post não encontrado."
Clicar numa imagem → abre o lightbox; Esc fecha.

- [ ] **Step 4: Commit**

```bash
git add src/app/post/[id]/page.tsx
git commit -m "feat: add public read-only post page for designers"
```

---

## Task 3: Botão "Link p/ designer" no card de carrossel

**Files:**
- Modify: `src/components/admin/CarouselCard.tsx`

**Interfaces:**
- Consumes: `slides[0].id` (o `SlideItem` já tem `id`), `window.location.origin`, rota `/post/[id]` (Task 2).
- Produces: nada consumido por outra task.

- [ ] **Step 1: Adicionar estado de feedback**

Em `src/components/admin/CarouselCard.tsx`, no componente `CarouselCard` (perto de `const [markingDone, setMarkingDone] = useState(false);`, ~linha 264), adicionar:

```tsx
  const [linkCopied, setLinkCopied] = useState(false);

  function copyDesignerLink() {
    const url = `${window.location.origin}/post/${slides[0].id}`;
    navigator.clipboard.writeText(url);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  }
```

- [ ] **Step 2: Adicionar o botão**

Na linha de botões (o `<div className="flex gap-2 mt-3">` que contém "Editar / Adicionar slides", ~linha 380), adicionar como primeiro botão após "Editar / Adicionar slides":

```tsx
        <button
          onClick={copyDesignerLink}
          className="text-xs px-3 py-1.5 bg-blue-900/30 hover:bg-blue-900/50 text-blue-400 border border-blue-500/30 rounded-lg transition-colors"
        >
          {linkCopied ? "Copiado!" : "🔗 Link p/ designer"}
        </button>
```

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: sem erros novos.

- [ ] **Step 4: Verificação manual**

Com `npm run dev` ativo, abrir uma campanha com carrossel, clicar em "🔗 Link p/ designer" → botão vira "Copiado!"; colar o link (Ctrl+V) numa aba → abre `/post/<id>` do carrossel.

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/CarouselCard.tsx
git commit -m "feat: add designer link button to carousel card"
```

---

## Task 4: Botão "Link p/ designer" no card de post único

**Files:**
- Modify: `src/app/admin/(protected)/campaigns/[id]/page.tsx`

**Interfaces:**
- Consumes: `item.id`, `window.location.origin`, rota `/post/[id]` (Task 2).
- Produces: nada consumido por outra task.

- [ ] **Step 1: Adicionar estado de feedback por item**

Em `src/app/admin/(protected)/campaigns/[id]/page.tsx`, junto dos outros `useState` do componente `CampaignPage` (perto de `const [copyFeedback, setCopyFeedback] = useState(false);`, ~linha 63), adicionar:

```tsx
  const [copiedLinkItemId, setCopiedLinkItemId] = useState<string | null>(null);

  function copyDesignerLink(itemId: string) {
    const url = `${window.location.origin}/post/${itemId}`;
    navigator.clipboard.writeText(url);
    setCopiedLinkItemId(itemId);
    setTimeout(() => setCopiedLinkItemId(null), 2000);
  }
```

- [ ] **Step 2: Adicionar o botão no card de post único**

No bloco de ações do post único (o `<div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">`, ~linha 1068), adicionar como primeiro filho, antes do bloco `{item.internalReviewItem && (`:

```tsx
                      <button
                        onClick={() => copyDesignerLink(item.id)}
                        className="text-xs px-2.5 py-1 bg-blue-900/30 hover:bg-blue-900/50 text-blue-400 border border-blue-500/30 rounded-lg transition-colors"
                      >
                        {copiedLinkItemId === item.id ? "Copiado!" : "🔗 Link p/ designer"}
                      </button>
```

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: sem erros novos.

- [ ] **Step 4: Build (garante que rotas dinâmicas e a página nova compilam)**

Run: `npm run build`
Expected: build conclui sem erros; rotas `/post/[id]` e `/api/post/[id]` aparecem na saída.

- [ ] **Step 5: Verificação manual**

Com `npm run dev` ativo, abrir uma campanha com post único (não-carrossel), clicar em "🔗 Link p/ designer" no card → botão vira "Copiado!"; colar o link numa aba → abre `/post/<id>` daquele post.

- [ ] **Step 6: Commit**

```bash
git add "src/app/admin/(protected)/campaigns/[id]/page.tsx"
git commit -m "feat: add designer link button to single post card"
```

---

## Self-Review (feito na escrita)

- **Cobertura da spec:** API pública (Task 1), página pública com galeria/legenda/Drive/ajustes cliente+interno/lightbox/404 (Task 2), botão em carrossel (Task 3) e em post único (Task 4). ✅
- **Sem placeholders:** todo código está completo. ✅
- **Consistência de tipos:** o JSON produzido na Task 1 bate exatamente com a interface `PostData` da Task 2 (mesmos nomes e tipos). O botão usa `slides[0].id` (carrossel) e `item.id` (único) — ambos existem nos respectivos contextos. ✅
- **Feedback isolado por post:** carrossel usa estado local do componente; post único usa `copiedLinkItemId` comparado a `item.id`, então só o card clicado mostra "Copiado!". ✅
