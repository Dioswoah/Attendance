# Attendance App — Infrastructure Strategy

**Project:** Redadair Attendance App  
**Date:** 2026-05-08  
**Stack:** Next.js · Prisma · PostgreSQL (Cloud SQL) · Redis (Memorystore) · Cloud Run · GCP

---

## The Problem

The app currently lives across two GCP projects that have grown in different directions:

| | Project 1 — Production | Project 2 — Staging |
|---|---|---|
| **ID** | `buoyant-purpose-475203-t9` | `bap-rsa` |
| **Cloud Run** | `australia-southeast1` | `us-central1` |
| **Cloud SQL** | `australia-southeast1` (prod data) | `australia-southeast1` (staging data) |
| **Redis** | **Missing** | `us-central1` (exists) |
| **VPC Connector** | `australia-southeast1` | `us-central1` |

**Why this is a problem:**

- Production has no Redis. With up to 3 Cloud Run instances running in parallel, real-time dashboard updates (SSE) do not broadcast between instances — users miss live updates unless they refresh manually. Caching also does not work.
- Staging data is refreshed by exporting prod SQL to a GCS bucket and re-importing into a separate staging database across two projects — a fragile multi-step process.
- Infrastructure is split across two projects with duplicated Cloud SQL instances, separate billing, separate IAM, and separate service accounts. Maintenance overhead doubles.
- The two environments have drifted in capability (staging has Redis, prod does not), which means staging no longer accurately tests what production runs.

---

## What Redis Does (and Does Not Do)

Before choosing an approach, it helps to be clear on Redis's role in this app.

**Redis makes reads faster.** API responses for employees, attendance summaries, leaves, and departments are cached in Redis (~1 ms) instead of querying PostgreSQL on every request (~50–200 ms). When a write happens, the relevant cache keys are deleted so the next read fetches fresh data.

**Redis enables real-time updates across server instances.** When a manager approves a request on Cloud Run instance 2, Redis pub/sub broadcasts that event to instance 1, so the staff member's browser dashboard updates live. Without Redis, each Cloud Run instance is isolated — SSE events never cross between instances.

**Redis does not speed up writes.** Every insert, update, and delete still goes directly to PostgreSQL. Redis holds no permanent data — Cloud SQL is the single source of truth.

---

## Three Strategic Options

---

### Option 1 — Project 1 as the Hub

Keep everything centred in Project 1. Add a staging database to Project 1's existing Cloud SQL instance. Add Redis to Project 1. The staging Cloud Run in Project 2 connects to Project 1's SQL cross-project.

```
Project 1 (buoyant-purpose-475203-t9)  ← HUB
├── Cloud Run PROD        australia-southeast1    (unchanged)
├── Cloud SQL             australia-southeast1
│       ├── attendance            ← production database (existing)
│       └── attendance_staging    ← staging database (new, same instance)
├── Redis PROD            australia-southeast1    (new — add this)
└── VPC Connector         australia-southeast1    (existing)

Project 2 (bap-rsa)  ← STAGING ONLY
├── Cloud Run STAGING     us-central1
│       └── connects to Project 1 Cloud SQL via cross-project IAM (no VPC needed)
├── Redis STAGING         us-central1             (existing, keep as-is)
└── Artifact Registry     us-central1             (Docker images)
```

**Cross-project SQL access requires no VPC peering.** The Cloud SQL Auth Proxy connects over Google's API layer. You simply grant Project 2's Cloud Run service account the `Cloud SQL Client` role in Project 1, and update the connection string. That is the entire change.

**Staging data refresh becomes a single-instance copy.** Because both databases are on the same Cloud SQL instance, refreshing staging from production is a direct internal database copy — no GCS export buckets, no cross-project transfers.

| Pros | Cons |
|---|---|
| Production URL stays unchanged | Two GCP projects to maintain permanently |
| No VPC peering required at all | Staging Cloud Run (us-central1) queries Cloud SQL in australia-southeast1 — ~180 ms DB latency on staging (acceptable, already the case today) |
| Staging data refresh is simple (same SQL instance) | Cloud SQL connection pool is shared across both environments — instance must be sized accordingly |
| Redis added to prod in the correct region | |
| Staging keeps its own Redis — no cross-project networking for Redis | |
| Least migration risk | |

**Best for:** Preserving the production URL with the least disruption.

---

### Option 2 — Project 2 as the Hub (Full Consolidation)

Move production into Project 2. Both environments live in the same GCP project. A custom domain preserves the user-facing URL so users and Google OAuth are unaffected.

```
Project 2 (bap-rsa)  ← SINGLE PROJECT FOR EVERYTHING
├── Cloud Run PROD        australia-southeast1    (new service in bap-rsa)
│       └── Custom domain: attendance.redadair.com.au  ← URL preserved
├── Cloud Run STAGING     us-central1             (existing, unchanged)
├── Cloud SQL             australia-southeast1
│       ├── attendance_production    ← production database
│       └── attendance_staging       ← staging database (existing, renamed)
├── Redis PROD            australia-southeast1    (new)
├── Redis STAGING         us-central1             (existing)
├── VPC Connector PROD    australia-southeast1    (new)
├── VPC Connector STAGING us-central1             (existing)
└── Artifact Registry     us-central1             (existing, shared)

Project 1 (buoyant-purpose-475203-t9)  ← RETIRED after cutover
```

**Custom domain mapping** is a built-in Cloud Run feature — free, with automatic SSL certificate provisioning. You map `attendance.redadair.com.au` to the new Cloud Run service. Users never see a URL change. Google OAuth callbacks are updated once and never need to change again regardless of future infrastructure moves.

| Pros | Cons |
|---|---|
| Single project — one billing dashboard, one IAM config, one set of alerts | Production gets a new `*.run.app` URL — requires custom domain setup and DNS update |
| No cross-project networking at all | One-time migration effort: data copy, DNS cutover, OAuth callback update |
| Each environment has its own Redis in the correct region | During DNS cutover there is a short window (~5 min) where the domain is in transition |
| Staging data refresh is a same-project, same-instance database copy | |
| Project 1 is retired — reduces cost and eliminates the split | |
| Cleanest long-term architecture | |

**Best for:** Long-term cleanliness, single-project management, teams that will keep scaling the app.

---

### Option 3 — Keep Both Projects Independent (Minimal Change)

Do not consolidate. Add Redis to Project 1 only. Each project remains fully self-contained with its own Cloud SQL, its own Redis, and its own everything. The current data refresh workflow (GCS export/import) stays as-is.

```
Project 1 (buoyant-purpose-475203-t9)  ← PRODUCTION (self-contained)
├── Cloud Run PROD        australia-southeast1
├── Cloud SQL             australia-southeast1    (prod data only)
├── Redis PROD            australia-southeast1    (new — add this)
└── VPC Connector         australia-southeast1

Project 2 (bap-rsa)  ← STAGING (self-contained)
├── Cloud Run STAGING     us-central1
├── Cloud SQL             australia-southeast1    (staging data only)
├── Redis STAGING         us-central1
└── VPC Connector         us-central1
```

| Pros | Cons |
|---|---|
| Production URL unchanged | Infrastructure forever split across two projects |
| Fastest to implement — ~30 minutes | Duplicated Cloud SQL, doubled billing complexity |
| Zero migration risk | Staging data refresh remains a fragile cross-project GCS export/import |
| No cross-project networking of any kind | Infrastructure drift will continue — environments will diverge further over time |
| | Does not fix the root problem |

**Best for:** Buying time when there is zero capacity to run a migration. This is not a long-term solution.

---

## Comparison at a Glance

| Criteria | Option 1 — Project 1 Hub | Option 2 — Project 2 Hub | Option 3 — Independent |
|---|---|---|---|
| Production URL preserved natively | Yes | No (custom domain required) | Yes |
| Shared Cloud SQL (one source) | Yes | Yes | No |
| Shared Redis | No (each env keeps its own) | No (each env keeps its own) | No |
| VPC peering required | No | No | No |
| Number of GCP projects after | 2 | 1 | 2 |
| Migration complexity | Low | Medium | Very low |
| Long-term maintainability | Good | Excellent | Poor |
| Staging data refresh complexity | Low (same instance copy) | Low (same instance copy) | High (cross-project GCS) |
| Recommended | For URL-sensitive deployments | For long-term clean architecture | Temporary only |

---

## Recommendation

**If the production URL must not change at all → go with Option 1.**  
It solves the real problems (missing prod Redis, fragile data refresh, shared SQL) with the least disruption. No VPC peering, no DNS changes, no migration window.

**If you can take a 1–2 hour migration window → go with Option 2.**  
It is the cleanest professional architecture. One project, one billing account, no cross-project dependencies. A custom domain on Cloud Run is a one-time setup and is the standard practice on any production app — it also means future infrastructure changes (region, project, provider) never affect users again.

**Option 3 only if you have no bandwidth right now.** Add Redis to prod to fix the immediate real-time update problem, then plan Option 1 or 2 properly.

---

## Key GCP Facts That Shape This Decision

- **Cloud SQL cross-project access needs no VPC.** The Auth Proxy uses Google's API — just an IAM role grant. This is often misunderstood.
- **Redis cross-project access does need VPC peering.** This is why neither Option 1 nor Option 2 share Redis between environments — each keeps its own Redis, which is also the correct isolation practice.
- **Cloud Run `*.run.app` URLs are tied to the GCP project.** Moving to a new project always generates a new URL. Custom domain mapping is the solution.
- **One Cloud SQL instance can host multiple databases.** They are logically isolated. A production and staging database on the same instance cannot query each other and do not share connection state.
- **Cloud Scheduler can trigger Cloud Run services in other projects.** It calls HTTP endpoints — just grant the scheduler's service account `run.invoker` on the target service cross-project.
- **Service accounts can be granted roles across projects.** A service account defined in Project 1 can be given IAM roles in Project 2 and vice versa.




*Infrastructure Strategy — Redadair Attendance App — 2026-05-08*
