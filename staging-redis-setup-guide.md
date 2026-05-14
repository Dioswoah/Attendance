# Staging & Redis Setup Guide

---

## 1. What We Set Up in Staging (bap-rsa project)

We created a full **staging environment** in a separate GCP project called `bap-rsa` so every fix gets tested before hitting your 80 real users. The infrastructure we provisioned:

| Resource | Details |
|---|---|
| **Cloud Run** | `attendance-app` in `us-central1` |
| **Cloud SQL** | `attendance-staging` PostgreSQL 15 in `australia-southeast1` |
| **Redis (Memorystore)** | `attendance-redis` at `10.5.107.43:6379` in `us-central1` |
| **VPC Connector** | `attendance-vpc-connector` — bridges Cloud Run to Redis/SQL over private network |

The deploy workflow is: **Local fix → build image → deploy to staging → test → deploy to live**

### Deploy Commands

```powershell
# Deploy to staging (skip data copy and infra — already exists)
.\external-tools\deploy-staging.ps1 -SkipDataCopy -SkipInfrastructure

# Deploy to live/production
.\external-tools\deploy.ps1
```

---

## 2. Redis — What It Is and Why We Added It

Redis is an **in-memory key-value store** that sits in front of your database. Instead of querying PostgreSQL every time a page loads, the app checks Redis first. If the data is already cached there, it returns instantly without touching the database.

### What Gets Cached and For How Long

| Data | Cache Duration | Why |
|---|---|---|
| **Employees list** | 10 minutes | Only changes when someone is hired/fired |
| **Managers list** | 30 minutes | Role changes are rare |
| **Departments** | 1 hour | Almost never changes |
| **Staff dashboard** | 15 seconds | Near real-time attendance state |
| **Attendance summary** | 2 minutes | Historical data |
| **Leaves** | 2 minutes | Leave lists |
| **Pending requests** | 1 minute | Pending approval queues |

When someone updates data (approve a leave, clock in, etc.), the relevant cache keys are **immediately invalidated** so the next request gets fresh data from the database.

### Redis Pub/Sub — Real-time Updates

Redis also powers **real-time screen updates**. When any admin or staff member takes an action (clock in, approve a request), Redis broadcasts that event to all connected instances via a Pub/Sub channel called `attendance:updates`. This means:

- If two admins have the dashboard open at the same time, both screens update automatically
- Without Redis, only the person on the same server instance would see live updates

**Fallback:** If Redis is ever down, the app continues working — it just falls back to hitting the database directly. No crash, no data loss.

---

## 3. Where to Find Redis in Google Cloud Console

### Staging Redis

1. Go to [https://console.cloud.google.com](https://console.cloud.google.com)
2. Switch project to **`bap-rsa`** (top project dropdown)
3. Left sidebar → **Memorystore** → **Redis**
4. Click `attendance-redis` to see IP (`10.5.107.43`), port (`6379`), status, memory usage, etc.

### Production Redis (when added to live)

- Same steps but switch to project **`buoyant-purpose-475203-t9`**

---

## 4. Other Things That Made the App Fast and Functional

### Performance

- **Redis caching** — most-hit API routes serve cached data in microseconds instead of round-tripping to Cloud SQL every time
- **localStorage filter persistence** — dashboard filters survive page reloads so admins don't lose their view
- **SWR data fetching** — the app uses stale-while-revalidate so pages feel instant while data refreshes in the background

### Reliability Fixes

- Fixed **GCS signed URL generation** — passing `projectId` explicitly to the Storage client
- Fixed **file attachment streaming** — streams files directly instead of signed URLs (avoids IAM permission issues)
- Fixed **payroll CSV export** format to match the Apps Script format exactly

### Correctness Fixes

- Fixed **Buffer → Uint8Array** conversion for NextResponse compatibility with newer Node.js/Next.js versions
- Fixed **timezone date parsing** using `parseISO(date.slice(0,10))` to avoid UTC/local mismatches on leave calendars

---

## Key File Locations

| File | Purpose |
|---|---|
| `src/lib/redis.ts` | Redis client setup with error handling and fallback |
| `src/lib/cache.ts` | Cache helpers — get, set, invalidate, TTL constants |
| `src/lib/eventBus.ts` | Redis Pub/Sub for real-time cross-instance updates |
| `external-tools/deploy-staging.ps1` | Full staging deploy script (infra + data copy + build) |
| `external-tools/deploy.ps1` | Production deploy script |
| `.env.staging` | Staging environment variables (includes `REDIS_URL`) |

---

## Project Reference

| Environment | GCP Project ID | URL |
|---|---|---|
| **Staging** | `bap-rsa` | https://attendance-app-975601685771.us-central1.run.app |
| **Production** | `buoyant-purpose-475203-t9` | Live production URL |
