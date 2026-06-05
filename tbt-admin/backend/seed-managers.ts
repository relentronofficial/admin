import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const managers = ['Ajith', 'Guru', 'Priya', 'Ravi'];
  
  for (const name of managers) {
    const exists = await prisma.manager.findFirst({ where: { name } });
    if (!exists) {
      await prisma.manager.create({ data: { name } });
      console.log(`Created manager: ${name}`);
    } else {
      console.log(`Manager already exists: ${name}`);
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
