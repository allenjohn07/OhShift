import { Link } from "@/lib/navigation";
import { ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { Reveal } from "@/components/reveal";
import { AuthHomeRedirect } from "@/components/auth-home-redirect";
import { SchedulePreview } from "./schedule-preview";
import {
  FEATURE_SCENES,
  ROLE_SCENES,
  STEP_SCENES,
  type FeatureSceneKey,
} from "./feature-scenes";

function FeatureScene({ name }: { name: FeatureSceneKey }) {
  const Scene = FEATURE_SCENES[name];
  return <Scene />;
}

function StepScene({ index }: { index: number }) {
  const Scene = STEP_SCENES[index];
  return Scene ? <Scene /> : null;
}

function RoleScene({ title }: { title: string }) {
  const Scene = ROLE_SCENES[title as keyof typeof ROLE_SCENES];
  return Scene ? <Scene /> : null;
}

const features: Array<{
  scene: FeatureSceneKey;
  title: string;
  description: string;
}> = [
  {
    scene: "scheduling",
    title: "Visual Scheduling",
    description:
      "Intuitive calendar interface for effortless shift management. See your whole week at a glance.",
  },
  {
    scene: "team",
    title: "Team Management",
    description:
      "Invite employees, assign roles, and manage your entire team from one place.",
  },
  {
    scene: "portal",
    title: "Employee Portal",
    description:
      "A dedicated, simplified dashboard for your team to easily check their upcoming shifts.",
  },
  {
    scene: "realtime",
    title: "Real-Time Updates",
    description:
      "Live schedule updates powered by real-time sync. Always in sync across all devices.",
  },
  {
    scene: "roles",
    title: "Role-Based Access",
    description:
      "Owners, managers, and employees each see exactly what they need. Secure by default.",
  },
  {
    scene: "speed",
    title: "Lightning Fast",
    description:
      "Built for speed — every interaction feels instant. No loading spinners, ever.",
  },
];

const steps = [
  {
    title: "Create your company",
    description:
      "Register in under a minute and set your morning and evening shift presets.",
  },
  {
    title: "Invite your team",
    description:
      "Add employees and share their invite codes. Promote anyone to manager.",
  },
  {
    title: "Build and publish",
    description:
      "Draft the week, catch overlaps and time-off conflicts, then publish when it's ready.",
  },
];

const roles = [
  {
    title: "Owners",
    points: [
      "Set up the workspace and shift presets",
      "Promote employees to managers",
      "Full view of every schedule",
    ],
  },
  {
    title: "Managers",
    points: [
      "Assign shifts one by one or in bulk",
      "Review time-off and timesheets",
      "Publish the week when it's ready",
    ],
  },
  {
    title: "Employees",
    points: [
      "See published shifts at a glance",
      "Set availability and request time off",
      "Clock in and track your hours",
    ],
  },
];

function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description?: string;
}) {
  return (
    <Reveal className="mb-12 max-w-2xl">
      <p className="mb-2 text-sm font-medium text-brand">{eyebrow}</p>
      <h2 className="text-3xl font-bold leading-tight tracking-tight sm:text-[2.75rem]">
        {title}
      </h2>
      {description && (
        <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
          {description}
        </p>
      )}
    </Reveal>
  );
}

export default function LandingPage() {
  return (
    <AuthHomeRedirect>
      <div className="flex min-h-screen flex-col bg-background">
        <Navbar />

        {/* Hero */}
        <section className="pt-16 pb-14 sm:pt-24 sm:pb-20">
          <div className="mx-auto w-full max-w-6xl px-4 text-center sm:px-6">
            <p className="animate-fade-in delay-100 mb-6 inline-flex items-center gap-2 rounded-md bg-muted px-2.5 py-1 text-[13px] text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Now in public beta
            </p>

            <h1 className="animate-fade-in delay-200 mx-auto max-w-4xl text-5xl font-bold leading-[1.05] tracking-tight sm:text-6xl lg:text-[4.5rem]">
              Stop juggling spreadsheets.
            </h1>

            <p className="animate-fade-in delay-300 mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground sm:text-xl">
              OhShift is the modern shift scheduling platform that your team
              will actually enjoy using. Create, assign, and track shifts — all
              in one beautiful interface.
            </p>

            <div className="animate-fade-in delay-400 mt-9 flex flex-col items-center justify-center gap-2 sm:flex-row">
              <Link href="/company/register">
                <Button size="lg" className="h-11 px-5 text-base">
                  Register your company
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/login">
                <Button
                  size="lg"
                  variant="ghost"
                  className="h-11 px-5 text-base text-brand hover:text-brand"
                >
                  Employee sign in
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* Product preview */}
        <section className="pb-20 sm:pb-28">
          <Reveal className="mx-auto w-full max-w-6xl px-4 sm:px-6">
            <SchedulePreview />
          </Reveal>
        </section>

        {/* Features */}
        <section id="features" className="scroll-mt-14 bg-muted py-20 sm:py-28">
          <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
            <SectionHeading
              eyebrow="Features"
              title="Everything you need, nothing you don't."
              description="A complete toolkit for teams of any size. Ditch the spreadsheets, the group chats, and the chaos."
            />
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
              {features.map((feature, index) => (
                <Reveal key={feature.title} delayMs={index * 60}>
                  <div className="h-full rounded-lg border border-border bg-background p-4 pb-6">
                    <FeatureScene name={feature.scene} />
                    <div className="px-2">
                      <h3 className="mb-1.5 font-semibold">{feature.title}</h3>
                      <p className="text-sm leading-relaxed text-muted-foreground">
                        {feature.description}
                      </p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="scroll-mt-14 py-20 sm:py-28">
          <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
            <SectionHeading
              eyebrow="How it works"
              title="From blank week to published schedule."
            />
            <div className="grid grid-cols-1 gap-10 md:grid-cols-3 md:gap-8">
              {steps.map((step, index) => (
                <Reveal key={step.title} delayMs={index * 80}>
                  <div>
                    <StepScene index={index} />
                    <h3 className="mb-2 text-lg font-semibold">{step.title}</h3>
                    <p className="leading-relaxed text-muted-foreground">
                      {step.description}
                    </p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* Roles */}
        <section id="roles" className="scroll-mt-14 border-t border-border py-20 sm:py-28">
          <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
            <SectionHeading
              eyebrow="For teams"
              title="One workspace, the right view for everyone."
              description="Owners, managers, and employees each see exactly what they need."
            />
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              {roles.map((role, index) => (
                <Reveal key={role.title} delayMs={index * 60}>
                  <div className="h-full rounded-lg border border-border p-4 pb-6">
                    <RoleScene title={role.title} />
                    <h3 className="mb-4 px-2 text-lg font-semibold">{role.title}</h3>
                    <ul className="space-y-2.5 px-2">
                      {role.points.map((point) => (
                        <li
                          key={point}
                          className="flex gap-2 text-sm text-muted-foreground"
                        >
                          <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                          {point}
                        </li>
                      ))}
                    </ul>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="bg-muted py-20 sm:py-28">
          <Reveal className="mx-auto w-full max-w-3xl px-4 text-center sm:px-6">
            <h2 className="text-3xl font-bold leading-tight tracking-tight sm:text-5xl">
              Get your team on the same schedule.
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Set up your workspace in minutes.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-2 sm:flex-row">
              <Link href="/company/register">
                <Button size="lg" className="h-11 px-5 text-base">
                  Register your company
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/company/login">
                <Button
                  size="lg"
                  variant="outline"
                  className="h-11 px-5 text-base"
                >
                  Company login
                </Button>
              </Link>
            </div>
          </Reveal>
        </section>

        <Footer />
      </div>
    </AuthHomeRedirect>
  );
}
