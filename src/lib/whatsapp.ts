function resolveRecipient(to: string): string {
  // Group JIDs (e.g. "120363XXXXXXXXXX@g.us") are passed as-is
  if (to.includes("@")) return to;
  // Phone numbers: normalize to Brazilian international format
  const digits = to.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("55") && digits.length >= 12) return digits;
  if (digits.length === 11 || digits.length === 10) return "55" + digits;
  return digits;
}

export async function sendWhatsApp(to: string, text: string): Promise<void> {
  const url = process.env.UAZAPI_URL;
  const token = process.env.UAZAPI_TOKEN;
  const instance = process.env.UAZAPI_INSTANCE;

  if (!url || !token || !instance) {
    throw new Error("WhatsApp não configurado (UAZAPI_URL, UAZAPI_TOKEN ou UAZAPI_INSTANCE ausentes)");
  }

  const number = resolveRecipient(to);
  if (!number) throw new Error("Destinatário WhatsApp inválido: " + to);

  const res = await fetch(`${url}/message/sendText/${instance}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: token,
    },
    body: JSON.stringify({ number, text }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Uazapi error ${res.status}: ${body}`);
  }
}
