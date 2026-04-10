export const dynamic = "force-dynamic";

import AdminNav from "@/components/admin/AdminNav";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#0f0f0f]">
      <AdminNav />
      <main className="max-w-7xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
