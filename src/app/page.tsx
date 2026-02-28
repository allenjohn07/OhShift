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
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-linear-to-b from-foreground/3 to-transparent rounded-full blur-3xl" />
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

        <div className="animate-fade-in delay-400 flex items-center justify-center">
          <Link href="/company/register">
            <Button
              size="lg"
              className="btn-hover h-13 px-10 text-base rounded-full font-medium"
            >
              <Building2 className="mr-2 h-4.5 w-4.5" />
              Register your company
            </Button>
          </Link>
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

      {/* Features — Bento Grid */}
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
                className="group rounded-2xl border border-border/50 bg-card/40 p-7 transition-all duration-300 hover:border-foreground/10 hover:bg-card/80"
              >
                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-accent mb-5">
                  <feature.icon className="h-5 w-5 text-foreground/60" />
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
            <div className="group rounded-2xl border border-border/50 bg-card/40 overflow-hidden transition-all duration-300 hover:border-foreground/10 hover:bg-card/80 flex flex-col">
              <div className="p-8 flex flex-col flex-1">
                <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-accent mb-6">
                  <Building2 className="h-6 w-6 text-foreground/60" />
                </div>
                <h3 className="text-xl font-semibold mb-2">I manage a team</h3>
                <p className="text-sm text-muted-foreground leading-relaxed mb-8 flex-1">
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
            </div>

            {/* Employee card */}
            <div className="group rounded-2xl border border-border/50 bg-card/40 overflow-hidden transition-all duration-300 hover:border-foreground/10 hover:bg-card/80 flex flex-col">
              <div className="p-8 flex flex-col flex-1">
                <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-accent mb-6">
                  <User className="h-6 w-6 text-foreground/60" />
                </div>
                <h3 className="text-xl font-semibold mb-2">
                  I&apos;m an employee
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed mb-8 flex-1">
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
        </div>
      </section>

      {/* Professional Footer */}
      <footer className="border-t border-border/40 bg-card/20 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-6 lg:px-12">
          {/* Footer columns */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-10 py-14">
            {/* Brand column */}
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="relative flex items-center justify-center w-8 h-8 rounded-xl bg-foreground text-background font-bold text-xs overflow-hidden">
                  <span className="relative z-10">O</span>
                  <div className="absolute inset-0 bg-linear-to-br from-white/20 to-transparent" />
                </div>
                <span className="text-lg font-semibold tracking-tight">OhShift</span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Modern shift scheduling that your team will actually enjoy.
              </p>
            </div>

            {/* Product column */}
            <div>
              <h4 className="text-sm font-semibold mb-4">Product</h4>
              <ul className="space-y-2.5">
                <li>
                  <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-200">Features</a>
                </li>
                <li>
                  <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-200">Integrations</a>
                </li>
                <li>
                  <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-200">Changelog</a>
                </li>
              </ul>
            </div>

            {/* Company column */}
            <div>
              <h4 className="text-sm font-semibold mb-4">Company</h4>
              <ul className="space-y-2.5">
                <li>
                  <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-200">About</a>
                </li>
                <li>
                  <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-200">Blog</a>
                </li>
                <li>
                  <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-200">Careers</a>
                </li>
              </ul>
            </div>

            {/* Legal column */}
            <div>
              <h4 className="text-sm font-semibold mb-4">Legal</h4>
              <ul className="space-y-2.5">
                <li>
                  <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-200">Privacy</a>
                </li>
                <li>
                  <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-200">Terms</a>
                </li>
                <li>
                  <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-200">Security</a>
                </li>
              </ul>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="border-t border-border/40 py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} OhShift. All rights reserved.
            </p>
            <div className="flex items-center gap-3">
              <a
                href="https://github.com/allenjohn07/OhShift"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 rounded-full text-sm font-medium text-muted-foreground hover:text-foreground transition-all duration-200"
              >
                Proudly open-source
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-4 w-4"
                  aria-label="GitHub"
                >
                  <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
                  <path d="M9 18c-4.51 2-5-2-7-2" />
                </svg>
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
