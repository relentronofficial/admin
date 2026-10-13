import { ActivityHeartbeat } from "@/components/guards/ActivityHeartbeat";

export default function PlayerLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ActivityHeartbeat />
      {children}
    </>
  );
}
