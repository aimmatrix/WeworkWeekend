# WeWorkWeekend

Empty offices at weekends. Founders clean, Grok verifies from photos, credit hours buy desk time.

```bash
cp .env.example .env.local   # fill in Supabase + XAI_API_KEY
npm install && npm run dev
```

No `XAI_API_KEY` → `/api/assess` and `/api/verify` run in **mock mode** (contract shapes, `model: "mock"`, data still saved to Supabase).

## Ownership

| Track | Owns |
|---|---|
| 1 Founder app | `app/find/**` |
| 2 Capture + verify | `app/capture/**`, `app/verify/**` |
| 3 Backend | `app/api/**`, `lib/**`, `app/ledger/**`, `app/supervisor/**`, `supabase/**` |

## What Track 3 gives you (import from `@/lib/...`)

**Types:** `lib/types.ts` (`Office`, `Task`, `Verification`, `Credit`, `OfficeWithTasks`, request/response types). Tariff + labels in `lib/tariff.ts`.

**Founder:** `getFounder()` / `setFounder(name)` in `lib/founder.ts` (localStorage key `founder`).

**Data (client-safe, `lib/data.ts`):**
- `listLiveOffices()` → offices with `tasks[]`; `openHours(office)` for the pin label
- `getOffice(id)`, `getTask(id)` (task + `office`)
- `claimTask(taskId, founder)` → task, or `null` if someone beat you (atomic)
- `myTasks(founder)`, `getBalance(founder)`, `bookDesk(founder, officeId, hours, date)`, `myBookings(founder)`
- Landlord: `deleteTask(id)`, `publishOffice(id)`
- `latestVerification(taskId)`

**Photos:** `uploadPhoto(file, "offices/<id>" | "tasks/<id>")` → public URL (`lib/photos.ts`, downsizes to JPEG first).

**API (`lib/api.ts`):**
- `createOffice({name, address})` → draft `Office` (geocoded). Needed before assess.
- `assess({officeId, photoUrls})` → `{dirt_score, crew_size, tasks[]}` (tasks saved, office stays `draft`)
- `verify({taskId, afterUrl})` → `{passed, confidence, reasons[], remaining_issues[], creditId?, verificationId?, hours?}`.
  Task must be `claimed` first. On fail the task stays claimed → retry.

**Landlord flow:** `createOffice` → `uploadPhoto` ×4–6 → `assess` → `deleteTask` (optional) → `publishOffice`.

**Founder flow:** `listLiveOffices` → `claimTask` → `/verify/[taskId]` → `uploadPhoto` → `verify` → `/ledger/[creditId]`.

## Next.js 16 gotcha

`cacheComponents` is on. A dynamic route page (e.g. `/verify/[taskId]`) must not read `params` outside `<Suspense>`.
Pattern used in `app/ledger/[creditId]`: server `page.tsx` renders `<Suspense><View/></Suspense>`, and the client `view.tsx` uses `useParams()`.

## Seed data

Three live offices with fixed ids `11111111-…`, `22222222-…`, `33333333-…` (Shoreditch, King's Cross, Borough). Seed photos are placeholders.
