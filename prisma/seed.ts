import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const existing = await prisma.user.findUnique({
    where: { email: "admin@brjmidias.com.br" },
  });

  if (!existing) {
    const password = await bcrypt.hash("brjmidias2024", 12);
    await prisma.user.create({
      data: {
        email: "admin@brjmidias.com.br",
        password,
        name: "Admin BRJ Mídias",
      },
    });
    console.log("✅ Admin criado: admin@brjmidias.com.br / brjmidias2024");
  } else {
    console.log("Admin já existe, atualizando senha...");
    const password = await bcrypt.hash("brjmidias2024", 12);
    await prisma.user.update({
      where: { email: "admin@brjmidias.com.br" },
      data: { password },
    });
    console.log("✅ Senha atualizada.");
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
