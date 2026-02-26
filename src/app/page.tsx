import Link from "next/link";
import {
  ArrowRight,
  Clock,
  Users,
  Calendar,
  Bell,
  Shield,
  Zap,
  ChevronRight,
  Building2,
  User,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Navbar } from "@/components/navbar";

const features = [
  {
    icon: Calendar,
    title: "Visual Scheduling",
    description:
      "Drag-and-drop calendar for effortless shift management. See your whole week at a glance.",
  },
  {
    icon: Users,
    title: "Team Management",
    description:
      "Invite employees, assign roles, and manage your entire team from one place.",
  },
  {
    icon: Bell,
    title: "Instant Notifications",
    description:
      "Email alerts for new shifts, updates, and cancellations. Never miss a change.",
  },
  {
    icon: Clock,
    title: "Real-Time Updates",
    description:
      "Live schedule updates powered by real-time sync. Always in sync across all devices.",
  },
  {
    icon: Shield,
    title: "Role-Based Access",
    description:
      "Owners, managers, and employees each see exactly what they need. Secure by default.",
  },
  {
    icon: Zap,
    title: "Lightning Fast",
    description:
      "Built for speed — every interaction feels instant. No loading spinners, ever.",
  },
];

const steps = [
  {
    number: "01",
    title: "Register your company",
    description:
      "Create your workspace in seconds. Add your business name, set your timezone, and you're live.",
    icon: Building2,
  },
  {
    number: "02",
    title: "Invite your team",
    description:
      "Send magic links to your employees. They click, create a password, and they're in — no signup needed.",
    icon: Users,
  },
  {
    number: "03",
    title: "Build your schedule",
    description:
      "Drag and drop shifts onto the calendar. Your team is notified instantly via email.",
    icon: Calendar,
  },
];

const stats = [
  { value: "10K+", label: "Shifts Scheduled" },
  { value: "500+", label: "Teams Active" },
  { value: "99.9%", label: "Uptime" },
  { value: "< 1s", label: "Load Time" },
];

const benefits = [
  "Free for teams up to 10 members",
  "No credit card required",
  "Setup in under 2 minutes",
  "Cancel anytime",
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background overflow-hidden">
      {/* Subtle grid background */}
      <div className="fixed inset-0 -z-10">
        <div
          className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05]"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)`,
            backgroundSize: "40px 40px",
          }}
        />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-gradient-to-b from-foreground/[0.03] to-transparent rounded-full blur-3xl" />
      </div>

      {/* Nav */}
      <Navbar />

      {/* Hero */}
      <section className="relative px-6 lg:px-12 pt-20 sm:pt-28 pb-16 sm:pb-24 max-w-5xl mx-auto text-center">
        <div className="animate-fade-in delay-100 inline-flex items-center gap-2.5 rounded-full border border-border/80 bg-card/60 backdrop-blur-sm px-4 py-1.5 text-sm text-muted-foreground mb-8 transition-all duration-300 hover:border-foreground/20 cursor-default">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500/75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          Now in public beta
          <ChevronRight className="h-3 w-3" />
        </div>

        <h1 className="animate-fade-in delay-200 text-5xl sm:text-6xl lg:text-[5rem] font-bold tracking-tight leading-[1.05] mb-6">
          Stop juggling
          <br />
          <span className="text-muted-foreground">
            spreadsheets.
          </span>
        </h1>

        <p className="animate-fade-in delay-300 text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
          OhShift is the modern shift scheduling platform that your team will
          actually enjoy using. Create, assign, and track shifts — all in one
          beautiful interface.
        </p>

        <div className="animate-fade-in delay-400 flex flex-col sm:flex-row items-center justify-center gap-3 mb-8">
          <Link href="/company/register">
            <Button
              size="lg"
              className="btn-hover h-13 px-10 text-base rounded-full font-medium"
            >
              <Building2 className="mr-2 h-4.5 w-4.5" />
              Register your company
            </Button>
          </Link>
          <Link href="/login">
            <Button
              variant="outline"
              size="lg"
              className="btn-hover h-13 px-8 text-base rounded-full font-medium"
            >
              <User className="mr-2 h-4 w-4" />
              Employee sign in
            </Button>
          </Link>
        </div>

        <div className="animate-fade-in delay-500 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
          {benefits.map((b) => (
            <span key={b} className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-foreground/50" />
              {b}
            </span>
          ))}
        </div>
      </section>

      {/* Schedule preview mockup */}
      <section className="px-6 lg:px-12 pb-16 sm:pb-24">
        <div className="max-w-4xl mx-auto animate-fade-in delay-600">
          <div className="relative rounded-2xl border border-border/60 bg-card/40 backdrop-blur-sm p-1 shadow-2xl shadow-black/5 dark:shadow-black/20">
            <div className="rounded-xl bg-card overflow-hidden">
              {/* Title bar */}
              <div className="flex items-center gap-2 px-4 py-3 border-b border-border/40">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-foreground/10" />
                  <div className="w-3 h-3 rounded-full bg-foreground/10" />
                  <div className="w-3 h-3 rounded-full bg-foreground/10" />
                </div>
                <div className="flex-1 text-center">
                  <div className="inline-flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-md px-3 py-1">
                    <Calendar className="h-3 w-3" />
                    Weekly Schedule — Brew &amp; Co.
                  </div>
                </div>
              </div>
              {/* Mock schedule grid */}
              <div className="overflow-x-auto">
              <div className="grid grid-cols-7 gap-px bg-border/30 min-w-[640px]">
                {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(
                  (day) => (
                    <div
                      key={day}
                      className="text-center text-xs font-medium text-muted-foreground py-2.5 bg-card"
                    >
                      {day}
                    </div>
                  )
                )}
                {Array.from({ length: 7 }, (_, i) => (
                  <div
                    key={i}
                    className="bg-card p-2.5 min-h-[100px] space-y-1.5"
                  >
                    {i < 5 && (
                      <>
                        <div className={`text-[10px] font-medium px-2 py-1.5 rounded-md ${
                          i % 3 === 0
                            ? "bg-violet-500/10 text-violet-600 dark:text-violet-400"
                            : i % 3 === 1
                            ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                            : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        }`}>
                          {i % 2 === 0 ? "7am–3pm" : "2pm–10pm"}
                          <br />
                          <span className="opacity-70">
                            {["Casey R.", "Jordan L.", "Sam C.", "Taylor K.", "Avery P."][i]}
                          </span>
                        </div>
                        {i < 3 && (
                          <div className={`text-[10px] font-medium px-2 py-1.5 rounded-md ${
                            i % 2 === 0
                              ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                              : "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                          }`}>
                            {i % 2 === 0 ? "3pm–11pm" : "6am–2pm"}
                            <br />
                            <span className="opacity-70">
                              {["Taylor K.", "Avery P.", "Casey R."][i]}
                            </span>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ))}
              </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats strip */}
      <section className="border-y border-border/40 bg-card/20 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-6 lg:px-12 py-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-3xl sm:text-4xl font-bold tracking-tight mb-1.5">
                  {stat.value}
                </div>
                <div className="text-sm text-muted-foreground font-medium">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="px-6 lg:px-12 py-24 sm:py-32">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
              Everything you need,{" "}
              <span className="text-muted-foreground">
                nothing you don&apos;t.
              </span>
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              A complete toolkit for teams of any size. Ditch the spreadsheets,
              the group chats, and the chaos.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="group relative rounded-2xl border border-border/50 bg-card/30 p-7 transition-all duration-300 hover:border-foreground/10 hover:bg-card/80 hover:shadow-xl hover:shadow-black/[0.03] dark:hover:shadow-black/20 hover:-translate-y-1"
              >
                <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-accent mb-5 transition-transform duration-300 group-hover:scale-110">
                  <feature.icon className="h-5 w-5 text-foreground/70" />
                </div>
                <h3 className="font-semibold text-base mb-2">
                  {feature.title}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="px-6 lg:px-12 py-24 sm:py-32 border-t border-border/40">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
              Up and running in{" "}
              <span className="text-muted-foreground">minutes</span>
            </h2>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">
              Three simple steps to transform how your team handles scheduling.
            </p>
          </div>

          <div className="relative">
            {/* Connecting line */}
            <div className="hidden md:block absolute top-[3.25rem] left-[calc(16.67%+1.5rem)] right-[calc(16.67%+1.5rem)] h-px bg-border" />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-12 md:gap-8">
              {steps.map((step) => (
                <div key={step.number} className="text-center relative">
                  <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-6 bg-accent transition-transform duration-300 hover:scale-110">
                    <step.icon className="h-6 w-6 text-foreground/70" />
                  </div>
                  <div className="text-xs font-bold uppercase tracking-widest mb-3 text-muted-foreground">
                    Step {step.number}
                  </div>
                  <h3 className="font-semibold text-lg mb-2">{step.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed max-w-[280px] mx-auto">
                    {step.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Two-column auth CTA */}
      <section className="px-6 lg:px-12 py-24 sm:py-32 border-t border-border/40">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
              Ready to get started?
            </h2>
            <p className="text-muted-foreground text-lg">
              Choose how you want to use OhShift.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Company card */}
            <div className="group rounded-2xl border border-border/60 bg-card/40 p-8 transition-all duration-300 hover:border-foreground/10 hover:bg-card/80 hover:shadow-xl hover:shadow-black/[0.03] dark:hover:shadow-black/20">
              <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-accent mb-5">
                <Building2 className="h-6 w-6 text-foreground/70" />
              </div>
              <h3 className="text-xl font-semibold mb-2">I manage a team</h3>
              <p className="text-sm text-muted-foreground leading-relaxed mb-6">
                Register your company, invite employees, and start building
                schedules in minutes. Full control over your workspace.
              </p>
              <div className="flex flex-col gap-2">
                <Link href="/company/register">
                  <Button className="btn-hover w-full rounded-xl h-11 font-medium">
                    Register company
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
                <Link href="/company/login">
                  <Button
                    variant="ghost"
                    className="w-full rounded-xl h-11 text-muted-foreground transition-colors duration-300 hover:text-foreground"
                  >
                    Already registered? Sign in
                  </Button>
                </Link>
              </div>
            </div>

            {/* Employee card */}
            <div className="group rounded-2xl border border-border/60 bg-card/40 p-8 transition-all duration-300 hover:border-foreground/10 hover:bg-card/80 hover:shadow-xl hover:shadow-black/[0.03] dark:hover:shadow-black/20">
              <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-accent mb-5">
                <User className="h-6 w-6 text-foreground/70" />
              </div>
              <h3 className="text-xl font-semibold mb-2">
                I&apos;m an employee
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed mb-6">
                Got a magic link from your company? Log in to see your schedule,
                upcoming shifts, and team notifications.
              </p>
              <Link href="/login">
                <Button
                  variant="outline"
                  className="btn-hover w-full rounded-xl h-11 font-medium"
                >
                  Employee sign in
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/40 px-6 lg:px-12 py-8">
        <div className="max-w-5xl mx-auto flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-6 h-6 rounded-md bg-foreground text-background font-bold text-[10px]">
              O
            </div>
            <span className="font-medium text-foreground/80">OhShift</span>
          </div>
          <p>© {new Date().getFullYear()} OhShift. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
