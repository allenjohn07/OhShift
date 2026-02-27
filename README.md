<div align="center">

# ⚡ OhShift

**Smart shift scheduling for modern teams.**

Create schedules, manage employees, and communicate changes — all from one clean interface.

[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)](https://typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4-06B6D4?logo=tailwindcss)](https://tailwindcss.com/)
[![License](https://img.shields.io/badge/License-MIT-green)](#license)

[Getting Started](#getting-started) · [Features](#features) · [Tech Stack](#tech-stack) · [Project Structure](#project-structure)

</div>

---

## ✨ Features

| Feature | Description |
|---|---|
| **Visual Scheduling** | Drag-and-drop weekly calendar for effortless shift management |
| **Team Management** | Invite employees via magic links, assign roles, manage your team |
| **Instant Notifications** | Email alerts for new shifts, updates, and cancellations |
| **Real-Time Updates** | Live schedule sync across all devices |
| **Role-Based Access** | Owners, managers, and employees see exactly what they need |
| **Dark Mode** | System-aware with manual toggle in the navbar |
| **Responsive Design** | Fully responsive with mobile hamburger menu and scrollable schedule |

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | [Next.js 16](https://nextjs.org/) (App Router) |
| **Language** | [TypeScript](https://typescriptlang.org/) |
| **Styling** | [Tailwind CSS v4](https://tailwindcss.com/) + [shadcn/ui](https://ui.shadcn.com/) |
| **Icons** | [Lucide React](https://lucide.dev/) |
| **Theming** | [next-themes](https://github.com/pacocoursey/next-themes) |
| **Toasts** | [Sonner](https://sonner.emilkowal.dev/) |

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Bun](https://bun.sh/)

### Installation

```bash
# Clone the repository
git clone https://github.com/allenjohn07/OhShift.git
cd OhShift

# Install dependencies
bun install

# Start the development server
bun run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app.

## 📁 Project Structure

```
src/
├── app/
│   ├── page.tsx                    # Landing page
│   ├── layout.tsx                  # Root layout with providers
│   ├── globals.css                 # Theme, animations, utilities
│   ├── login/
│   │   └── page.tsx                # Employee sign in
│   └── company/
│       ├── login/
│       │   └── page.tsx            # Company sign in
│       └── register/
│           └── page.tsx            # Company registration
├── components/
│   ├── navbar.tsx                  # Responsive nav with mobile menu
│   ├── providers.tsx               # Theme provider + toaster
│   └── ui/                         # shadcn/ui primitives
│       ├── button.tsx
│       ├── input.tsx
│       ├── label.tsx
│       └── sonner.tsx
└── lib/
    └── utils.ts                    # Utility functions
```

## 🗺 Routes

| Route | Description |
|---|---|
| `/` | Landing page with schedule preview, features, and auth CTA |
| `/login` | Employee sign in (accounts created via magic link) |
| `/company/login` | Company admin sign in |
| `/company/register` | New company registration |

## 📜 Scripts

| Command | Description |
|---|---|
| `bun run dev` | Start development server |
| `bun run build` | Create production build |
| `bun run start` | Start production server |
| `bun run lint` | Run ESLint |

## 🎨 Design

- **Neutral theme** with monochrome palette that adapts to light/dark mode
- **Staggered fade-in animations** on page load for smooth entrance
- **Button hover effects** with shimmer sweep, lift, and press feedback
- **Colored schedule blocks** (violet, blue, emerald, amber, rose) for shift differentiation
- **Split-screen auth layout** with feature panels on desktop, full-width on mobile
- **Animated hamburger menu** with morphing bars → X transition

## 🗓 Roadmap

- [ ] Supabase integration for auth and database
- [ ] Magic link employee onboarding
- [ ] Interactive drag-and-drop shift calendar
- [ ] Role-based dashboards (owner, manager, employee)
- [ ] Email notifications via Resend
- [ ] Employee shift acknowledgement
- [ ] Manager schedule overview with coverage stats

## 📄 License

This project is licensed under the [MIT License](LICENSE).

---

<div align="center">

**Built with ❤️ by [Allen John](https://github.com/allenjohn07)**

</div>
