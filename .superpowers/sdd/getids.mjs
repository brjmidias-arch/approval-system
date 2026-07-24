import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const carousel = await p.contentItem.findFirst({ where: { contentType: "CARROSSEL", groupId: { not: null } }, select: { id: true, groupId: true, title: true }, orderBy: { order: "asc" } });
const single = await p.contentItem.findFirst({ where: { contentType: { not: "CARROSSEL" } }, select: { id: true, contentType: true, fileType: true, title: true } });
const withClientComment = await p.contentItem.findFirst({ where: { approvalItem: { clientComment: { not: null } } }, select: { id: true, contentType: true, groupId: true } });
console.log(JSON.stringify({ carousel, single, withClientComment }, null, 2));
await p.$disconnect();
