# OhShift

OhShift is a smart shift scheduling platform designed for modern teams, providing a seamless experience for both managers and employees to manage work schedules in real-time.

## Tech Stack

- **Framework**: [Next.js 16](https://nextjs.org/) (App Router)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/) + [shadcn/ui](https://ui.shadcn.com/)
- **Backend & Auth**: [Supabase](https://supabase.com/) (using SSR and Middleware)
- **Email/Onboarding**: [Resend](https://resend.com/) (Magic Links for employee onboarding)

## Getting Started

```bash
bun install
bun run dev
```

## Features Currently Implemented

### Authentication & Onboarding
- **Company Registration**: Businesses can easily register and set up their organization.
- **Role-Based Access**: Specialized views and permissions for Owners/Managers vs. Employees.
- **Magic Link Onboarding**: Seamless employee invitation and login via Resend-powered magic links.

### Manager Dashboard
- **Team Management**: Invite employees, manage roles, and view team lists.
- **Interactive Schedule Grid**: A comprehensive view of the entire team's schedule.
- **Shift Assignment**: Create and assign shifts to specific employees with ease.
- **Company Settings**: Manage organizational details and preferences.

### Employee Dashboard
- **Personalized Shift Views**: Employees can see their upcoming shifts at a glance.
- **Shift Summaries**: Detailed breakdowns of weekly and monthly work hours.
- **Real-time Sync**: Schedules update instantly across all devices.

### Profile Management
- **User Profiles**: All users can update their personal information and preferences.
- **Secure Sessions**: Robust session management using Supabase SSR.

---
*More features coming soon...*
