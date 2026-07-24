import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const c = await p.campaign.findFirst({ where: { token: { not: undefined } }, select: { token: true } });
console.log(c?.token ?? "none");
await p.$disconnect();
