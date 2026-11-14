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
  permissions: z.union([z.record(z.any()), z.array(z.any())]).optional(),
  // Security Matrix rows sent by the admin panel create/edit forms
  // ([{ module, canView, canCreate, canEdit, canDelete }]); stored into `permissions`.
  rbac: z.array(z.object({
    module: z.string(),
    canView: z.boolean().optional(),
    canCreate: z.boolean().optional(),
    canEdit: z.boolean().optional(),
    canDelete: z.boolean().optional(),
  })).optional(),
  password: z.string().min(8).optional(), // Used for Clerk user creation if needed
});

export const updateAdminSchema = createAdminSchema.partial().extend({
  role: z.enum(['super_admin', 'admin', 'account_manager', 'mentor', 'moderator']).optional().or(z.literal('')),
  status: z.enum(['active', 'inactive', 'suspended', 'pending_approval']).optional().or(z.literal('')),
  password: z.string().optional().or(z.literal('')),
});

export const updateStatusSchema = z.object({
  status: z.enum(['active', 'inactive', 'suspended', 'pending_approval']),
});

export const updateRBACSchema = z.record(z.any());
