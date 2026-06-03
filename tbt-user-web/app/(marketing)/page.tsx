import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowRight, BookOpen, Calendar, Users, Zap } from "lucide-react";

const features = [
  { icon: BookOpen, title: "Expert-led Courses", desc: "Learn from Tamil business leaders with proven track records." },
  { icon: Calendar, title: "Live Events", desc: "Attend workshops, meetups, and networking sessions." },
  { icon: Users, title: "Peer Community", desc: "Connect with 1000+ Tamil entrepreneurs nationwide." },
  { icon: Zap, title: "90-Day Programs", desc: "Structured programs designed to accelerate your growth." },
];

export default function LandingPage() {
  redirect("/loading");
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-background via-background to-brand-50/30 dark:to-brand-900/10">
        <div className="max-w-6xl mx-auto px-4 py-24 text-center">
          <p className="text-sm font-semibold text-brand-600 uppercase tracking-widest mb-4">
            Tamil Business Tribe
          </p>
          <h1 className="text-4xl md:text-6xl font-black tracking-tighter leading-tight max-w-3xl mx-auto">
            Learn. Grow.{" "}
            <span className="text-brand-600">Scale Your Business.</span>
          </h1>
          <p className="mt-6 text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed">
            The premier learning and community platform for Tamil entrepreneurs. Access expert courses, live sessions, and a supportive peer network.
          </p>
          <div className="mt-8 flex items-center justify-center gap-4 flex-wrap">
            <Link
              href="/sign-up"
              className="bg-brand-600 text-white px-8 py-4 rounded-xl text-base font-bold hover:bg-brand-700 transition-colors flex items-center gap-2 shadow-lg shadow-brand-600/20"
            >
              Get Started Free <ArrowRight size={18} />
            </Link>
            <Link
              href="/sign-in"
              className="px-8 py-4 rounded-xl text-base font-semibold border border-border hover:bg-muted transition-colors"
            >
              Sign In
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-4 py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-black tracking-tight">Everything you need to succeed</h2>
          <p className="text-muted-foreground mt-3 max-w-md mx-auto">
            One platform for learning, networking, and growing your business.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="rounded-xl border border-border bg-card p-6 text-center">
              <div className="w-12 h-12 rounded-xl bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center mx-auto mb-4">
                <Icon size={22} className="text-brand-600" />
              </div>
              <h3 className="font-semibold text-sm">{title}</h3>
              <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="bg-brand-600 text-white py-20">
        <div className="max-w-2xl mx-auto px-4 text-center">
          <h2 className="text-3xl font-black tracking-tight">Ready to scale your business?</h2>
          <p className="mt-4 text-white/80">
            Join thousands of Tamil entrepreneurs already on the platform.
          </p>
          <Link
            href="/sign-up"
            className="mt-8 inline-flex items-center gap-2 bg-white text-brand-600 px-8 py-4 rounded-xl font-bold hover:bg-brand-50 transition-colors"
          >
            Create Free Account <ArrowRight size={18} />
          </Link>
        </div>
      </section>
    </>
  );
}
