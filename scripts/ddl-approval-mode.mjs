import "dotenv/config";
import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
// AUTO = aprovado na revisão interna vai direto p/ o cliente; WEEKLY = espera o envio da semana.
await p.$executeRawUnsafe(`ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "approvalMode" TEXT NOT NULL DEFAULT 'AUTO'`);
console.log("ok: approvalMode");
await p.$disconnect();
