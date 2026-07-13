# Link da Programação por cliente (social media) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Um link público por cliente (`/programar/[clientId]`) que lista os posts prontos para agendar daquele cliente (assets no Drive, legenda copiável, data), onde o social media marca cada post como "Agendado ✓", enviado a partir do painel da Programação.

**Architecture:** A lógica de seleção de posts é extraída para `src/lib/programacao.ts` e reusada pela página admin e pela nova API pública. A API pública (`/api/programar/[clientId]`) faz GET (lista) e PATCH (marca `postedAt`, com guarda IDOR). A página pública consome a API. Um botão no admin copia o link.

**Tech Stack:** Next.js 14 App Router, React (client + server components), Prisma, TypeScript, Tailwind.

## Global Constraints

- **Sem migração de banco.** Rota pública identificada pelo `clientId` (cuid não-adivinhável).
- **Sem alteração de middleware** (`/programar/*` e `/api/programar/*` já são públicos).
- **Refactor não pode mudar o comportamento** da Programação admin (critério de sucesso #7).
- **Guarda IDOR no PATCH:** só marca item cujo `campaign.clientId === params.clientId`.
- **Sem framework de testes** — verificar com `npx tsc --noEmit` e `npm run build`. **NÃO** rodar `npm run lint` (ESLint não configurado; abre wizard interativo).
- Tema escuro (`#0f0f0f`, `white/10`), labels pt-BR, `@` → `src/`.
- Reusar `CopyButton` (`@/components/admin/CopyButton`) para copiar legenda.

---

## File Structure

- `src/lib/programacao.ts` — **criar**. Tipo `SchedulablePost`, tipo de entrada `SchedulableInputCampaign`, função `getSchedulablePosts`.
- `src/components/admin/ProgramacaoKanban.tsx` — **modificar**. `Post` passa a reexportar `SchedulablePost`; adiciona botão "Link social media".
- `src/app/admin/(protected)/programacao/page.tsx` — **modificar**. Importa `getSchedulablePosts` da lib; remove a função local e o tipo `CampaignWithItems`.
- `src/app/api/programar/[clientId]/route.ts` — **criar**. GET (lista) + PATCH (marca postado).
- `src/app/programar/[clientId]/page.tsx` — **criar**. Página pública.

---

## Task 1: Refactor — extrair a seleção de posts para `src/lib/programacao.ts`

**Files:**
- Create: `src/lib/programacao.ts`
- Modify: `src/components/admin/ProgramacaoKanban.tsx`
- Modify: `src/app/admin/(protected)/programacao/page.tsx`

**Interfaces:**
- Produces: `SchedulablePost` (tipo), `SchedulableInputCampaign` (tipo de entrada), `getSchedulablePosts(campaign: SchedulableInputCampaign): SchedulablePost[]`.

- [ ] **Step 1: Criar a lib**

Create `src/lib/programacao.ts`:

```ts
// Seleção compartilhada de posts da Programação — usada pela página admin e pela
// API pública por cliente, para ambas aplicarem exatamente a mesma regra.

export interface SchedulablePost {
  id: string;
  campaignId: string;
  campaignName: string;
  title: string | null;
  contentType: string;
  fileType: string;
  fileUrl: string;
  coverUrl: string | null;
  coverDriveUrl: string | null;
  caption: string | null;
  driveUrl: string | null;
  groupId: string | null;
  scheduledDate: string | null;
  postedAt: string | null;
  approvedAt: string | null;
}

export interface SchedulableInputCampaign {
  id: string;
  name: string;
  status: string;
  approvalItems: { contentItemId: string; status: string; reviewedAt: Date | null }[];
  contentItems: {
    id: string;
    contentType: string;
    groupId: string | null;
    title: string | null;
    caption: string | null;
    fileUrl: string;
    fileType: string;
    coverUrl: string | null;
    coverDriveUrl: string | null;
    driveUrl: string | null;
    scheduledDate: Date | null;
    postedAt: Date | null;
    sentToProgramacaoAt: Date | null;
    internalReviewItem: { status: string } | null;
  }[];
}

/**
 * Posts aprovados e liberados para a Programação (carrossel = 1 post, pelo primeiro slide).
 * NÃO filtra por postedAt — cada chamador decide se quer só os não-postados.
 */
export function getSchedulablePosts(campaign: SchedulableInputCampaign): SchedulablePost[] {
  const seen = new Set<string>();
  const posts: SchedulablePost[] = [];

  for (const item of campaign.contentItems) {
    if (item.contentType === "TEXTO") continue;
    // Exclui itens escondidos do cliente pela revisão interna
    if (item.internalReviewItem && item.internalReviewItem.status !== "APPROVED") continue;
    const approval = campaign.approvalItems.find((a) => a.contentItemId === item.id);
    if (approval?.status !== "APPROVED") continue;
    // Só entra na Programação se a campanha está fechada/publicada OU foi enviado explicitamente.
    const campaignReleased = campaign.status === "CLOSED" || campaign.status === "PUBLISHED";
    if (!campaignReleased && !item.sentToProgramacaoAt) continue;

    const base = {
      campaignId: campaign.id,
      campaignName: campaign.name,
      approvedAt: approval.reviewedAt?.toISOString() ?? null,
      postedAt: item.postedAt?.toISOString() ?? null,
      scheduledDate: item.scheduledDate?.toISOString() ?? null,
    };

    if (item.contentType === "CARROSSEL" && item.groupId) {
      if (seen.has(item.groupId)) continue;
      seen.add(item.groupId);
      posts.push({
        id: item.id, groupId: item.groupId, title: item.title, caption: item.caption,
        driveUrl: item.driveUrl, coverUrl: item.coverUrl, coverDriveUrl: item.coverDriveUrl,
        contentType: item.contentType, fileType: item.fileType, fileUrl: item.fileUrl, ...base,
      });
    } else if (item.contentType !== "CARROSSEL") {
      posts.push({
        id: item.id, groupId: null, title: item.title, caption: item.caption,
        driveUrl: item.driveUrl, coverUrl: item.coverUrl, coverDriveUrl: item.coverDriveUrl,
        contentType: item.contentType, fileType: item.fileType, fileUrl: item.fileUrl, ...base,
      });
    }
  }
  return posts;
}
```

- [ ] **Step 2: `ProgramacaoKanban` reexporta o tipo da lib**

Em `src/components/admin/ProgramacaoKanban.tsx`, adicionar o import no topo (após os imports existentes, ~linha 6):

```ts
import { type SchedulablePost } from "@/lib/programacao";
```

Substituir toda a `export interface Post { ... }` (linhas ~15-31) por:

```ts
export type Post = SchedulablePost;
```

(O `interface CampaignData` logo abaixo continua referenciando `Post` normalmente.)

- [ ] **Step 3: Página admin usa a função da lib**

Em `src/app/admin/(protected)/programacao/page.tsx`:

(a) No import da linha 5, manter o de `ProgramacaoKanban` e adicionar o import da lib logo abaixo:

```ts
import ProgramacaoKanban, { type CampaignData } from "@/components/admin/ProgramacaoKanban";
import { getSchedulablePosts } from "@/lib/programacao";
```
(Note: `Post` deixa de ser importado aqui — não é mais usado diretamente nesta página.)

(b) Remover o tipo `CampaignWithItems` (linha ~47) e a função local `getApprovedPosts` inteira (linhas ~49-105).

(c) Onde a função era chamada (linha ~112), trocar:
```ts
      const posts = getApprovedPosts(campaign);
```
por:
```ts
      const posts = getSchedulablePosts(campaign);
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: zero erros. (O resultado da query admin — que inclui `client`, `approvalItems`, e o `select` de `contentItems` — é estruturalmente compatível com `SchedulableInputCampaign`; campos a mais são permitidos.)

- [ ] **Step 5: Build (garante que a Programação admin ainda compila)**

Run: `npm run build`
Expected: build conclui sem erros; rota `/admin/programacao` compila.

- [ ] **Step 6: Commit**

```bash
git add src/lib/programacao.ts src/components/admin/ProgramacaoKanban.tsx "src/app/admin/(protected)/programacao/page.tsx"
git commit -m "refactor: extract getSchedulablePosts to src/lib/programacao"
```

---

## Task 2: API pública `/api/programar/[clientId]` (GET + PATCH)

**Files:**
- Create: `src/app/api/programar/[clientId]/route.ts`

**Interfaces:**
- Consumes: `getSchedulablePosts` de `@/lib/programacao` (Task 1); `prisma` de `@/lib/prisma`.
- Produces:
  - `GET /api/programar/[clientId]` → `{ clientName: string, campaigns: { campaignId: string, campaignName: string, posts: SchedulablePost[] }[] }`; 404 `{ error: "Cliente não encontrado" }`.
  - `PATCH /api/programar/[clientId]` → body `{ contentItemId: string }` → marca `postedAt`; 400 se faltar campo; 404 se o item não pertence ao cliente; `{ success: true }` em sucesso.

- [ ] **Step 1: Criar a rota**

Create `src/app/api/programar/[clientId]/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSchedulablePosts } from "@/lib/programacao";

export async function GET(_req: NextRequest, { params }: { params: { clientId: string } }) {
  try {
    const client = await prisma.client.findUnique({
      where: { id: params.clientId },
      select: { name: true },
    });
    if (!client) {
      return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
    }

    const campaigns = await prisma.campaign.findMany({
      where: {
        clientId: params.clientId,
        OR: [
          { status: { in: ["CLOSED", "PUBLISHED"] } },
          { contentItems: { some: { sentToProgramacaoAt: { not: null } } } },
        ],
      },
      select: {
        id: true,
        name: true,
        status: true,
        approvalItems: { select: { contentItemId: true, status: true, reviewedAt: true } },
        contentItems: {
          orderBy: { order: "asc" },
          select: {
            id: true,
            contentType: true,
            groupId: true,
            title: true,
            caption: true,
            fileUrl: true,
            fileType: true,
            coverUrl: true,
            coverDriveUrl: true,
            driveUrl: true,
            scheduledDate: true,
            postedAt: true,
            sentToProgramacaoAt: true,
            internalReviewItem: { select: { status: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const result = campaigns
      .map((c) => ({
        campaignId: c.id,
        campaignName: c.name,
        posts: getSchedulablePosts(c).filter((p) => !p.postedAt),
      }))
      .filter((c) => c.posts.length > 0);

    return NextResponse.json({ clientName: client.name, campaigns: result });
  } catch {
    return NextResponse.json({ error: "Erro ao buscar programação" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { clientId: string } }) {
  try {
    const { contentItemId } = await req.json();
    if (!contentItemId) {
      return NextResponse.json({ error: "Campo obrigatório faltando" }, { status: 400 });
    }

    // Guarda IDOR: o item precisa pertencer a uma campanha deste cliente.
    const item = await prisma.contentItem.findFirst({
      where: { id: contentItemId, campaign: { clientId: params.clientId } },
      select: { id: true, campaignId: true },
    });
    if (!item) {
      return NextResponse.json({ error: "Item não encontrado" }, { status: 404 });
    }

    await prisma.contentItem.update({
      where: { id: contentItemId },
      data: { postedAt: new Date() },
    });

    // Auto-publish: se todos os itens APPROVED da campanha já foram postados, publica.
    const campaignItems = await prisma.contentItem.findMany({
      where: { campaignId: item.campaignId },
      include: { approvalItem: true },
    });
    const approvedItems = campaignItems.filter((i) => i.approvalItem?.status === "APPROVED");
    if (approvedItems.length > 0 && approvedItems.every((i) => i.postedAt)) {
      await prisma.campaign.update({
        where: { id: item.campaignId },
        data: { status: "PUBLISHED" },
      });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Erro ao marcar como agendado" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: zero erros.

- [ ] **Step 3: Commit**

```bash
git add "src/app/api/programar/[clientId]/route.ts"
git commit -m "feat: public GET/PATCH /api/programar/[clientId]"
```

---

## Task 3: Página pública `/programar/[clientId]`

**Files:**
- Create: `src/app/programar/[clientId]/page.tsx`

**Interfaces:**
- Consumes: `GET`/`PATCH /api/programar/[clientId]` (Task 2); tipo `SchedulablePost` de `@/lib/programacao`; `CopyButton`.
- Produces: rota pública `/programar/[clientId]`.

- [ ] **Step 1: Criar a página**

Create `src/app/programar/[clientId]/page.tsx`:

```tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import CopyButton from "@/components/admin/CopyButton";
import { type SchedulablePost } from "@/lib/programacao";

const CONTENT_TYPE_LABELS: Record<string, string> = {
  CARROSSEL: "Carrossel",
  POST_FEED: "Post Feed",
  REELS: "Reels",
  STORIES: "Stories",
};

interface CampaignGroup {
  campaignId: string;
  campaignName: string;
  posts: SchedulablePost[];
}
interface Data {
  clientName: string;
  campaigns: CampaignGroup[];
}

export default function ProgramarPage() {
  const { clientId } = useParams<{ clientId: string }>();
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [markingId, setMarkingId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/programar/${clientId}`, { cache: "no-store" });
      if (!res.ok) { setNotFound(true); return; }
      setData(await res.json());
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function markPosted(postId: string) {
    setMarkingId(postId);
    try {
      const res = await fetch(`/api/programar/${clientId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentItemId: postId }),
      });
      if (!res.ok) throw new Error();
      setData((prev) =>
        prev
          ? {
              ...prev,
              campaigns: prev.campaigns
                .map((c) => ({ ...c, posts: c.posts.filter((p) => p.id !== postId) }))
                .filter((c) => c.posts.length > 0),
            }
          : prev
      );
    } catch {
      alert("Erro ao marcar como agendado. Tente novamente.");
    } finally {
      setMarkingId(null);
    }
  }

  if (loading) return <div className="min-h-screen bg-[#0f0f0f] text-gray-400 p-8">Carregando...</div>;
  if (notFound || !data) return <div className="min-h-screen bg-[#0f0f0f] text-red-400 p-8">Cliente não encontrado.</div>;

  const totalPosts = data.campaigns.reduce((s, c) => s + c.posts.length, 0);

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-white">
      <div className="max-w-2xl mx-auto p-6 space-y-5">
        <div>
          <h1 className="text-xl font-semibold">{data.clientName}</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {totalPosts === 0
              ? "Nenhum post para agendar no momento."
              : `${totalPosts} ${totalPosts === 1 ? "post para agendar" : "posts para agendar"}`}
          </p>
        </div>

        {data.campaigns.map((camp) => (
          <div key={camp.campaignId} className="space-y-2">
            <h2 className="text-sm font-medium text-gray-300">{camp.campaignName}</h2>
            {camp.posts.map((post) => {
              const hasDriveLinks = post.driveUrl || (post.contentType === "REELS" && post.coverDriveUrl);
              return (
                <div key={post.id} className="bg-[#1a1a1a] border border-white/[0.08] rounded-xl overflow-hidden">
                  <div className="flex items-start gap-3 p-3">
                    <div className="w-10 h-10 rounded-lg overflow-hidden bg-black/40 shrink-0 flex items-center justify-center">
                      {post.fileType === "IMAGE" ? (
                        <img src={post.fileUrl} alt="" className="w-full h-full object-cover" />
                      ) : post.fileType === "VIDEO" ? (
                        <span className="text-lg">🎬</span>
                      ) : (
                        <span className="text-lg">📄</span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                      {post.title && <p className="text-white text-xs font-medium">{post.title}</p>}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs text-emerald-400 bg-emerald-900/20 px-1.5 py-0.5 rounded">
                          {CONTENT_TYPE_LABELS[post.contentType] ?? post.contentType}
                        </span>
                        {post.scheduledDate && (
                          <span className="text-xs text-gray-400 bg-white/5 px-1.5 py-0.5 rounded">
                            📅 {new Date(post.scheduledDate).toLocaleDateString("pt-BR", { timeZone: "UTC", day: "2-digit", month: "2-digit" })}
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => markPosted(post.id)}
                      disabled={markingId === post.id}
                      className="shrink-0 text-xs bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-medium px-2.5 py-1.5 rounded-lg transition-colors"
                    >
                      {markingId === post.id ? "..." : "Agendado ✓"}
                    </button>
                  </div>

                  {hasDriveLinks && (
                    <div className="border-t border-white/5 px-3 py-2 flex flex-wrap gap-2">
                      {post.driveUrl && (
                        <a href={post.driveUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 bg-blue-900/20 border border-blue-500/20 px-3 py-1.5 rounded-lg transition-colors">
                          🔗 Arquivo no Drive
                        </a>
                      )}
                      {post.contentType === "REELS" && post.coverDriveUrl && (
                        <a href={post.coverDriveUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs text-purple-400 hover:text-purple-300 bg-purple-900/20 border border-purple-500/20 px-3 py-1.5 rounded-lg transition-colors">
                          🖼️ Capa no Drive
                        </a>
                      )}
                    </div>
                  )}

                  {post.caption && (
                    <div className="border-t border-white/5 px-3 py-3">
                      <p className="text-xs text-gray-300 whitespace-pre-wrap leading-relaxed">{post.caption}</p>
                      <div className="mt-2">
                        <CopyButton text={post.caption} />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: zero erros.

- [ ] **Step 3: Commit**

```bash
git add "src/app/programar/[clientId]/page.tsx"
git commit -m "feat: public per-client programacao page for social media"
```

---

## Task 4: Botão "Link social media" no admin + build final

**Files:**
- Modify: `src/components/admin/ProgramacaoKanban.tsx`

**Interfaces:**
- Consumes: `camp.clientId` (já presente em `CampaignData`); rota `/programar/[clientId]` (Task 3).
- Produces: nada consumido por outra task.

- [ ] **Step 1: Adicionar o componente do botão**

Em `src/components/admin/ProgramacaoKanban.tsx`, adicionar um componente pequeno com estado próprio de "copiado", logo antes de `export default function ProgramacaoKanban` (~linha 288):

```tsx
function SocialMediaLinkButton({ clientId }: { clientId: string }) {
  const [copied, setCopied] = useState(false);
  function copy(e: React.MouseEvent) {
    e.stopPropagation();
    navigator.clipboard.writeText(`${window.location.origin}/programar/${clientId}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <button
      onClick={copy}
      className="text-xs px-2.5 py-1 rounded-lg bg-sky-900/30 hover:bg-sky-900/50 text-sky-400 border border-sky-500/30 transition-colors"
    >
      {copied ? "Copiado!" : "🔗 Link social media"}
    </button>
  );
}
```

- [ ] **Step 2: Adicionar um slot `linkButton` ao `ClientCard`**

No componente `ClientCard`, adicionar a prop `linkButton` e renderizá-la antes de `{plannerButton}` no cabeçalho.

Na assinatura de props do `ClientCard` (o objeto desestruturado, ~linha 242), adicionar `linkButton,`:
```tsx
  isOpen,
  onToggle,
  linkButton,
  plannerButton,
  children,
```
No tipo das props (logo abaixo), adicionar:
```tsx
  linkButton?: React.ReactNode;
  plannerButton?: React.ReactNode;
```
No cabeçalho, na `div` de ações (`<div className="flex items-center gap-2 shrink-0 ml-3">`, ~linha 270), adicionar `{linkButton}` antes de `{plannerButton}`:
```tsx
        <div className="flex items-center gap-2 shrink-0 ml-3">
          {linkButton}
          {plannerButton}
```

- [ ] **Step 3: Passar o botão nos dois `ClientCard` (coluna 1 e coluna 2)**

Na coluna "Preencher Planner" (o `<ClientCard ...>` que já tem `plannerButton={...}`, ~linha 454), adicionar a prop:
```tsx
                  linkButton={<SocialMediaLinkButton clientId={camp.clientId} />}
```
Na coluna "Programação" (o `<ClientCard ...>` sem `plannerButton`, ~linha 527), adicionar a mesma prop:
```tsx
                  linkButton={<SocialMediaLinkButton clientId={camp.clientId} />}
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: zero erros.

- [ ] **Step 5: Build final**

Run: `npm run build`
Expected: build conclui sem erros; rotas `/programar/[clientId]` e `/api/programar/[clientId]` aparecem na saída, além de `/admin/programacao`.

- [ ] **Step 6: Commit**

```bash
git add src/components/admin/ProgramacaoKanban.tsx
git commit -m "feat: social media link button on programacao client cards"
```

---

## Self-Review (feito na escrita)

- **Cobertura da spec:** refactor DRY (Task 1); API GET+PATCH com IDOR + auto-publish (Task 2); página pública com data/Drive/legenda/Agendado (Task 3); botão no admin (Task 4). Critérios 1–8 cobertos. ✅
- **Sem placeholders:** todo código completo. ✅
- **Consistência de tipos:** `SchedulablePost` é a fonte única do shape do post; `ProgramacaoKanban.Post` reexporta ele; a página pública e a API usam o mesmo tipo. O `select` do GET público lista exatamente os campos de `SchedulableInputCampaign.contentItems`, então `getSchedulablePosts(c)` tipa certo. O body `{ contentItemId }` bate entre a página (Task 3) e o PATCH (Task 2). ✅
- **Sem regressão admin:** Task 1 mantém a lógica idêntica (mesma função, só movida) e a página admin segue passando seu resultado de query (superset dos campos exigidos). Build da Task 1 confirma. ✅
- **Segurança:** GET expõe só dados de agendamento (mesmo tipo de dado já público em `/aprovar`/`/post`); PATCH tem guarda IDOR por `clientId`. Rotas públicas por design (middleware inalterado). ✅
