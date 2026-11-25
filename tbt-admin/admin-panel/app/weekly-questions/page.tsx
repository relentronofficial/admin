import { redirect } from "next/navigation";

// The questions now live inside Weekly Course Reports.
export default function WeeklyQuestionsPage() {
  redirect("/course-weekly-reports?tab=questions");
}
