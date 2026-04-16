export const dynamic = "force-dynamic";

import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-4">
      <div className="text-center">
        <p className="text-5xl mb-4">🔍</p>
        <h1 className="text-xl font-semibold text-white mb-2">Página não encontrada</h1>
        <Link href="/admin" className="text-emerald-400 hover:text-emerald-300 text-sm">
          Voltar ao início →
        </Link>
      </div>
    </div>
  );
}
