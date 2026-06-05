import { createClerkClient } from '@clerk/clerk-sdk-node';
import dotenv from 'dotenv';

dotenv.config();

const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

async function debugUser() {
  const username = 'sakthi';
  
  try {
    console.log(`🔍 Searching for user "${username}"...`);
    const response = await clerk.users.getUserList({ username: [username] });
    
    // Handle both array and paginated object responses
    const users = Array.isArray(response) ? response : (response as any).data;
    
    if (!users || users.length === 0) {
      console.log('❌ User not found in Clerk.');
      return;
    }

    const user = users[0];
    console.log('✅ User found:');
    console.log(JSON.stringify({
      id: user.id,
      username: user.username,
      emailAddresses: user.emailAddresses.map((e: any) => ({ 
        id: e.id,
        email: e.emailAddress, 
        verified: e.verification?.status 
      })),
      passwordEnabled: user.passwordEnabled,
    }, null, 2));

    // Try to force verify the email if it's not verified
    for (const email of user.emailAddresses) {
      if (email.verification?.status !== 'verified') {
        console.log(`🔧 Attempting to verify email: ${email.emailAddress}`);
        // This is the standard way to mark as verified in the Backend API
        await clerk.emailAddresses.updateEmailAddress(email.id, {
          verified: true,
          primary: true
        });
        console.log('✅ Email marked as verified.');
      }
    }

  } catch (error: any) {
    console.error('❌ Diagnostic failed:', error.message);
  }
}

debugUser();
