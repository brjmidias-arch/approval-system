"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import PlannerCalendar from "@/components/admin/PlannerCalendar";

interface Client {
  id: string;
  name: string;
  email: string;
  whatsapp: string | null;
  createdAt: string;
  campaigns: { id: string; name: string; status: string }[];
}

interface PlannerPost {
  id: string;
  title: string | null;
  contentType: string;
  fileUrl: string;
  fileType: string;
  coverUrl: string | null;
  caption: string | null;
  scheduledDate: string | null;
  clientName: string;
  campaignName: string;
  campaignId: string;
}

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [form, setForm] = useState({ name: "", email: "", whatsapp: "" });
  const [saving, setSaving] = useState(false);

  // Planner state
  const [plannerClient, setPlannerClient] = useState<Client | null>(null);
  const [plannerPosts, setPlannerPosts] = useState<PlannerPost[]>([]);
  const [plannerLoading, setPlannerLoading] = useState(false);

  const fetchClients = useCallback(async () => {
    const res = await fetch("/api/admin/clients");
    const data = await res.json();
    setClients(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setPlannerClient(null);
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  async function openPlanner(client: Client) {
    setPlannerClient(client);
    setPlannerLoading(true);
    setPlannerPosts([]);
    const res = await fetch(`/api/admin/clients/${client.id}/planner-posts`);
    const data = await res.json();
    setPlannerPosts(data);
    setPlannerLoading(false);
  }

  function handleDateChange(postId: string, dateKey: string | null) {
    setPlannerPosts((prev) =>
      prev.map((p) => {
        if (p.id !== postId) return p;
        if (!dateKey) return { ...p, scheduledDate: null };
        return { ...p, scheduledDate: `${dateKey}T12:00:00.000Z` };
      })
    );
  }

  function openNew() {
    setEditingClient(null);
    setForm({ name: "", email: "", whatsapp: "" });
    setShowForm(true);
  }

  function openEdit(client: Client) {
    setEditingClient(client);
    setForm({ name: client.name, email: client.email, whatsapp: client.whatsapp || "" });
    setShowForm(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    if (editingClient) {
      await fetch(`/api/admin/clients/${editingClient.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
    } else {
      await fetch("/api/admin/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
    }
    setSaving(false);
    setShowForm(false);
    fetchClients();
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Deletar cliente "${name}" e todas as campanhas? Esta ação não pode ser desfeita.`)) return;
    await fetch(`/api/admin/clients/${id}`, { method: "DELETE" });
    fetchClients();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-white">Clientes</h1>
        <button
          onClick={openNew}
          className="bg-emerald-600 hover:bg-emerald-500 text-white text-sm px-4 py-2 rounded-lg transition-colors"
        >
          + Novo Cliente
        </button>
      </div>

      {/* Planner Modal */}
      {plannerClient && (
        <div className="fixed inset-0 z-50 bg-black/85 flex flex-col">
          <div className="flex items-center justify-between px-6 py-3 bg-[#111] border-b border-white/10 shrink-0">
            <div>
              <h2 className="text-white font-semibold">Planner — {plannerClient.name}</h2>
              <p className="text-gray-500 text-xs mt-0.5">
                Posts aprovados · mês atual em diante · arraste para definir ou mover datas
              </p>
            </div>
            <button
              onClick={() => setPlannerClient(null)}
              className="text-gray-400 hover:text-white text-2xl leading-none transition-colors"
            >
              ×
            </button>
          </div>
          <div className="flex-1 overflow-hidden p-4">
            {plannerLoading ? (
              <div className="flex items-center justify-center h-full text-gray-400">
                Carregando posts...
              </div>
            ) : plannerPosts.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <p className="text-2xl mb-3">📅</p>
                  <p className="text-gray-400">Nenhum post aprovado para agendar.</p>
                  <p className="text-gray-600 text-sm mt-1">Posts aparecem aqui quando o cliente aprovar.</p>
                </div>
              </div>
            ) : (
              <PlannerCalendar
                initialPosts={plannerPosts}
                clientId={plannerClient.id}
                onDateChange={handleDateChange}
              />
            )}
          </div>
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1a1a] border border-white/10 rounded-xl p-6 w-full max-w-md">
            <h2 className="text-white font-medium mb-4">
              {editingClient ? "Editar Cliente" : "Novo Cliente"}
            </h2>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">Nome</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                  className="w-full bg-[#0f0f0f] border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">
                  E-mail <span className="text-gray-600">(opcional)</span>
                </label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full bg-[#0f0f0f] border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500"
                  placeholder="email@cliente.com.br"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">
                  WhatsApp <span className="text-gray-600">(opcional)</span>
                </label>
                <input
                  type="text"
                  value={form.whatsapp}
                  onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
                  placeholder="(11) 99999-9999"
                  className="w-full bg-[#0f0f0f] border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 bg-white/5 hover:bg-white/10 text-gray-300 py-2.5 rounded-lg text-sm transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white py-2.5 rounded-lg text-sm transition-colors font-medium"
                >
                  {saving ? "Salvando..." : "Salvar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-[#1a1a1a] border border-white/10 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400">Carregando...</div>
        ) : clients.length === 0 ? (
          <div className="p-8 text-center text-gray-400">Nenhum cliente cadastrado.</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10 text-xs text-gray-400 uppercase tracking-wider">
                <th className="text-left px-5 py-3">Cliente</th>
                <th className="text-left px-5 py-3">E-mail</th>
                <th className="text-left px-5 py-3">WhatsApp</th>
                <th className="text-left px-5 py-3">Campanhas</th>
                <th className="text-right px-5 py-3">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {clients.map((client) => (
                <tr key={client.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-5 py-3.5">
                    <Link
                      href={`/admin/clients/${client.id}`}
                      className="text-white hover:text-emerald-400 font-medium text-sm transition-colors"
                    >
                      {client.name}
                    </Link>
                  </td>
                  <td className="px-5 py-3.5 text-sm text-gray-400">{client.email || "—"}</td>
                  <td className="px-5 py-3.5 text-sm text-gray-400">{client.whatsapp || "—"}</td>
                  <td className="px-5 py-3.5 text-sm text-gray-400">{client.campaigns.length}</td>
                  <td className="px-5 py-3.5 text-right">
                    <div className="flex items-center gap-3 justify-end">
                      <button
                        onClick={() => openPlanner(client)}
                        className="text-violet-400 hover:text-violet-300 text-sm transition-colors font-medium"
                      >
                        📅 Planner
                      </button>
                      <Link
                        href={`/admin/clients/${client.id}`}
                        className="text-gray-400 hover:text-white text-sm transition-colors"
                      >
                        Ver
                      </Link>
                      <button
                        onClick={() => openEdit(client)}
                        className="text-gray-400 hover:text-white text-sm transition-colors"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => handleDelete(client.id, client.name)}
                        className="text-red-500 hover:text-red-400 text-sm transition-colors"
                      >
                        Deletar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
