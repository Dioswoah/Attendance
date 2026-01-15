# Redadair Attendance System - Complete Documentation

## Table of Contents
1. [Executive Summary](#executive-summary)
2. [System Overview](#system-overview)
3. [Technical Architecture](#technical-architecture)
4. [User Roles & Access](#user-roles--access)
5. [Features & Functionality](#features--functionality)
6. [Database Schema](#database-schema)
7. [API Endpoints](#api-endpoints)
8. [Installation & Setup](#installation--setup)
9. [User Guide](#user-guide)
10. [Developer Guide](#developer-guide)
11. [Deployment](#deployment)
12. [Maintenance & Troubleshooting](#maintenance--troubleshooting)

---

## Executive Summary

The **Redadair Attendance System** is a modern, web-based employee time tracking and attendance management application built with Next.js 16. It provides real-time attendance tracking, department management, leave management, and comprehensive reporting capabilities.

### Key Benefits
- ✅ Real-time attendance tracking with automatic updates every 10 seconds
- ✅ Support for multiple work modes (Office, Work From Home, Other)
- ✅ Break time tracking with start/end timestamps
- ✅ Department-based organization
- ✅ Leave management system
- ✅ Comprehensive admin dashboard with analytics
- ✅ Mobile-responsive design
- ✅ Secure authentication system

### Technology Stack
- **Frontend**: Next.js 16 (React 19), TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: NextAuth.js v5
- **UI Components**: Radix UI, shadcn/ui
- **Charts**: Recharts

---

## System Overview

### Application Purpose
The Redadair Attendance System streamlines employee time tracking by providing:
1. **Employee Self-Service**: Clock in/out, take breaks, view attendance status
2. **Administrative Control**: Manage employees, departments, attendance records, and leaves
3. **Real-Time Monitoring**: Live dashboard showing who's currently working
4. **Historical Reporting**: Track attendance patterns, generate reports, export data

### Access Points
- **Employee Portal**: `http://localhost:3000/user` (Default landing page)
- **Admin Login**: `http://localhost:3000/admin-login`
- **Admin Dashboard**: `http://localhost:3000/admin` (After authentication)

---

## Technical Architecture

### Application Structure
```
Attendance/
├── src/
│   ├── app/
│   │   ├── (dashboard)/          # Admin dashboard routes (protected)
│   │   │   └── admin/
│   │   │       ├── page.tsx      # Main admin dashboard
│   │   │       ├── employees/    # Staff management
│   │   │       ├── departments/  # Department management
│   │   │       ├── history/      # Attendance history
│   │   │       ├── manual-entry/ # Manual attendance entry
│   │   │       ├── reports/      # Reports & analytics
│   │   │       └── settings/     # System settings
│   │   ├── (user)/               # Employee routes (public)
│   │   │   └── user/
│   │   │       └── page.tsx      # Employee attendance interface
│   │   ├── admin-login/          # Admin authentication
│   │   ├── api/                  # Backend API routes
│   │   │   ├── attendance/       # Attendance CRUD operations
│   │   │   ├── auth/             # Authentication endpoints
│   │   │   ├── breaks/           # Break management
│   │   │   ├── departments/      # Department operations
│   │   │   ├── employees/        # Employee CRUD
│   │   │   ├── leaves/           # Leave management
│   │   │   └── settings/         # System settings
│   │   └── page.tsx              # Root redirect to /user
│   └── components/
│       └── ui/                   # Reusable UI components
├── prisma/
│   ├── schema.prisma             # Database schema
│   └── seed.ts                   # Database seeding script
├── public/                       # Static assets
├── .env                          # Environment variables
├── docker-compose.yml            # PostgreSQL container config
└── package.json                  # Dependencies
```

### Technology Decisions

#### Why Next.js 16?
- **App Router**: Modern routing with server/client components
- **API Routes**: Built-in backend without separate server
- **Server-Side Rendering**: Better performance and SEO
- **TypeScript Support**: Type safety throughout the application

#### Why PostgreSQL?
- **ACID Compliance**: Ensures data integrity for attendance records
- **Relational Data**: Perfect for employee-department-attendance relationships
- **Scalability**: Can handle growing employee base
- **JSON Support**: Flexible for future feature additions

#### Why Prisma?
- **Type Safety**: Auto-generated TypeScript types
- **Migration System**: Version-controlled database changes
- **Developer Experience**: Intuitive query API
- **Database Agnostic**: Easy to switch databases if needed

---

## User Roles & Access

### 1. Employee (USER Role)
**Access**: `/user` (No authentication required for demo purposes)

**Capabilities**:
- Select department and name
- Clock in/out
- Choose work mode (Office/WFH/Other)
- Start/end breaks
- View personal attendance status
- View real-time attendance of all employees
- Filter attendance by department

**Limitations**:
- Cannot modify other employees' records
- Cannot access admin features
- Cannot manage departments or employees

### 2. Administrator (ADMIN Role)
**Access**: `/admin-login` → `/admin` (Requires authentication)

**Capabilities**:
- All employee capabilities
- Manage employees (Create, Read, Update, Delete)
- Manage departments
- Manual attendance entry/correction
- View attendance history with filters
- Generate and export reports (Excel)
- Manage leave requests
- Change admin password
- View analytics dashboard

---

## Features & Functionality

### Employee Portal (`/user`)

#### 1. Clock In/Out System
**How It Works**:
1. Employee selects their department from dropdown
2. Employee selects their name (filtered by department)
3. Employee chooses work mode:
   - 🏢 **Office**: Working from company premises
   - 🏠 **Work From Home**: Remote work
   - 📍 **Other**: Field work, client site, etc.
4. Click "Clock In" to start work session
5. Click "Clock Out" to end work session

**Business Logic**:
- One attendance record per employee per day
- Clock in time is recorded with timestamp
- Clock out time is recorded when session ends
- Duration is automatically calculated
- Status is set to "PRESENT" on clock in

#### 2. Break Management
**How It Works**:
1. Employee must be clocked in
2. Click "Break" button to start break
3. Status changes to "On Break" (orange indicator)
4. Click "Break" again to end break
5. Multiple breaks can be taken per day

**Technical Details**:
- Each break is stored as a separate record
- Linked to attendance record via `attendanceId`
- Tracks `startTime` and `endTime`
- Active breaks have `endTime = null`
- Break duration is calculated and displayed in admin dashboard

#### 3. Real-Time Attendance Table
**Features**:
- Auto-refreshes every 10 seconds
- Shows all employees' current status
- Filterable by department
- Color-coded status badges:
  - 🟢 **Green**: Clocked In
  - 🟪 **Purple**: On Leave
  - ⚫ **Gray**: Clocked Out

**Displayed Information**:
- Employee name
- Department
- Status (Clocked In/Out/On Leave)
- Clock in time
- Clock out time
- Work mode

#### 4. Leave Status Display
**How It Works**:
- If employee has approved leave for today, status shows "On Leave"
- Clock in button is disabled
- Purple status indicator displayed
- Message: "Enjoy your time off!"

### Admin Dashboard (`/admin`)

#### 1. Dashboard Overview
**Key Metrics**:
- 👥 **Total Employees**: Count of all registered employees
- ✅ **Present Today**: Employees currently clocked in
- ⏰ **Late Arrivals**: Employees who clocked in after 9:00 AM
- 📅 **On Leave**: Employees with approved leave today

**Real-Time Activity Feed**:
- Shows last 10 attendance actions
- Includes clock in, clock out, and break events
- Displays employee name, action type, and timestamp
- Color-coded by action type

**Department Breakdown**:
- Pie chart showing employee distribution by department
- Interactive legend
- Percentage and count for each department

**Attendance Trends**:
- Line chart showing daily attendance over last 7 days
- Tracks present, absent, and late employees
- Helps identify patterns

#### 2. Staff Management (`/admin/employees`)
**Features**:
- View all employees in searchable table
- Search by name or email
- Add new employees
- Edit employee details
- Delete employees (with confirmation)
- Assign departments
- Set roles (USER/ADMIN)

**Add Employee Form**:
```
Fields:
- Name (required)
- Email (required, unique)
- Department (optional)
- Role (USER/ADMIN)
```

**Edit Employee**:
- Pre-populated form with current values
- Can update all fields except ID
- Email must remain unique

**Delete Employee**:
- Confirmation dialog required
- Cascading delete removes all attendance records
- Cannot be undone

#### 3. Department Management (`/admin/departments`)
**Features**:
- Create departments
- View all departments
- Edit department names
- Delete departments (if no employees assigned)

**Business Rules**:
- Department names must be unique
- Cannot delete department with assigned employees
- Employees can be reassigned to different departments

#### 4. Attendance History (`/admin/history`)
**Filters**:
- Date range (start date - end date)
- Department filter
- Employee filter
- Status filter (Present/Absent/Late/Leave)

**Displayed Information**:
- Employee name and department
- Date
- Clock in/out times
- Total hours worked
- Break duration
- Status
- Work mode

**Actions**:
- View detailed attendance record
- Edit attendance (manual correction)
- Delete attendance record

#### 5. Manual Entry (`/admin/manual-entry`)
**Use Cases**:
- Correct missed clock in/out
- Add attendance for employees who forgot
- Adjust times for legitimate reasons

**Form Fields**:
- Employee selection
- Date
- Clock in time
- Clock out time
- Work mode
- Status
- Notes (optional)

**Validation**:
- Clock out must be after clock in
- Cannot create duplicate records for same employee/date
- Date cannot be in the future

#### 6. Reports (`/admin/reports`)
**Report Types**:
1. **Daily Report**: All attendance for selected date
2. **Weekly Report**: 7-day attendance summary
3. **Monthly Report**: Full month attendance
4. **Employee Report**: Individual employee history

**Export Options**:
- Excel (.xlsx) format
- Includes all relevant fields
- Formatted for easy reading
- Can be imported into other systems

**Report Contents**:
- Employee details
- Attendance dates
- Clock in/out times
- Duration worked
- Break times
- Status
- Work mode

#### 7. Leave Management (`/admin/leaves`)
**Features**:
- View all leave requests
- Approve/reject requests
- Create leave on behalf of employee
- Edit leave details
- Delete leave records

**Leave Types**:
- Sick Leave
- Vacation
- Personal Leave
- Emergency Leave
- Other

**Leave Duration**:
- **Whole Day**: Full day off
- **Part Day**: Specify start and end times

**Leave Status**:
- 🟡 **Pending**: Awaiting approval
- 🟢 **Approved**: Confirmed leave
- 🔴 **Rejected**: Denied request

#### 8. Settings (`/admin/settings`)
**Current Features**:
- Change admin password
- Password confirmation required
- Secure password hashing

**Future Expansion**:
- Work hours configuration
- Late threshold settings
- Break duration limits
- Email notifications
- Company holidays

---

## Database Schema

### Entity Relationship Diagram

```
User (Employee)
├── id: String (Primary Key)
├── name: String
├── email: String (Unique)
├── password: String (Hashed)
├── role: Role (ADMIN/USER)
├── departmentId: String (Foreign Key)
└── Relationships:
    ├── department: Department
    ├── attendance: Attendance[]
    └── leaves: Leave[]

Department
├── id: String (Primary Key)
├── name: String (Unique)
└── Relationships:
    └── users: User[]

Attendance
├── id: String (Primary Key)
├── userId: String (Foreign Key)
├── date: DateTime
├── clockIn: DateTime
├── clockOut: DateTime
├── status: AttendanceStatus
├── mode: WorkMode
├── duration: Int (minutes)
└── Relationships:
    ├── user: User
    └── breaks: Break[]

Break
├── id: String (Primary Key)
├── attendanceId: String (Foreign Key)
├── startTime: DateTime
├── endTime: DateTime
└── Relationships:
    └── attendance: Attendance

Leave
├── id: String (Primary Key)
├── userId: String (Foreign Key)
├── startDate: DateTime
├── endDate: DateTime
├── type: String
├── reason: String
├── status: String (PENDING/APPROVED/REJECTED)
├── duration: String (WHOLE_DAY/PART_DAY)
└── Relationships:
    └── user: User
```

### Enums

```typescript
enum Role {
  ADMIN
  USER
}

enum AttendanceStatus {
  PRESENT
  ABSENT
  LATE
  HALF_DAY
  LEAVE
}

enum WorkMode {
  OFFICE
  WFH
  OTHER
}
```

### Key Constraints

1. **Unique Constraints**:
   - User email must be unique
   - Department name must be unique
   - One attendance record per user per date

2. **Cascade Deletes**:
   - Deleting user deletes all their attendance records
   - Deleting attendance deletes all associated breaks
   - Deleting user deletes all their leave records

3. **Required Fields**:
   - User: email
   - Attendance: userId, date
   - Break: attendanceId, startTime
   - Leave: userId, startDate, endDate, type

---

## API Endpoints

### Authentication
```
POST /api/auth/admin-login
- Body: { email, password }
- Returns: { success, user }
- Purpose: Admin login
```

### Employees
```
GET /api/employees
- Returns: Employee[]
- Purpose: Get all employees

GET /api/employees/:id
- Returns: Employee
- Purpose: Get single employee

POST /api/employees
- Body: { name, email, departmentId?, role? }
- Returns: Employee
- Purpose: Create employee

PUT /api/employees/:id
- Body: { name?, email?, departmentId?, role? }
- Returns: Employee
- Purpose: Update employee

DELETE /api/employees/:id
- Returns: { success }
- Purpose: Delete employee
```

### Departments
```
GET /api/departments
- Returns: Department[]
- Purpose: Get all departments

POST /api/departments
- Body: { name }
- Returns: Department
- Purpose: Create department

PUT /api/departments/:id
- Body: { name }
- Returns: Department
- Purpose: Update department

DELETE /api/departments/:id
- Returns: { success }
- Purpose: Delete department
```

### Attendance
```
GET /api/attendance
- Query: date?, userId?, departmentId?, startDate?, endDate?
- Returns: Attendance[]
- Purpose: Get attendance records with filters

GET /api/attendance/:id
- Returns: Attendance
- Purpose: Get single attendance record

POST /api/attendance
- Body: { userId, clockIn, mode, status }
- Returns: Attendance
- Purpose: Create attendance record

PUT /api/attendance/:id
- Body: { clockIn?, clockOut?, mode?, status? }
- Returns: Attendance
- Purpose: Update attendance record

DELETE /api/attendance/:id
- Returns: { success }
- Purpose: Delete attendance record
```

### Breaks
```
GET /api/breaks
- Query: userId?, date?
- Returns: Break[]
- Purpose: Get break records

POST /api/breaks
- Body: { userId, date, startTime }
- Returns: Break
- Purpose: Start break

PUT /api/breaks/:id
- Body: { endTime }
- Returns: Break
- Purpose: End break

DELETE /api/breaks/:id
- Returns: { success }
- Purpose: Delete break
```

### Leaves
```
GET /api/leaves
- Query: userId?, status?, startDate?, endDate?
- Returns: Leave[]
- Purpose: Get leave records

GET /api/leaves/:id
- Returns: Leave
- Purpose: Get single leave record

POST /api/leaves
- Body: { userId, startDate, endDate, type, reason?, duration, status? }
- Returns: Leave
- Purpose: Create leave request

PUT /api/leaves/:id
- Body: { startDate?, endDate?, type?, status?, etc. }
- Returns: Leave
- Purpose: Update leave record

DELETE /api/leaves/:id
- Returns: { success }
- Purpose: Delete leave record
```

### Settings
```
PUT /api/settings/password
- Body: { currentPassword, newPassword }
- Returns: { success }
- Purpose: Change admin password
```

---

## Installation & Setup

### Prerequisites
- **Node.js**: v18 or higher
- **npm**: v9 or higher
- **Docker**: For PostgreSQL database (or local PostgreSQL installation)
- **Git**: For version control

### Step 1: Clone Repository
```bash
cd /Users/ooodevops/Desktop/Attendance
# Repository is already cloned
```

### Step 2: Install Dependencies
```bash
npm install
```

This installs:
- Next.js 16
- React 19
- Prisma
- NextAuth.js
- Radix UI components
- Tailwind CSS
- TypeScript
- And all other dependencies

### Step 3: Environment Setup

Create `.env` file in project root:
```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/attendance_db"

# NextAuth
NEXTAUTH_SECRET="your-secret-key-here"
NEXTAUTH_URL="http://localhost:3000"

# Admin Credentials (for seeding)
ADMIN_EMAIL="admin@redadair.com"
ADMIN_PASSWORD="admin123"
```

**Important**: Change these values in production!

### Step 4: Start Database

Using Docker:
```bash
docker-compose up -d
```

This starts PostgreSQL container with:
- Port: 5432
- Database: attendance_db
- User: user
- Password: password

Or use local PostgreSQL:
```bash
# Install PostgreSQL
brew install postgresql

# Start PostgreSQL
brew services start postgresql

# Create database
createdb attendance_db
```

### Step 5: Database Migration
```bash
# Generate Prisma Client
npx prisma generate

# Run migrations
npx prisma migrate dev --name init

# Seed database (optional)
npx prisma db seed
```

Seeding creates:
- 3 departments (Engineering, Sales, HR)
- 10 sample employees
- 1 admin user (admin@redadair.com / admin123)
- Sample attendance records

### Step 6: Start Development Server
```bash
npm run dev
```

Application runs on: `http://localhost:3000`

### Step 7: Verify Installation

1. Open browser to `http://localhost:3000`
2. Should redirect to `/user` (Employee Portal)
3. Navigate to `http://localhost:3000/admin-login`
4. Login with admin credentials
5. Verify admin dashboard loads

---

## User Guide

### For Employees

#### How to Clock In
1. Go to `http://localhost:3000/user`
2. Select your **Department** from dropdown
3. Select your **Name** from dropdown (shows only employees in selected department)
4. Choose **Work Location**:
   - Office: If working from company premises
   - Work from Home: If working remotely
   - Other: If working from client site or other location
5. Click **Clock In** button (green)
6. Status changes to "Currently Working" with green background
7. Clock in time is displayed

#### How to Take a Break
1. Must be clocked in first
2. Click **Break** button (orange)
3. Status changes to "On Break" with orange background
4. Click **Break** again to end break
5. Status returns to "Currently Working"

#### How to Clock Out
1. Must be clocked in
2. Click **Clock Out** button (red)
3. Status changes to "Ready to Clock In"
4. Your attendance record is saved

#### Viewing Attendance Status
- Scroll down to see "Today's Attendance Status" table
- Shows all employees' current status
- Filter by department using dropdown
- Auto-refreshes every 10 seconds
- Green badge = Clocked In
- Purple badge = On Leave
- Gray badge = Clocked Out

### For Administrators

#### How to Login
1. Go to `http://localhost:3000/admin-login`
2. Enter admin email and password
3. Click "Sign In"
4. Redirects to admin dashboard

#### How to Add Employee
1. Navigate to **Staff Management** (sidebar)
2. Click **Add Staff Member** button
3. Fill in form:
   - Name (required)
   - Email (required, must be unique)
   - Department (optional)
   - Role (USER or ADMIN)
4. Click **Add Employee**
5. Employee appears in list

#### How to Edit Employee
1. Go to **Staff Management**
2. Find employee in list
3. Click **Edit** icon (pencil)
4. Update fields as needed
5. Click **Save Changes**

#### How to Delete Employee
1. Go to **Staff Management**
2. Find employee in list
3. Click **Delete** icon (trash)
4. Confirm deletion in dialog
5. Employee and all their attendance records are deleted

#### How to Create Department
1. Navigate to **Departments**
2. Click **Add Department**
3. Enter department name
4. Click **Create**

#### How to View Attendance History
1. Navigate to **History**
2. Use filters:
   - Date range
   - Department
   - Employee
   - Status
3. Click **Apply Filters**
4. View results in table
5. Export to Excel if needed

#### How to Make Manual Entry
1. Navigate to **Manual Entry**
2. Select employee
3. Choose date
4. Enter clock in time
5. Enter clock out time (optional)
6. Select work mode
7. Select status
8. Add notes (optional)
9. Click **Submit**

#### How to Generate Reports
1. Navigate to **Reports**
2. Select report type:
   - Daily
   - Weekly
   - Monthly
   - Employee-specific
3. Choose date range
4. Select filters (department, employee)
5. Click **Generate Report**
6. Click **Export to Excel** to download

#### How to Manage Leaves
1. Navigate to **Leaves** (if implemented)
2. View all leave requests
3. Click on request to view details
4. Approve or reject
5. Or create new leave on behalf of employee

#### How to Change Password
1. Navigate to **Settings**
2. Enter current password
3. Enter new password
4. Confirm new password
5. Click **Change Password**

---

## Developer Guide

### Project Structure Explained

#### Route Groups
- `(dashboard)`: Admin routes with shared layout
- `(user)`: Employee routes with different layout
- Parentheses prevent route group from appearing in URL

#### API Route Handlers
```typescript
// Example: /api/employees/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  const employees = await prisma.user.findMany({
    include: { department: true }
  })
  return NextResponse.json(employees)
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const employee = await prisma.user.create({
    data: body
  })
  return NextResponse.json(employee)
}
```

#### Client Components
```typescript
'use client' // Required for useState, useEffect, etc.

import { useState, useEffect } from 'react'

export default function Component() {
  const [data, setData] = useState([])
  
  useEffect(() => {
    fetch('/api/endpoint')
      .then(res => res.json())
      .then(setData)
  }, [])
  
  return <div>{/* JSX */}</div>
}
```

### Database Operations

#### Prisma Client Usage
```typescript
import { prisma } from '@/lib/prisma'

// Create
const user = await prisma.user.create({
  data: {
    name: 'John Doe',
    email: 'john@example.com',
    departmentId: 'dept-id'
  }
})

// Read
const users = await prisma.user.findMany({
  where: { departmentId: 'dept-id' },
  include: { department: true }
})

// Update
const updated = await prisma.user.update({
  where: { id: 'user-id' },
  data: { name: 'Jane Doe' }
})

// Delete
await prisma.user.delete({
  where: { id: 'user-id' }
})
```

#### Creating Migrations
```bash
# After modifying schema.prisma
npx prisma migrate dev --name description_of_change

# Example
npx prisma migrate dev --name add_team_model
```

### Adding New Features

#### Example: Adding a "Notes" Field to Attendance

1. **Update Schema** (`prisma/schema.prisma`):
```prisma
model Attendance {
  // ... existing fields
  notes String? // Add this line
}
```

2. **Create Migration**:
```bash
npx prisma migrate dev --name add_notes_to_attendance
```

3. **Update API** (`src/app/api/attendance/route.ts`):
```typescript
export async function POST(request: NextRequest) {
  const { userId, clockIn, mode, status, notes } = await request.json()
  
  const attendance = await prisma.attendance.create({
    data: {
      userId,
      clockIn: new Date(clockIn),
      mode,
      status,
      notes, // Add this
      date: new Date()
    }
  })
  
  return NextResponse.json(attendance)
}
```

4. **Update Frontend** (`src/app/(user)/user/page.tsx`):
```typescript
const [notes, setNotes] = useState('')

// In handleClockIn function
body: JSON.stringify({
  userId: name,
  clockIn: now,
  mode: mode.toUpperCase(),
  status: 'PRESENT',
  notes // Add this
})

// In JSX
<Input
  value={notes}
  onChange={(e) => setNotes(e.target.value)}
  placeholder="Add notes (optional)"
/>
```

### Common Development Tasks

#### Adding a New Page
```bash
# Create new route
mkdir -p src/app/(dashboard)/admin/new-page
touch src/app/(dashboard)/admin/new-page/page.tsx
```

```typescript
// src/app/(dashboard)/admin/new-page/page.tsx
export default function NewPage() {
  return (
    <div>
      <h1>New Page</h1>
    </div>
  )
}
```

#### Creating a New API Endpoint
```bash
mkdir -p src/app/api/new-endpoint
touch src/app/api/new-endpoint/route.ts
```

```typescript
// src/app/api/new-endpoint/route.ts
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  return NextResponse.json({ message: 'Hello' })
}
```

#### Adding a UI Component
```bash
# Using shadcn/ui
npx shadcn-ui@latest add button
npx shadcn-ui@latest add card
npx shadcn-ui@latest add dialog
```

### Testing

#### Manual Testing Checklist
- [ ] Employee can clock in
- [ ] Employee can take breaks
- [ ] Employee can clock out
- [ ] Admin can login
- [ ] Admin can add employee
- [ ] Admin can edit employee
- [ ] Admin can delete employee
- [ ] Admin can create department
- [ ] Attendance records are created correctly
- [ ] Real-time updates work
- [ ] Filters work correctly
- [ ] Export to Excel works

#### Database Testing
```bash
# Open Prisma Studio (GUI for database)
npx prisma studio

# Runs on http://localhost:5555
# Can view/edit all data
```

### Debugging

#### Common Issues

**Issue**: "Cannot find module '@prisma/client'"
```bash
# Solution
npx prisma generate
```

**Issue**: Database connection error
```bash
# Check if PostgreSQL is running
docker ps

# Restart database
docker-compose restart

# Check DATABASE_URL in .env
```

**Issue**: "Module not found" errors
```bash
# Clear Next.js cache
rm -rf .next

# Reinstall dependencies
rm -rf node_modules
npm install
```

**Issue**: TypeScript errors
```bash
# Regenerate Prisma types
npx prisma generate

# Restart TypeScript server in VS Code
# Cmd+Shift+P → "TypeScript: Restart TS Server"
```

### Code Style Guidelines

#### Naming Conventions
- **Components**: PascalCase (`UserDashboard.tsx`)
- **Functions**: camelCase (`handleClockIn`)
- **Constants**: UPPER_SNAKE_CASE (`MAX_BREAK_DURATION`)
- **Files**: kebab-case for routes (`admin-login`)

#### TypeScript
- Always define interfaces for data structures
- Use type inference where possible
- Avoid `any` type
- Use optional chaining (`?.`) for nullable values

#### React Best Practices
- Use functional components
- Extract reusable logic into custom hooks
- Keep components small and focused
- Use proper dependency arrays in useEffect

---

## Deployment

### Production Build

```bash
# Build application
npm run build

# Test production build locally
npm start
```

### Environment Variables (Production)

```env
# Database (use production PostgreSQL URL)
DATABASE_URL="postgresql://user:password@production-host:5432/attendance_db"

# NextAuth (use strong secret)
NEXTAUTH_SECRET="generate-strong-secret-here"
NEXTAUTH_URL="https://yourdomain.com"

# Admin (change default credentials)
ADMIN_EMAIL="admin@yourcompany.com"
ADMIN_PASSWORD="strong-password-here"
```

Generate secret:
```bash
openssl rand -base64 32
```

### Deployment Options

#### Option 1: Vercel (Recommended)
1. Push code to GitHub
2. Connect repository to Vercel
3. Add environment variables in Vercel dashboard
4. Deploy automatically on push

#### Option 2: Docker
```dockerfile
# Dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npx prisma generate
RUN npm run build

EXPOSE 3000
CMD ["npm", "start"]
```

```bash
# Build image
docker build -t attendance-system .

# Run container
docker run -p 3000:3000 --env-file .env attendance-system
```

#### Option 3: Traditional Server
```bash
# On server
git clone <repository>
cd attendance
npm install
npx prisma generate
npx prisma migrate deploy
npm run build

# Use PM2 for process management
npm install -g pm2
pm2 start npm --name "attendance" -- start
pm2 save
pm2 startup
```

### Database Migration (Production)

```bash
# Never use migrate dev in production
# Use migrate deploy instead
npx prisma migrate deploy
```

### Backup Strategy

#### Database Backups
```bash
# PostgreSQL backup
pg_dump -h localhost -U user attendance_db > backup.sql

# Restore
psql -h localhost -U user attendance_db < backup.sql

# Automated daily backups (cron)
0 2 * * * pg_dump -h localhost -U user attendance_db > /backups/attendance_$(date +\%Y\%m\%d).sql
```

### Monitoring

#### Health Checks
Create `/api/health/route.ts`:
```typescript
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`
    return NextResponse.json({ status: 'healthy' })
  } catch (error) {
    return NextResponse.json({ status: 'unhealthy' }, { status: 500 })
  }
}
```

#### Logging
- Use console.log for development
- Use proper logging service in production (e.g., Winston, Pino)
- Log errors, API calls, authentication attempts

---

## Maintenance & Troubleshooting

### Regular Maintenance Tasks

#### Weekly
- [ ] Review error logs
- [ ] Check database size
- [ ] Verify backups are running
- [ ] Test critical user flows

#### Monthly
- [ ] Update dependencies (`npm update`)
- [ ] Review and archive old attendance records
- [ ] Check for security updates
- [ ] Review user feedback

#### Quarterly
- [ ] Performance audit
- [ ] Security audit
- [ ] Database optimization
- [ ] Update documentation

### Common User Issues

#### "I can't clock in"
**Possible Causes**:
1. Department not selected
2. Name not selected
3. Work mode not selected
4. Already clocked in
5. On leave for today

**Solution**:
- Check all dropdowns are filled
- Verify not already clocked in (check status)
- Check if leave exists for today

#### "My attendance is not showing"
**Possible Causes**:
1. Wrong date filter
2. Wrong department filter
3. Database connection issue

**Solution**:
- Clear filters and try again
- Refresh page
- Check database connection

#### "I forgot to clock out yesterday"
**Solution**:
- Admin can use Manual Entry to add clock out time
- Navigate to Admin → Manual Entry
- Select employee, date, and add clock out time

### Database Maintenance

#### Clean Old Records
```sql
-- Delete attendance older than 2 years
DELETE FROM "Attendance"
WHERE date < NOW() - INTERVAL '2 years';

-- Delete old breaks
DELETE FROM "Break"
WHERE "createdAt" < NOW() - INTERVAL '2 years';
```

#### Optimize Database
```sql
-- Vacuum and analyze
VACUUM ANALYZE;

-- Reindex
REINDEX DATABASE attendance_db;
```

#### Check Database Size
```sql
SELECT
  pg_size_pretty(pg_database_size('attendance_db')) as size;
```

### Performance Optimization

#### Slow Queries
- Add indexes to frequently queried fields
- Use Prisma's query optimization
- Implement pagination for large datasets

```prisma
// Add index to schema
model Attendance {
  // ... fields
  
  @@index([date])
  @@index([userId, date])
}
```

#### Frontend Performance
- Implement lazy loading for large tables
- Use React.memo for expensive components
- Debounce search inputs
- Optimize images

### Security Best Practices

#### Password Security
- Always hash passwords (using bcrypt)
- Enforce strong password policy
- Implement password reset flow
- Use HTTPS in production

#### API Security
- Validate all inputs
- Sanitize user data
- Implement rate limiting
- Use CSRF protection

#### Database Security
- Use environment variables for credentials
- Limit database user permissions
- Enable SSL for database connections
- Regular security audits

### Troubleshooting Guide

#### Application Won't Start
```bash
# Check Node version
node --version  # Should be 18+

# Clear cache
rm -rf .next node_modules
npm install

# Check for port conflicts
lsof -i :3000
```

#### Database Connection Errors
```bash
# Check if PostgreSQL is running
docker ps

# Check connection string
echo $DATABASE_URL

# Test connection
npx prisma db pull
```

#### Build Errors
```bash
# Clear build cache
rm -rf .next

# Check TypeScript errors
npx tsc --noEmit

# Regenerate Prisma client
npx prisma generate
```

---

## Appendix

### Glossary

- **Clock In**: Recording the start of a work session
- **Clock Out**: Recording the end of a work session
- **Break**: Temporary pause during work session
- **Attendance Record**: Single day's work record for an employee
- **Work Mode**: Location/type of work (Office/WFH/Other)
- **Leave**: Approved absence from work
- **Department**: Organizational unit grouping employees
- **Admin**: User with administrative privileges
- **User**: Regular employee without admin access

### Keyboard Shortcuts

- **Admin Dashboard**: `Cmd/Ctrl + K` (if implemented)
- **Search**: Focus search input
- **Escape**: Close dialogs

### Browser Compatibility

- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+
- ⚠️ IE 11 (not supported)

### Mobile Support

- Responsive design works on all screen sizes
- Touch-friendly buttons and inputs
- Optimized for tablets and phones
- Tested on iOS and Android

### Support & Contact

For technical issues or questions:
- **Email**: dev@redadair.com
- **Documentation**: This file
- **Code Repository**: [GitHub URL]
- **Issue Tracker**: [GitHub Issues URL]

### Version History

- **v1.0.0** (Current): Initial release
  - Employee clock in/out
  - Break management
  - Admin dashboard
  - Department management
  - Attendance history
  - Reports and export

### Future Enhancements

Planned features:
- [ ] Email notifications
- [ ] Mobile app
- [ ] Biometric authentication
- [ ] Geolocation tracking
- [ ] Shift scheduling
- [ ] Overtime tracking
- [ ] Public holidays management
- [ ] Multi-language support
- [ ] Dark mode
- [ ] Advanced analytics

### License

[Specify your license here]

### Acknowledgments

Built with:
- Next.js
- React
- Prisma
- PostgreSQL
- Tailwind CSS
- Radix UI
- shadcn/ui

---

**Document Version**: 1.0
**Last Updated**: December 16, 2025
**Maintained By**: Development Team
**Next Review**: March 2026
