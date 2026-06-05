import { createClerkClient } from '@clerk/clerk-sdk-node';
import dotenv from 'dotenv';

dotenv.config();

const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

async function verifyState() {
  const email = 'manojdatascientist08@gmail.com';
  const username = 'manoj_admin';
  
  try {
    console.log(`🔍 Checking Clerk for email: ${email}`);
    const responseEmail = await clerk.users.getUserList({ emailAddress: [email] });
    const emailUsers = Array.isArray(responseEmail) ? responseEmail : (responseEmail as any).data;
    console.log(`Found ${emailUsers?.length} users by email.`);
    
    console.log(`🔍 Checking Clerk for username: ${username}`);
    const responseUser = await clerk.users.getUserList({ username: [username] });
    const userUsers = Array.isArray(responseUser) ? responseUser : (responseUser as any).data;
    console.log(`Found ${userUsers?.length} users by username.`);

    if (emailUsers && emailUsers.length > 0) {
      const user = emailUsers[0];
      console.log('✅ User Details:', JSON.stringify({
        id: user.id,
        username: user.username,
        emailAddresses: user.emailAddresses.map((e: any) => ({ email: e.emailAddress, verified: e.verification?.status })),
      }, null, 2));
    }

  } catch (error: any) {
    console.error('❌ Verification failed:', error.message);
  }
}

verifyState();
