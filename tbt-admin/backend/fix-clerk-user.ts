import { createClerkClient } from '@clerk/clerk-sdk-node';
import dotenv from 'dotenv';

dotenv.config();

const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

async function fixUser() {
  const email = 'manojdatascientist08@gmail.com';
  
  try {
    console.log(`🔍 Inspecting user: ${email}`);
    const response = await clerk.users.getUserList({ emailAddress: [email] });
    const users = Array.isArray(response) ? response : (response as any).data;
    
    if (!users || users.length === 0) {
      console.log('❌ User not found.');
      return;
    }

    const user = users[0];
    console.log('✅ Current User State:', JSON.stringify({
      id: user.id,
      username: user.username,
      email: user.emailAddresses[0].emailAddress,
      verified: user.emailAddresses[0].verification?.status
    }, null, 2));

    // ACTION: If username is causing 422, we try to clear it and use email only
    // Or we force update the email to ensure it's primary and verified
    console.log('🔧 Synchronizing email verification and primary status...');
    await clerk.emailAddresses.updateEmailAddress(user.emailAddresses[0].id, {
      verified: true,
      primary: true
    });

    // ACTION: Reset password to be absolutely sure
    console.log('🔧 Resetting password to: Manoj!@#8520');
    await clerk.users.updateUser(user.id, {
      password: 'Manoj!@#8520',
      skipPasswordChecks: true
    });

    console.log('🚀 User record cleaned and password reset. Please try Email login again.');

  } catch (error: any) {
    console.error('❌ Fix failed:', error.message);
  }
}

fixUser();
