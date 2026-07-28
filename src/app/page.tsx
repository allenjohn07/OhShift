import Link from "next/link";
import {
  ArrowRight,
  Clock,
  Users,
  Calendar,
  Shield,
  Zap,
  ChevronRight,
  Building2,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { Reveal } from "@/components/reveal";

const features = [
  {
    icon: Calendar,
    title: "Visual Scheduling",
    description:
      "Intuitive calendar interface for effortless shift management. See your whole week at a glance.",
  },
  {
    icon: Users,
    title: "Team Management",
    description:
      "Invite employees, assign roles, and manage your entire team from one place.",
  },
  {
    icon: User,
    title: "Employee Portal",
    description:
      "A dedicated, simplified dashboard for your team to easily check their upcoming shifts.",
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
    <div className="min-h-screen bg-background flex flex-col">
      {/* Subtle grid background */}
      <div className="fixed inset-0 -z-10">
        <div
          className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05]"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)`,
            backgroundSize: "40px 40px",
          }}
        />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-linear-to-b from-brand/15 to-transparent rounded-full blur-3xl" />
      </div>

      <Navbar />

      {/* Hero — fills first viewport through Register CTA */}
      <section className="relative flex min-h-[calc(100dvh-4rem)] flex-col justify-center py-16 sm:py-20">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 text-center">
          <div className="animate-fade-in delay-100 inline-flex items-center gap-2.5 rounded-full border border-brand/20 bg-brand-soft/60 backdrop-blur-sm px-4 py-1.5 text-sm text-muted-foreground mb-8 transition-all duration-300 hover:border-brand/35 cursor-default">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand/75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-brand" />
            </span>
            Now in public beta
            <ChevronRight className="h-3 w-3" />
          </div>

          <h1 className="animate-fade-in delay-200 text-5xl sm:text-6xl lg:text-[5rem] font-bold tracking-tight leading-[1.05] mb-6">
            Stop juggling
            <br />
            <span className="text-muted-foreground">spreadsheets.</span>
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
        </div>
      </section>

      {/* Schedule preview — next section on scroll */}
      <section className="py-16 sm:py-24">
        <Reveal className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="relative rounded-2xl border border-border/60 bg-card/40 backdrop-blur-sm p-1 shadow-2xl shadow-black/5 dark:shadow-black/20">
            <div className="rounded-xl bg-card overflow-hidden">
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
                    ),
                  )}
                  {Array.from({ length: 7 }, (_, i) => (
                    <div
                      key={i}
                      className="bg-card p-2.5 min-h-[100px] space-y-1.5"
                    >
                      {i < 5 && (
                        <>
                          <div
                            className={`text-[10px] font-medium px-2 py-1.5 rounded-md ${
                              i % 3 === 0
                                ? "bg-violet-500/10 text-violet-600 dark:text-violet-400"
                                : i % 3 === 1
                                  ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                                  : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                            }`}
                          >
                            {i % 2 === 0 ? "7am–3pm" : "2pm–10pm"}
                            <br />
                            <span className="opacity-70">
                              {
                                [
                                  "Casey R.",
                                  "Jordan L.",
                                  "Sam C.",
                                  "Taylor K.",
                                  "Avery P.",
                                ][i]
                              }
                            </span>
                          </div>
                          {i < 3 && (
                            <div
                              className={`text-[10px] font-medium px-2 py-1.5 rounded-md ${
                                i % 2 === 0
                                  ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                                  : "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                              }`}
                            >
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
        </Reveal>
      </section>

      {/* Features */}
      <section className="py-24 sm:py-32">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <Reveal className="text-center mb-16">
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
          </Reveal>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map((feature, index) => (
              <Reveal key={feature.title} delayMs={index * 80}>
                <div className="group rounded-2xl border border-border/50 bg-card/40 p-7 transition-all duration-300 hover:border-foreground/10 hover:bg-card/80 h-full">
                  <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-brand-soft mb-5">
                    <feature.icon className="h-5 w-5 text-brand" />
                  </div>
                  <h3 className="font-semibold text-base mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Two-column auth CTA */}
      <section className="py-24 sm:py-32 border-t border-border/40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <Reveal className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
              Ready to get started?
            </h2>
            <p className="text-muted-foreground text-lg">
              Choose how you want to use OhShift.
            </p>
          </Reveal>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Reveal delayMs={80}>
              <div className="group rounded-2xl border border-border/50 bg-card/40 overflow-hidden transition-all duration-300 hover:border-foreground/10 hover:bg-card/80 flex flex-col h-full">
                <div className="p-8 flex flex-col flex-1">
                  <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-brand-soft mb-6">
                    <Building2 className="h-6 w-6 text-brand" />
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
            </Reveal>

            <Reveal delayMs={160}>
              <div className="group rounded-2xl border border-border/50 bg-card/40 overflow-hidden transition-all duration-300 hover:border-foreground/10 hover:bg-card/80 flex flex-col h-full">
                <div className="p-8 flex flex-col flex-1">
                  <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-brand-soft mb-6">
                    <User className="h-6 w-6 text-brand" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">
                    I&apos;m an employee
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed mb-8 flex-1">
                    Invited by your company? Log in with your email and invite
                    code to see your schedule and upcoming shifts.
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
            </Reveal>
          </div>
        </div>
      </section>

      <Footer className="mt-20 sm:mt-32" />
    </div>
  );
}
