import { z } from 'zod';

export const createAdminSchema = z.object({
  fullName: z.string().min(2).max(100),
  email: z.string().email(),
  phone: z.string().optional(),
  alternatePhone: z.string().optional(),
  dob: z.string().optional(),
  bloodGroup: z.string().optional(),
  profilePhotoUrl: z.string().optional(),
  role: z.enum(['super_admin', 'admin', 'account_manager', 'mentor', 'moderator']),
  department: z.string().optional(),
  designation: z.string().optional(),
  reportingManagerId: z.string().optional(),
  employeeId: z.string().optional(),
  country: z.string().optional(),
  state: z.string().optional(),
  city: z.string().optional(),
  address: z.string().optional(),
  username: z.string().min(4).max(30),
  status: z.enum(['active', 'inactive', 'suspended', 'pending_approval']).default('active'),
  notes: z.string().optional(),
  tags: z.array(z.string()).optional(),
  permissions: z.record(z.any()).optional(),
  password: z.string().min(8).optional(), // Used for Clerk user creation if needed
});

export const updateAdminSchema = createAdminSchema.partial();

export const updateStatusSchema = z.object({
  status: z.enum(['active', 'inactive', 'suspended', 'pending_approval']),
});

export const updateRBACSchema = z.record(z.any());
