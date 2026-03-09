📋 Fitness Social App - Product Requirements Document (PRD)
1. Project Overview
A mobile-first, Progressive Web App (PWA) designed for fitness gamification among friends. Users can join private groups, log customized workouts (sets, weights, reps, distance, time), and compete on leaderboards. The app features a social feed where users can see friends' workouts, react, and comment.

2. Tech Stack

Frontend: Next.js (React), Tailwind CSS.

Backend: Golang (deployed as Vercel Serverless Functions in the api/ directory).

Database & Auth: Supabase (PostgreSQL, Supabase Auth).

Deployment: Vercel.

3. UI/UX Design Guidelines

Paradigm: Strictly Mobile-First and PWA configured.

Theme: Dark Mode ONLY (deep blacks/grays backgrounds).

Brand Accent Color: Neon Green/Lime (e.g., Tailwind lime-400 or green-500) for primary buttons, active states, and links.

Avatars: Auto-generated circles with user initials (e.g., White text on dark gray/accent background) – no image uploads for now.

Data Visualization: Plain text and tables only (no charts/graphs).

Navigation: Bottom navigation bar for core views (Feed, Leaderboard, Profile) and a prominent Floating Action Button (FAB) for "Add Workout".

4. Core Features & Business Logic

A. Authentication:

Supabase Email/Password auth.

During registration, users must provide a username (nickname) which will be displayed publicly.

B. Group Management:

Users can create a group (becoming the Admin) or join multiple existing groups.

Joining requires a unique, auto-generated 6-character alphanumeric invite code.

Admins can kick users from the group.

Categories: Admins define workout categories for the group (e.g., "Chest", "Running").

Metrics: For each category, the Admin selects required metric fields (combinations of: reps, weight_kg, distance_km, time_min).

C. Workout Flow (CRUD):

User clicks FAB -> "Create Workout" -> Selects Group.

User clicks "Add Exercise". They type a custom name (e.g., "Bench Press") and select the Admin-defined Category (e.g., "Chest").

User adds "Sets". The input fields dynamically render based on the Category's metrics (e.g., if Category has reps and weight_kg, the user only sees those two inputs per set).

Full CRUD: Users can edit or delete their workouts and individual sets at any time (even retroactively).

D. Social Feed (Home Page):

Main view after login. Displays a chronological feed of workouts from the user's groups.

Cards show: User avatar/initials, time ago, workout summary (e.g., "Oskar completed 3 exercises, total volume: 4500kg").

Reactions: Users can leave emoji reactions (💪, ❤️, 🔥) on workout cards. Shows who reacted.

Comments: Users can comment on workouts. Full CRUD for comments (edit/delete own comments).

E. Leaderboards:

Based on group categories and their calculated metrics (e.g., Total Volume for weights = reps * weight; Total Distance for running).

Time filters required: This Week, Last Week, Last Month, All-Time.

5. Database Schema Requirements (Relational PostgreSQL)

users: id (uuid), email, username, created_at.

groups: id, admin_id (fk), name, invite_code (unique 6-char).

group_members: group_id, user_id, joined_at.

categories: id, group_id, name, metrics (jsonb or booleans: has_reps, has_weight, has_distance, has_time).

workouts: id, user_id, group_id, title/name, created_at.

exercises: id, workout_id, category_id, custom_name.

sets: id, exercise_id, reps (int), weight_kg (float), distance_km (float), time_min (int).

reactions: id, workout_id, user_id, type (enum).

comments: id, workout_id, user_id, content, created_at.

---

## 6. Development Progress (Conversation Summary)

### Completed Features (committed & pushed to main)

| Commit | Description |
|--------|-------------|
| `bbac42c` | fix: points calculation (3-step formula with baseUnit regex), feat: reactions toggle (fire/muscle/heart — INSERT/DELETE/UPDATE), feat: expandable comments on feed |
| `e0b4c0f` | fix: tighten reaction button padding for narrow screens (px-3 → px-2) |
| `0371f92` | feat: Go leaderboard serverless API (`api/leaderboard.go`) with generic `supabaseGet[T]` helper |
| `ca2f1a8` | feat: frontend leaderboard page with podium top-3 and timeframe filter |
| `db949ea` | feat: user profile page with stats grid and workout deletion |
| `f79d8b2` | feat: PWA manifest, viewport meta, placeholder icons (192 & 512) |
| `7b40bb2` | feat: workout edit page with pre-filled inputs, ownership check, live points preview |

### In-Progress Work (uncommitted)

**Three-part task — expected commit message:**
`"fix: leaderboard RLS auth, feat: add full CRUD to workout edit, style: futuristic UI overhaul"`

1. **Leaderboard RLS fix** ✅ — Frontend passes user JWT in Authorization header; Go API forwards it to Supabase REST calls.
2. **Edit page full CRUD** ✅ — "Add new set" per exercise, "Add new exercise" form, save distinguishes existing (UPDATE) vs new (_isNew → INSERT), temp IDs with counter.
3. **Glassmorphism UI redesign** 🔄 — Partially complete.

#### Glassmorphism Design System

| Element | Classes |
|---------|---------|
| Cards/panels | `rounded-2xl border border-white/5 bg-neutral-900/60 backdrop-blur-md` |
| Inputs | `rounded-xl border border-white/10 bg-neutral-900/50` |
| Action buttons | `rounded-full bg-lime-500 font-bold shadow-[0_0_15px_rgba(132,204,22,0.4)]` |
| BottomNav | `bg-neutral-950/80 backdrop-blur-lg border-white/10` |
| FAB | `rounded-full bg-lime-500 shadow-[0_0_15px_rgba(132,204,22,0.4)]` |

#### Files updated with glassmorphism ✅
- `src/components/BottomNav.js`
- `src/components/FAB.js`
- `src/app/page.js` (feed)
- `src/app/login/page.js`
- `src/app/register/page.js`
- `src/app/groups/page.js`
- `src/app/profile/page.js`
- `src/app/workouts/[id]/edit/page.js`

#### Files still needing glassmorphism ❌
- `src/app/groups/[id]/page.js` — category form, inputs, category list, scoring rules, tab switcher
- `src/app/groups/[id]/leaderboard/page.js` — timeframe tabs, podium cards, list cards
- `src/app/workouts/new/page.js` — form inputs, select, button
- `src/app/workouts/[id]/page.js` — exercise cards, set rows, inputs, buttons

### Key Technical Details

- **Points formula**: `points = Math.round((totalValue / baseUnitValue) * multiplier)` — totalValue = weight×reps (tonnage) or distance or time or reps; baseUnitValue extracted via regex from `base_unit` string
- **Reactions**: unique constraint `(workout_id, user_id)` — one reaction/user/workout; toggle: same=DELETE, different=UPDATE, none=INSERT
- **Go API auth**: `authToken := r.Header.Get("Authorization")` → forwarded to all `supabaseGet[T]` calls; falls back to anon key if empty
- **Edit page**: `_isNew` flag + `tempIdCounter` at module scope to distinguish new vs existing sets during save
- **Migration files**: `01_add_multipliers.sql`, `02_add_points_to_sets.sql`, `03_reactions_update_policy.sql`

### Project Rules
- **JavaScript only** (.js/.jsx) — NO TypeScript
- **Conventional Commits**, auto commit+push after each logical stage
- **Max ~300 line insertions** per commit; split if larger
- **Verify with `npx next build`** before committing