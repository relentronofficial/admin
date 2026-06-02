// ─── API Response Wrapper ─────────────────────────────────────────────────────

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error: { code: string; message: string } | null;
  meta?: PaginationMeta;
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
}

// ─── User / Member ────────────────────────────────────────────────────────────

export type MemberStatus = "active" | "inactive" | "paused" | "suspended";
export type VerificationStatus = "awaiting_kyc" | "under_review" | "verified" | "rejected";
export type MembershipPlan = "free" | "starter" | "premium" | "vip" | "enterprise";

export interface Member {
  id: string;
  memberId: string;
  firstName: string;
  lastName?: string | null;
  email: string;
  phone: string;
  profilePhotoUrl?: string | null;
  city?: string | null;
  state?: string | null;
  businessName?: string | null;
  membershipPlan: MembershipPlan;
  status: MemberStatus;
  verificationStatus: VerificationStatus;
  totalPoints: number;
  currentStreak: number;
  healthScore: number;
  onboardingCompleted: boolean;
  createdAt: string;
  accountManager?: {
    id: string;
    fullName: string;
    email: string;
    designation?: string | null;
    profilePhotoUrl?: string | null;
  } | null;
}

// ─── Course / Learning ────────────────────────────────────────────────────────

export type CourseLevel = "beginner" | "intermediate" | "advanced";

export interface Course {
  id: string;
  title: string;
  slug: string;
  description?: string | null;
  thumbnailUrl?: string | null;
  level: CourseLevel;
  durationHours?: number | null;
  isPublished: boolean;
  isFeatured: boolean;
  createdAt: string;
  instructor?: {
    id: string;
    fullName: string;
    profilePhotoUrl?: string | null;
    designation?: string | null;
  } | null;
  _count?: {
    lessons: number;
    enrollments: number;
  };
}

export interface Lesson {
  id: string;
  title: string;
  description?: string | null;
  videoUrl?: string | null;
  duration?: number | null;
  order: number;
  isFree: boolean;
}

export interface CourseEnrollment {
  id: string;
  courseId: string;
  memberId: string;
  enrolledAt: string;
  completedAt?: string | null;
  progressPercent: number;
  course: Course;
}

export interface LessonProgress {
  lessonId: string;
  completed: boolean;
  watchedSeconds?: number;
  completedAt?: string | null;
}

// ─── Event ────────────────────────────────────────────────────────────────────

export interface Event {
  id: string;
  title: string;
  description?: string | null;
  thumbnailUrl?: string | null;
  eventDate: string;
  location?: string | null;
  isOnline: boolean;
  registrationUrl?: string | null;
  maxAttendees?: number | null;
  status: string;
  createdAt: string;
}

// ─── Webinar ──────────────────────────────────────────────────────────────────

export interface Webinar {
  id: string;
  title: string;
  description?: string | null;
  thumbnailUrl?: string | null;
  scheduledAt: string;
  durationMinutes?: number | null;
  status: string;
  streamUrl?: string | null;
  recordingUrl?: string | null;
  host?: {
    id: string;
    fullName: string;
    profilePhotoUrl?: string | null;
    designation?: string | null;
  } | null;
}

// ─── Notification ─────────────────────────────────────────────────────────────

export interface Notification {
  id: string;
  title: string;
  body: string;
  type: string;
  isRead: boolean;
  createdAt: string;
  data?: Record<string, unknown>;
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export interface DashboardStats {
  totalCourses: number;
  completedCourses: number;
  inProgressCourses: number;
  totalPoints: number;
  currentStreak: number;
  upcomingEvents: number;
  unreadNotifications: number;
}

export interface ContinueLearningItem {
  courseId: string;
  title: string;
  thumbnailUrl?: string | null;
  progressPercent: number;
  lastLessonId?: string | null;
  lastLessonTitle?: string | null;
}
