import { z } from 'zod';

export const createCourseSchema = z.object({
  title: z.string(),
  description: z.string(),
  category: z.string(),
  curriculum: z.any(),
  totalDuration: z.number(),
  totalLessons: z.number(),
  instructor: z.string(),
});

export const updateCourseSchema = createCourseSchema.partial();
