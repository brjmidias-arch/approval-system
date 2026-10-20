import { NextRequest } from "next/server";
import { redirectShort } from "@/lib/shortLinkRedirect";

export const dynamic = "force-dynamic";

export function GET(req: NextRequest, { params }: { params: { code: string } }) {
  return redirectShort(req, "c", params.code);
}
