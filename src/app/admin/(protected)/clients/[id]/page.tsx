"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

interface Campaign {
  id: string;
  name: string;
  month: number;
  year: number;
  token: string;
  expiresAt: string;
  status: string;
  createdAt: string;
  approvalItems: { status: string }[];
  contentItems: { id: string }[];
}

interface Client {
  id: string;
  name: string;
  email: string;
  whatsapp: string | null;
  campaigns: Campaign[];
}

const MONTHS = [
  "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"
];

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCampaignForm, setShowCampaignForm] = useState(false);
  const [campaignForm, setCampaignForm] = useState({
    name: "",
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    expiresAt: "",
  });
  const [saving, setSaving] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  const fetchClient = useCallback(async () => {
    const res = await fetch(`/api/admin/clients/${id}`);
    const data = await res.json();
    setClient(data);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    fetchClient();
  }, [fetchClient]);

  async function handleCreateCampaign(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    const expires = campaignForm.expiresAt
      ? campaignForm.expiresAt
      : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    await fetch("/api/admin/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...campaignForm, clientId: id, expiresAt: expires }),
    });

    setSaving(false);
    setShowCampaignForm(false);
    setCampaignForm({ name: "", month: new Date().getMonth() + 1, year: new Date().getFullYear(), expiresAt: "" });
    fetchClient();
  }

  async function handleResend(campaignId: string) {
    await fetch(`/api/admin/campaigns/${campaignId}/resend`, { method: "POST" });
    alert("E-mail reenviado!");
  }

  async function handleToggleStatus(campaign: Campaign) {
    const newStatus = campaign.status === "OPEN" ? "CLOSED" : "OPEN";
    await fetch(`/api/admin/campaigns/${campaign.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    fetchClient();
  }

  function copyLink(token: string) {
    const url = `${window.location.origin}/aprovar/${token}`;
    navigator.clipboard.writeText(url);
    setCopyFeedback(token);
    setTimeout(() => setCopyFeedback(null), 2000);
  }

  if (loading) return <div className="text-gray-400 p-8">Carregando...</div>;
  if (!client) return <div className="text-red-400 p-8">Cliente não encontrado.</div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-400 mb-1">
            <Link href="/admin/clients" className="hover:text-white transition-colors">
              Clientes
            </Link>
            <span>/</span>
            <span className="text-white">{client.name}</span>
          </div>
          <h1 className="text-xl font-semibold text-white">{client.name}</h1>
          <div className="flex items-center gap-4 mt-1 text-sm text-gray-400">
            <span>{client.email}</span>
            {client.whatsapp && <span>{client.whatsapp}</span>}
          </div>
        </div>
        <button
          onClick={() => setShowCampaignForm(true)}
          className="bg-emerald-600 hover:bg-emerald-500 text-white text-sm px-4 py-2 rounded-lg transition-colors"
        >
          + Nova Campanha
        </button>
      </div>

      {/* Campaign Form Modal */}
      {showCampaignForm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1a1a] border border-white/10 rounded-xl p-6 w-full max-w-md">
            <h2 className="text-white font-medium mb-4">Nova Campanha</h2>
            <form onSubmit={handleCreateCampaign} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">Nome da campanha</label>
                <input
                  type="text"
                  value={campaignForm.name}
                  onChange={(e) => setCampaignForm({ ...campaignForm, name: e.target.value })}
                  required
                  placeholder="Ex: Abril 2025"
                  className="w-full bg-[#0f0f0f] border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-gray-400 mb-1.5">Mês</label>
                  <select
                    value={campaignForm.month}
                    onChange={(e) => setCampaignForm({ ...campaignForm, month: Number(e.target.value) })}
                    className="w-full bg-[#0f0f0f] border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500"
                  >
                    {MONTHS.map((m, i) => (
                      <option key={i} value={i + 1}>{m}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1.5">Ano</label>
                  <input
                    type="number"
                    value={campaignForm.year}
                    onChange={(e) => setCampaignForm({ ...campaignForm, year: Number(e.target.value) })}
                    min={2024}
                    max={2030}
                    className="w-full bg-[#0f0f0f] border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">
                  Prazo de aprovação <span className="text-gray-600">(padrão: 7 dias)</span>
                </label>
                <input
                  type="datetime-local"
                  value={campaignForm.expiresAt}
                  onChange={(e) => setCampaignForm({ ...campaignForm, expiresAt: e.target.value })}
                  className="w-full bg-[#0f0f0f] border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setShowCampaignForm(false)}
                  className="flex-1 bg-white/5 hover:bg-white/10 text-gray-300 py-2.5 rounded-lg text-sm transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white py-2.5 rounded-lg text-sm transition-colors font-medium"
                >
                  {saving ? "Criando..." : "Criar Campanha"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Campaigns */}
      <div className="bg-[#1a1a1a] border border-white/10 rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-white/10">
          <h2 className="text-white font-medium text-sm">Campanhas ({client.campaigns.length})</h2>
        </div>

        {client.campaigns.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">
            Nenhuma campanha criada ainda.
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {client.campaigns.map((campaign) => {
              const total = campaign.contentItems.length;
              const approved = campaign.approvalItems.filter((a) => a.status === "APPROVED").length;
              const adjustment = campaign.approvalItems.filter((a) => a.status === "ADJUSTMENT").length;
              const rejected = campaign.approvalItems.filter((a) => a.status === "REJECTED").length;
              const pending = total - approved - adjustment - rejected;
              const isExpired = new Date() > new Date(campaign.expiresAt) && campaign.status === "OPEN";
              const progress = total > 0 ? Math.round(((total - pending) / total) * 100) : 0;

              return (
                <div key={campaign.id} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/admin/campaigns/${campaign.id}`}
                          className="text-white font-medium text-sm hover:text-emerald-400 transition-colors"
                        >
                          {campaign.name}
                        </Link>
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            campaign.status === "CLOSED"
                              ? "bg-gray-800 text-gray-400"
                              : isExpired
                              ? "bg-red-900/30 text-red-400"
                              : "bg-emerald-900/30 text-emerald-400"
                          }`}
                        >
                          {campaign.status === "CLOSED" ? "Fechado" : isExpired ? "Expirado" : "Aberto"}
                        </span>
                      </div>
                      <p className="text-gray-500 text-xs mt-0.5">
                        {MONTHS[campaign.month - 1]} {campaign.year} · Expira{" "}
                        {new Date(campaign.expiresAt).toLocaleDateString("pt-BR")}
                      </p>

                      {total > 0 && (
                        <div className="mt-2">
                          <div className="flex items-center gap-3 text-xs mb-1">
                            <span className="text-gray-500">{total - pending}/{total} revisados</span>
                            {approved > 0 && <span className="text-emerald-400">✅ {approved}</span>}
                            {adjustment > 0 && <span className="text-amber-400">✏️ {adjustment}</span>}
                            {rejected > 0 && <span className="text-red-400">❌ {rejected}</span>}
                          </div>
                          <div className="w-full bg-white/5 rounded-full h-1.5">
                            <div
                              className="bg-emerald-500 h-1.5 rounded-full transition-all"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => copyLink(campaign.token)}
                        className="text-xs px-2.5 py-1.5 bg-white/5 hover:bg-white/10 text-gray-300 rounded-lg transition-colors"
                      >
                        {copyFeedback === campaign.token ? "Copiado!" : "Copiar Link"}
                      </button>
                      <button
                        onClick={() => handleResend(campaign.id)}
                        className="text-xs px-2.5 py-1.5 bg-white/5 hover:bg-white/10 text-gray-300 rounded-lg transition-colors"
                      >
                        Reenviar E-mail
                      </button>
                      <button
                        onClick={() => handleToggleStatus(campaign)}
                        className={`text-xs px-2.5 py-1.5 rounded-lg transition-colors ${
                          campaign.status === "OPEN"
                            ? "bg-red-900/20 hover:bg-red-900/30 text-red-400"
                            : "bg-emerald-900/20 hover:bg-emerald-900/30 text-emerald-400"
                        }`}
                      >
                        {campaign.status === "OPEN" ? "Fechar" : "Reabrir"}
                      </button>
                      <Link
                        href={`/admin/campaigns/${campaign.id}`}
                        className="text-xs px-2.5 py-1.5 bg-emerald-900/20 hover:bg-emerald-900/30 text-emerald-400 rounded-lg transition-colors"
                      >
                        Gerenciar →
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
