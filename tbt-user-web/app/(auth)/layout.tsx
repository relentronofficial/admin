export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Branding panel */}
      <div className="hidden lg:flex flex-col justify-between bg-brand-600 p-12 text-white">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center font-black text-xl">
            T
          </div>
          <span className="text-xl font-bold tracking-tight">Tamil Business Tribe</span>
        </div>

        <blockquote className="space-y-3">
          <p className="text-2xl font-semibold leading-relaxed">
            &ldquo;The platform that helped me scale from 0 to 1 Cr in 18 months.&rdquo;
          </p>
          <footer className="text-white/70 text-sm">
            — Karthik S., TBT Premium Member
          </footer>
        </blockquote>

        <p className="text-white/50 text-sm">
          &copy; {new Date().getFullYear()} Tamil Business Tribe. All rights reserved.
        </p>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center p-8">
        {children}
      </div>
    </div>
  );
}
