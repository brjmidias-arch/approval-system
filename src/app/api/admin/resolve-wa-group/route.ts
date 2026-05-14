import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { inviteLink } = await req.json();
  if (!inviteLink) return NextResponse.json({ error: "inviteLink obrigatório" }, { status: 400 });

  const url = process.env.UAZAPI_URL;
  const token = process.env.UAZAPI_TOKEN;
  const instance = process.env.UAZAPI_INSTANCE;

  if (!url || !token || !instance) {
    return NextResponse.json({ error: "WhatsApp não configurado (variáveis UAZAPI ausentes)" }, { status: 500 });
  }

  const match = inviteLink.match(/chat\.whatsapp\.com\/([A-Za-z0-9_-]+)/);
  if (!match) {
    return NextResponse.json({ error: "Link de convite inválido. Use o formato https://chat.whatsapp.com/..." }, { status: 400 });
  }
  const inviteCode = match[1];

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    apikey: token,
    Authorization: token,
  };

  // Try multiple endpoint formats — Uazapi versions vary
  const attempts = [
    () => fetch(`${url}/group/inviteInfo/${instance}?inviteCode=${inviteCode}`, { headers }),
    () => fetch(`${url}/group/getInviteInfo/${instance}?inviteCode=${inviteCode}`, { headers }),
    () =>
      fetch(`${url}/group/inviteInfo/${instance}`, {
        method: "POST",
        headers,
        body: JSON.stringify({ inviteCode }),
      }),
    () => fetch(`${url}/v1/groups/info?instance=${instance}&groupId=${inviteCode}`, { headers }),
    () => fetch(`${url}/group/fetchAllGroups/${instance}?getParticipants=false`, { headers }),
  ];

  for (const attempt of attempts) {
    try {
      const res = await attempt();
      if (!res.ok) continue;
      const data = await res.json();

      const id =
        data?.id ||
        data?.groupId ||
        data?.jid ||
        data?.group?.id ||
        data?.group?.jid ||
        data?.data?.id ||
        data?.data?.groupId;

      if (id && id.includes("@g.us")) {
        return NextResponse.json({ groupId: id });
      }

      // fetchAllGroups returns array — return list so admin can pick
      if (Array.isArray(data) && data.length > 0) {
        return NextResponse.json({
          groups: data.map((g: { id?: string; subject?: string }) => ({ id: g.id, name: g.subject })),
        });
      }
    } catch {
      continue;
    }
  }

  return NextResponse.json(
    {
      error:
        "Não foi possível resolver o link via API. Verifique as credenciais UAZAPI ou cole o JID manualmente (ex: 120363XXXXXXXXXX@g.us).",
    },
    { status: 422 }
  );
}
