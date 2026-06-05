
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    console.log('Attempting to connect to the database...');
    await prisma.$connect();
    console.log('Successfully connected to the database!');
    
    const adminCount = await prisma.admin.count();
    console.log(`Number of admins in the database: ${adminCount}`);
  } catch (error) {
    console.error('Failed to connect to the database:');
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
