import Link from "next/link";
import { ArrowRight, Clock, Users, Calendar, Bell, Shield, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";

const features = [
  {
    icon: Calendar,
    title: "Visual Scheduling",
    description: "Drag-and-drop calendar for effortless shift management. See your whole week at a glance.",
  },
  {
    icon: Users,
    title: "Team Management",
    description: "Invite employees, assign roles, and manage your entire team from one place.",
  },
  {
    icon: Bell,
    title: "Instant Notifications",
    description: "Email alerts for new shifts, updates, and cancellations. Never miss a change.",
  },
  {
    icon: Clock,
    title: "Real-Time Updates",
    description: "Live schedule updates powered by real-time subscriptions. Always in sync.",
  },
  {
    icon: Shield,
    title: "Role-Based Access",
    description: "Owners, managers, and employees each see exactly what they need.",
  },
  {
    icon: Zap,
    title: "Lightning Fast",
    description: "Built for speed — every interaction feels instant. No loading spinners.",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 lg:px-12 h-16 border-b border-border/50">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-foreground text-background font-bold text-sm">
            O
          </div>
          <span className="text-lg font-semibold tracking-tight">OhShift</span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/login">
            <Button variant="ghost" size="sm">
              Log in
            </Button>
          </Link>
          <Link href="/signup">
            <Button size="sm">
              Get Started
              <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="px-6 lg:px-12 pt-24 pb-20 max-w-4xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-1.5 text-sm text-muted-foreground mb-8">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          Now in public beta
        </div>
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1] mb-6">
          Shift scheduling
          <br />
          <span className="text-muted-foreground">that just works.</span>
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
          Create schedules, manage your team, and communicate changes — all from
          one clean interface. Built for speed, designed for simplicity.
        </p>
        <div className="flex items-center justify-center gap-4">
          <Link href="/signup">
            <Button size="lg" className="h-12 px-8 text-base">
              Start for free
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
          <Link href="/login">
            <Button variant="outline" size="lg" className="h-12 px-8 text-base">
              Log in
            </Button>
          </Link>
        </div>
      </section>

      {/* Feature grid */}
      <section className="px-6 lg:px-12 pb-24 max-w-5xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="group rounded-xl border border-border bg-card p-6 transition-all hover:border-foreground/20 hover:shadow-sm"
            >
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-accent mb-4">
                <feature.icon className="h-5 w-5 text-foreground" />
              </div>
              <h3 className="font-semibold mb-2">{feature.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border px-6 lg:px-12 py-8">
        <div className="max-w-5xl mx-auto flex items-center justify-between text-sm text-muted-foreground">
          <p>© 2025 OhShift. All rights reserved.</p>
          <p>Built with Next.js · Supabase · Vercel</p>
        </div>
      </footer>
    </div>
  );
}
