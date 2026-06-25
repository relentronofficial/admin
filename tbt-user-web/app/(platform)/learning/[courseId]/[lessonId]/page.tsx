import { redirect } from "next/navigation";

export default async function LessonPage({
  params,
}: {
  params: Promise<{ courseId: string; lessonId: string }>;
}) {
  const { courseId, lessonId } = await params;
  redirect(`/learning/${courseId}?lesson=${lessonId}`);
}
