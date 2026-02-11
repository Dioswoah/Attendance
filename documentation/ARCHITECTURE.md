# Redadair Attendance System - Technical Architecture

## System Architecture Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                             │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    Web Browser                            │   │
│  │  ┌────────────────┐         ┌────────────────┐           │   │
│  │  │ Employee Portal│         │  Admin Portal  │           │   │
│  │  │   (/user)      │         │   (/admin)     │           │   │
│  │  └────────────────┘         └────────────────┘           │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              ↕ HTTP/HTTPS
┌─────────────────────────────────────────────────────────────────┐
│                      APPLICATION LAYER                           │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              Next.js 16 Application                       │   │
│  │  ┌────────────────┐         ┌────────────────┐           │   │
│  │  │  Server Side   │         │  Client Side   │           │   │
│  │  │  Components    │         │  Components    │           │   │
│  │  └────────────────┘         └────────────────┘           │   │
│  │  ┌────────────────────────────────────────────┐          │   │
│  │  │          API Routes (Backend)              │          │   │
│  │  │  /api/employees  /api/attendance           │          │   │
│  │  │  /api/departments /api/breaks              │          │   │
│  │  │  /api/leaves     /api/auth                 │          │   │
│  │  └────────────────────────────────────────────┘          │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              ↕ Prisma ORM
┌─────────────────────────────────────────────────────────────────┐
│                        DATA LAYER                                │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              PostgreSQL Database                          │   │
│  │  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐       │   │
│  │  │ User │  │ Dept │  │Attend│  │Break │  │Leave │       │   │
│  │  └──────┘  └──────┘  └──────┘  └──────┘  └──────┘       │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Application Flow

### Employee Clock-In Flow

```
┌─────────┐
│ Employee│
└────┬────┘
     │ 1. Opens /user
     ↓
┌─────────────────┐
│ User Dashboard  │
│  Component      │
└────┬────────────┘
     │ 2. useEffect() runs
     ↓
┌─────────────────┐
│ Fetch Employees │←─── GET /api/employees
│ Fetch Depts     │←─── GET /api/departments
└────┬────────────┘
     │ 3. Selects Dept, Name, Mode
     ↓
┌─────────────────┐
│ Click Clock In  │
└────┬────────────┘
     │ 4. handleClockIn()
     ↓
┌─────────────────┐
│ Check Existing  │←─── GET /api/attendance?date=today&userId=xxx
│ Record          │
└────┬────────────┘
     │ 5. If exists: Update, else: Create
     ↓
┌─────────────────┐
│ Create/Update   │←─── POST/PUT /api/attendance
│ Attendance      │
└────┬────────────┘
     │ 6. Success response
     ↓
┌─────────────────┐
│ Update UI State │
│ - Status: clocked-in
│ - Show clock-in time
│ - Refresh table
└─────────────────┘
```

### Admin Dashboard Data Flow

```
┌─────────┐
│  Admin  │
└────┬────┘
     │ 1. Login at /admin-login
     ↓
┌─────────────────┐
│ Authentication  │←─── POST /api/auth/admin-login
│                 │      { email, password }
└────┬────────────┘
     │ 2. Success → Redirect to /admin
     ↓
┌─────────────────┐
│ Admin Dashboard │
│  Component      │
└────┬────────────┘
     │ 3. useEffect() - fetchData()
     ↓
┌─────────────────────────────────────────┐
│ Parallel API Calls:                     │
│ - GET /api/employees                    │
│ - GET /api/departments                  │
│ - GET /api/attendance?date=today        │
│ - GET /api/leaves?status=APPROVED       │
└────┬────────────────────────────────────┘
     │ 4. Process responses
     ↓
┌─────────────────────────────────────────┐
│ Calculate Metrics:                      │
│ - Total employees                       │
│ - Present today (clockIn && !clockOut)  │
│ - Late arrivals (clockIn > 9:00 AM)     │
│ - On leave                              │
└────┬────────────────────────────────────┘
     │ 5. Update state
     ↓
┌─────────────────┐
│ Render Dashboard│
│ - Metrics cards │
│ - Activity feed │
│ - Charts        │
└─────────────────┘
```

---

## Database Architecture

### Entity Relationship Diagram

```
┌──────────────────────────┐
│         User             │
├──────────────────────────┤
│ id: String (PK)          │
│ name: String?            │
│ email: String (UNIQUE)   │
│ password: String?        │
│ role: Role               │
│ departmentId: String? FK │
│ createdAt: DateTime      │
│ updatedAt: DateTime      │
└──────────┬───────────────┘
           │
           │ 1:N
           │
           ↓
┌──────────────────────────┐         ┌──────────────────────────┐
│      Attendance          │    N:1  │       Department         │
├──────────────────────────┤←────────┤──────────────────────────┤
│ id: String (PK)          │         │ id: String (PK)          │
│ userId: String (FK)      │         │ name: String (UNIQUE)    │
│ date: DateTime           │         │ createdAt: DateTime      │
│ clockIn: DateTime?       │         │ updatedAt: DateTime      │
│ clockOut: DateTime?      │         └──────────────────────────┘
│ status: AttendanceStatus │
│ mode: WorkMode           │
│ duration: Int?           │
│ notes: String?           │
│ createdAt: DateTime      │
│ updatedAt: DateTime      │
└──────────┬───────────────┘
           │
           │ 1:N
           │
           ↓
┌──────────────────────────┐
│         Break            │
├──────────────────────────┤
│ id: String (PK)          │
│ attendanceId: String FK  │
│ startTime: DateTime      │
│ endTime: DateTime?       │
│ createdAt: DateTime      │
│ updatedAt: DateTime      │
└──────────────────────────┘

┌──────────────────────────┐
│         Leave            │
├──────────────────────────┤
│ id: String (PK)          │
│ userId: String (FK)      │
│ startDate: DateTime      │
│ endDate: DateTime        │
│ type: String             │
│ reason: String?          │
│ status: String           │
│ duration: String         │
│ startTime: DateTime?     │
│ endTime: DateTime?       │
│ createdAt: DateTime      │
│ updatedAt: DateTime      │
└──────────────────────────┘
           ↑
           │ N:1
           │
           └──────────────── User
```

### Database Indexes

```sql
-- Attendance table indexes
CREATE INDEX idx_attendance_date ON "Attendance"(date);
CREATE INDEX idx_attendance_user_date ON "Attendance"(userId, date);
CREATE INDEX idx_attendance_status ON "Attendance"(status);

-- User table indexes
CREATE INDEX idx_user_email ON "User"(email);
CREATE INDEX idx_user_department ON "User"(departmentId);

-- Leave table indexes
CREATE INDEX idx_leave_user ON "Leave"(userId);
CREATE INDEX idx_leave_dates ON "Leave"(startDate, endDate);
CREATE INDEX idx_leave_status ON "Leave"(status);
```

---

## API Architecture

### RESTful API Design

```
Resource: Employees
├── GET    /api/employees          → List all employees
├── GET    /api/employees/:id      → Get single employee
├── POST   /api/employees          → Create employee
├── PUT    /api/employees/:id      → Update employee
└── DELETE /api/employees/:id      → Delete employee

Resource: Departments
├── GET    /api/departments         → List all departments
├── POST   /api/departments         → Create department
├── PUT    /api/departments/:id     → Update department
└── DELETE /api/departments/:id     → Delete department

Resource: Attendance
├── GET    /api/attendance          → Query attendance (with filters)
├── GET    /api/attendance/:id      → Get single record
├── POST   /api/attendance          → Create record
├── PUT    /api/attendance/:id      → Update record
└── DELETE /api/attendance/:id      → Delete record

Resource: Breaks
├── GET    /api/breaks              → Query breaks
├── POST   /api/breaks              → Start break
├── PUT    /api/breaks/:id          → End break
└── DELETE /api/breaks/:id          → Delete break

Resource: Leaves
├── GET    /api/leaves              → Query leaves
├── GET    /api/leaves/:id          → Get single leave
├── POST   /api/leaves              → Create leave
├── PUT    /api/leaves/:id          → Update leave
└── DELETE /api/leaves/:id          → Delete leave
```

### API Request/Response Flow

```
┌─────────┐
│ Client  │
└────┬────┘
     │ HTTP Request
     │ GET /api/employees
     ↓
┌─────────────────────┐
│ Next.js API Route   │
│ /api/employees/     │
│ route.ts            │
└────┬────────────────┘
     │ 1. Parse request
     │ 2. Validate params
     ↓
┌─────────────────────┐
│ Prisma Client       │
│ prisma.user.findMany│
└────┬────────────────┘
     │ SQL Query
     ↓
┌─────────────────────┐
│ PostgreSQL Database │
└────┬────────────────┘
     │ Result Set
     ↓
┌─────────────────────┐
│ Prisma Client       │
│ Transform to JS     │
└────┬────────────────┘
     │ JavaScript Objects
     ↓
┌─────────────────────┐
│ API Route           │
│ NextResponse.json() │
└────┬────────────────┘
     │ HTTP Response
     │ JSON Data
     ↓
┌─────────┐
│ Client  │
│ Process │
└─────────┘
```

---

## Component Architecture

### Component Hierarchy

```
App
├── Layout (Root)
│   ├── Metadata
│   └── Global Styles
│
├── (user) Route Group
│   └── /user
│       └── UserDashboard Component
│           ├── Status Indicator
│           ├── Department Select
│           ├── Employee Select
│           ├── Mode Select
│           ├── Action Buttons
│           │   ├── Clock In Button
│           │   ├── Break Button
│           │   └── Clock Out Button
│           └── Attendance Table
│               ├── Table Header
│               ├── Table Body
│               └── Department Filter
│
└── (dashboard) Route Group
    └── /admin
        ├── Admin Layout
        │   ├── Sidebar Navigation
        │   └── Header
        │
        ├── Dashboard Page
        │   ├── Metrics Cards
        │   ├── Activity Feed
        │   ├── Department Chart
        │   └── Trends Chart
        │
        ├── Employees Page
        │   ├── Employee Table
        │   ├── Search Input
        │   ├── Add Dialog
        │   ├── Edit Dialog
        │   └── Delete Dialog
        │
        ├── Departments Page
        │   ├── Department List
        │   ├── Add Dialog
        │   └── Edit Dialog
        │
        ├── History Page
        │   ├── Filter Panel
        │   ├── Attendance Table
        │   └── Export Button
        │
        ├── Manual Entry Page
        │   └── Entry Form
        │
        ├── Reports Page
        │   ├── Report Type Select
        │   ├── Date Range Picker
        │   └── Export Button
        │
        └── Settings Page
            └── Password Change Form
```

### State Management Flow

```
Component State (useState)
         ↓
    User Action
         ↓
   Event Handler
         ↓
    API Call (fetch)
         ↓
   Backend Processing
         ↓
   Database Update
         ↓
    API Response
         ↓
   Update State
         ↓
   Re-render Component
```

---

## Authentication Flow

### Admin Login Process

```
┌─────────┐
│  Admin  │
└────┬────┘
     │ 1. Navigate to /admin-login
     ↓
┌─────────────────────┐
│ Login Form          │
│ - Email input       │
│ - Password input    │
│ - Submit button     │
└────┬────────────────┘
     │ 2. Submit credentials
     ↓
┌─────────────────────┐
│ POST /api/auth/     │
│ admin-login         │
└────┬────────────────┘
     │ 3. Validate credentials
     ↓
┌─────────────────────┐
│ Prisma Query        │
│ Find user by email  │
└────┬────────────────┘
     │ 4. User found?
     ↓
┌─────────────────────┐
│ Compare Password    │
│ bcrypt.compare()    │
└────┬────────────────┘
     │ 5. Password match?
     ↓
┌─────────────────────┐
│ Create Session      │
│ NextAuth.js         │
└────┬────────────────┘
     │ 6. Set cookie
     ↓
┌─────────────────────┐
│ Redirect to /admin  │
└─────────────────────┘
```

---

## Real-Time Update Mechanism

### Polling Strategy

```
Component Mount
     ↓
┌─────────────────────┐
│ Initial Data Fetch  │
└────┬────────────────┘
     │
     ↓
┌─────────────────────┐
│ Set Interval        │
│ (10 seconds)        │
└────┬────────────────┘
     │
     ↓ Every 10s
┌─────────────────────┐
│ Fetch Latest Data   │
│ GET /api/attendance │
└────┬────────────────┘
     │
     ↓
┌─────────────────────┐
│ Update State        │
│ setAttendanceRecords│
└────┬────────────────┘
     │
     ↓
┌─────────────────────┐
│ Re-render Table     │
│ (React updates DOM) │
└─────────────────────┘
     ↑
     │ Loop continues
     └─────────────────
```

### Code Implementation

```typescript
useEffect(() => {
  // Initial fetch
  fetchTodayAttendance()
  
  // Set up polling
  const interval = setInterval(fetchTodayAttendance, 10000)
  
  // Cleanup on unmount
  return () => clearInterval(interval)
}, [])
```

---

## Data Flow Diagrams

### Clock In Data Flow

```
User Action: Click "Clock In"
         ↓
handleClockIn() function
         ↓
Validate: name && mode selected?
         ↓
Check existing record
         ↓
GET /api/attendance?date=today&userId=xxx
         ↓
Record exists?
    ├─ Yes → PUT /api/attendance/:id
    │        Update clockOut=null, status=PRESENT
    │
    └─ No  → POST /api/attendance
             Create new record
         ↓
Prisma Operation
         ↓
Database Insert/Update
         ↓
Return attendance record
         ↓
Update component state
    ├─ setStatus('clocked-in')
    ├─ setClockInTime(...)
    └─ fetchTodayAttendance()
         ↓
UI Updates
    ├─ Status indicator → Green
    ├─ Show clock in time
    ├─ Disable Clock In button
    └─ Enable Break/Clock Out buttons
```

### Break Management Data Flow

```
User Action: Click "Break"
         ↓
handleBreak() function
         ↓
Check current status
    ├─ On Break? → End break
    │              PUT /api/breaks/:id
    │              { endTime: now }
    │
    └─ Clocked In? → Start break
                     POST /api/breaks
                     { userId, date, startTime: now }
         ↓
Prisma Operation
         ↓
Database Insert/Update
         ↓
Return break record
         ↓
Update component state
    ├─ setStatus('on-break' or 'clocked-in')
    ├─ setActiveBreakId(...)
    └─ fetchTodayAttendance()
         ↓
UI Updates
    ├─ Status indicator → Orange or Green
    ├─ Button text changes
    └─ Table updates
```

---

## Performance Optimization

### Database Query Optimization

```
Before Optimization:
┌─────────────────────────────────┐
│ SELECT * FROM "Attendance"      │
│ WHERE date >= '2024-01-01'      │
│ (Full table scan)               │
│ Time: 500ms                     │
└─────────────────────────────────┘

After Optimization:
┌─────────────────────────────────┐
│ SELECT * FROM "Attendance"      │
│ WHERE date >= '2024-01-01'      │
│ (Index scan on date)            │
│ Time: 50ms                      │
└─────────────────────────────────┘

Optimization Applied:
- Added index on date column
- Added composite index on (userId, date)
- Limited result set with pagination
```

### Frontend Optimization

```
Component Rendering Optimization:

1. Memoization
   ├─ useMemo for filtered data
   ├─ useCallback for event handlers
   └─ React.memo for child components

2. Lazy Loading
   ├─ Code splitting with dynamic imports
   ├─ Lazy load heavy components
   └─ Pagination for large tables

3. Debouncing
   ├─ Search input debounced (300ms)
   └─ Filter changes debounced

4. Virtual Scrolling
   └─ For tables with 1000+ rows
```

---

## Security Architecture

### Security Layers

```
┌─────────────────────────────────────────┐
│         Application Security             │
├─────────────────────────────────────────┤
│ 1. Input Validation                     │
│    ├─ Client-side validation            │
│    └─ Server-side validation            │
│                                          │
│ 2. Authentication                        │
│    ├─ NextAuth.js session management    │
│    ├─ Password hashing (bcrypt)         │
│    └─ Secure cookie handling            │
│                                          │
│ 3. Authorization                         │
│    ├─ Role-based access control         │
│    └─ Route protection                  │
│                                          │
│ 4. Data Protection                       │
│    ├─ SQL injection prevention (Prisma) │
│    ├─ XSS prevention (React escaping)   │
│    └─ CSRF protection                   │
│                                          │
│ 5. API Security                          │
│    ├─ Rate limiting                     │
│    ├─ Request validation                │
│    └─ Error handling (no data leaks)    │
│                                          │
│ 6. Database Security                     │
│    ├─ Connection encryption (SSL)       │
│    ├─ Least privilege access            │
│    └─ Prepared statements               │
└─────────────────────────────────────────┘
```

---

## Deployment Architecture

### Production Deployment

```
┌─────────────────────────────────────────────────────────┐
│                    Load Balancer                         │
│                   (HTTPS/SSL)                            │
└────────────────────┬────────────────────────────────────┘
                     │
        ┌────────────┴────────────┐
        ↓                         ↓
┌───────────────┐         ┌───────────────┐
│  Next.js App  │         │  Next.js App  │
│   Instance 1  │         │   Instance 2  │
└───────┬───────┘         └───────┬───────┘
        │                         │
        └────────────┬────────────┘
                     ↓
        ┌────────────────────────┐
        │  PostgreSQL Database   │
        │  (Primary + Replica)   │
        └────────────────────────┘
                     ↓
        ┌────────────────────────┐
        │   Backup Storage       │
        │   (Daily backups)      │
        └────────────────────────┘
```

### Scalability Strategy

```
Vertical Scaling (Single Instance):
├─ Increase CPU/RAM
├─ Optimize database queries
└─ Add caching layer

Horizontal Scaling (Multiple Instances):
├─ Load balancer distribution
├─ Stateless application design
├─ Shared database connection pool
└─ Session storage in database/Redis

Database Scaling:
├─ Read replicas for queries
├─ Write to primary database
├─ Connection pooling
└─ Query optimization
```

---

## Monitoring & Logging

### Application Monitoring

```
┌─────────────────────────────────────────┐
│         Monitoring Stack                 │
├─────────────────────────────────────────┤
│                                          │
│ 1. Application Logs                     │
│    ├─ Error logs                        │
│    ├─ Access logs                       │
│    └─ Performance logs                  │
│                                          │
│ 2. Database Monitoring                   │
│    ├─ Query performance                 │
│    ├─ Connection pool usage             │
│    └─ Slow query log                    │
│                                          │
│ 3. System Metrics                        │
│    ├─ CPU usage                         │
│    ├─ Memory usage                      │
│    ├─ Disk I/O                          │
│    └─ Network traffic                   │
│                                          │
│ 4. Application Metrics                   │
│    ├─ Request rate                      │
│    ├─ Response time                     │
│    ├─ Error rate                        │
│    └─ Active users                      │
│                                          │
│ 5. Alerts                                │
│    ├─ High error rate                   │
│    ├─ Slow response time                │
│    ├─ Database connection issues        │
│    └─ Disk space low                    │
└─────────────────────────────────────────┘
```

---

## Technology Stack Details

### Frontend Stack

```
React 19
├─ Component-based architecture
├─ Hooks for state management
├─ Virtual DOM for performance
└─ JSX syntax

Next.js 16
├─ App Router (file-based routing)
├─ Server Components
├─ API Routes (backend)
├─ Image optimization
└─ Built-in TypeScript support

TypeScript
├─ Static type checking
├─ Enhanced IDE support
├─ Better refactoring
└─ Compile-time error detection

Tailwind CSS
├─ Utility-first CSS
├─ Responsive design
├─ Custom design system
└─ JIT compiler

Radix UI + shadcn/ui
├─ Accessible components
├─ Customizable styling
├─ Consistent design
└─ TypeScript support
```

### Backend Stack

```
Next.js API Routes
├─ RESTful API design
├─ Serverless functions
├─ Built-in request handling
└─ TypeScript support

Prisma ORM
├─ Type-safe database client
├─ Migration system
├─ Schema modeling
└─ Query builder

PostgreSQL
├─ ACID compliance
├─ JSON support
├─ Full-text search
└─ Robust indexing

NextAuth.js
├─ Authentication
├─ Session management
├─ Multiple providers
└─ Secure by default
```

---

## File Structure Details

```
/Users/ooodevops/Desktop/Attendance/
│
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── (dashboard)/              # Admin route group
│   │   │   └── admin/
│   │   │       ├── layout.tsx        # Admin layout with sidebar
│   │   │       ├── page.tsx          # Dashboard
│   │   │       ├── employees/        # Staff management
│   │   │       ├── departments/      # Department management
│   │   │       ├── history/          # Attendance history
│   │   │       ├── manual-entry/     # Manual entry
│   │   │       ├── reports/          # Reports
│   │   │       └── settings/         # Settings
│   │   │
│   │   ├── (user)/                   # Employee route group
│   │   │   └── user/
│   │   │       └── page.tsx          # Employee dashboard
│   │   │
│   │   ├── admin-login/              # Admin login
│   │   │   └── page.tsx
│   │   │
│   │   ├── api/                      # Backend API routes
│   │   │   ├── attendance/
│   │   │   │   ├── route.ts          # GET, POST
│   │   │   │   └── [id]/
│   │   │   │       └── route.ts      # GET, PUT, DELETE
│   │   │   ├── auth/
│   │   │   ├── breaks/
│   │   │   ├── departments/
│   │   │   ├── employees/
│   │   │   ├── leaves/
│   │   │   └── settings/
│   │   │
│   │   ├── layout.tsx                # Root layout
│   │   ├── page.tsx                  # Root page (redirects)
│   │   └── globals.css               # Global styles
│   │
│   └── components/
│       └── ui/                       # Reusable UI components
│           ├── button.tsx
│           ├── card.tsx
│           ├── dialog.tsx
│           ├── input.tsx
│           ├── select.tsx
│           └── ... (20 components)
│
├── prisma/
│   ├── schema.prisma                 # Database schema
│   ├── seed.ts                       # Database seeding
│   └── migrations/                   # Migration files
│
├── public/                           # Static assets
│   └── favicon.ico
│
├── .env                              # Environment variables
├── .gitignore                        # Git ignore rules
├── docker-compose.yml                # PostgreSQL container
├── next.config.ts                    # Next.js configuration
├── package.json                      # Dependencies
├── tsconfig.json                     # TypeScript config
├── tailwind.config.ts                # Tailwind config
├── DOCUMENTATION.md                  # Full documentation
├── QUICK_REFERENCE.md                # Quick reference
└── README.md                         # Project readme
```

---

## Conclusion

This technical architecture document provides a comprehensive overview of the Redadair Attendance System's structure, data flow, and technical implementation. It serves as a reference for developers, architects, and technical stakeholders to understand how the system works and how to extend or maintain it.

For implementation details, see `DOCUMENTATION.md`.  
For quick reference, see `QUICK_REFERENCE.md`.

---

**Document Version**: 1.0  
**Last Updated**: December 16, 2025  
**Maintained By**: Development Team
