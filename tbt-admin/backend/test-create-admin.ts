
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function test() {
  try {
    console.log('Testing manual admin creation...');
    const admin = await prisma.admin.create({
      data: {
        adminId: 'TBT-ADMIN-TEST-' + Date.now(),
        fullName: 'Test Admin',
        email: 'test' + Date.now() + '@example.com',
        contactNumber: '1234567890',
        role: 'SuperAdmin',
        department: 'IT',
        country: 'India',
        state: 'Tamil Nadu',
        district: 'Chennai',
        city: 'Chennai',
        address: 'Test Address with more than 10 characters',
        username: 'testuser' + Date.now(),
        accountStatus: 'Active',
        twoFactorEnabled: false,
        createdBy: 'System'
      }
    });
    console.log('✅ Admin Created successfully with ID:', admin.id);
    
    // Cleanup
    await prisma.admin.delete({ where: { id: admin.id } });
    console.log('✅ Cleanup successful');
  } catch (error: any) {
    console.error('❌ Creation Failed:');
    if (error.code) console.error('Error Code:', error.code);
    console.error(error.message);
  } finally {
    await prisma.$disconnect();
  }
}

test();
