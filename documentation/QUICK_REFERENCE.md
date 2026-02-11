# Redadair Attendance System - Quick Reference Guide

## 🚀 Quick Start

### For Employees
1. Open browser to `http://localhost:3000/user`
2. Select Department → Select Name → Choose Work Mode
3. Click **Clock In** to start work
4. Click **Break** to pause work
5. Click **Clock Out** to end work

### For Administrators
1. Open browser to `http://localhost:3000/admin-login`
2. Login with credentials
3. Access dashboard and management tools

---

## 📋 Common Tasks

### Employee Tasks

| Task | Steps |
|------|-------|
| **Clock In** | Select Dept → Select Name → Choose Mode → Click "Clock In" |
| **Take Break** | Click "Break" button (must be clocked in) |
| **End Break** | Click "Break" button again |
| **Clock Out** | Click "Clock Out" button |
| **View Status** | Scroll to "Today's Attendance Status" table |
| **Filter by Dept** | Use department dropdown above attendance table |

### Admin Tasks

| Task | Navigation | Action |
|------|-----------|--------|
| **Add Employee** | Staff Management → Add Staff Member | Fill form → Submit |
| **Edit Employee** | Staff Management → Edit icon | Update fields → Save |
| **Delete Employee** | Staff Management → Delete icon | Confirm deletion |
| **Create Department** | Departments → Add Department | Enter name → Create |
| **View History** | History → Set filters | Apply filters → View |
| **Manual Entry** | Manual Entry → Fill form | Submit entry |
| **Generate Report** | Reports → Select type | Choose filters → Export |
| **Change Password** | Settings → Password section | Enter passwords → Submit |

---

## 🔑 Default Credentials

**Admin Login**:
- Email: `admin@redadair.com`
- Password: `admin123`

⚠️ **Change these in production!**

---

## 🌐 URL Reference

| Page | URL | Access |
|------|-----|--------|
| Employee Portal | `/user` | Public |
| Admin Login | `/admin-login` | Public |
| Admin Dashboard | `/admin` | Admin only |
| Staff Management | `/admin/employees` | Admin only |
| Departments | `/admin/departments` | Admin only |
| Attendance History | `/admin/history` | Admin only |
| Manual Entry | `/admin/manual-entry` | Admin only |
| Reports | `/admin/reports` | Admin only |
| Settings | `/admin/settings` | Admin only |

---

## 🎨 Status Indicators

### Employee Portal
| Color | Status | Meaning |
|-------|--------|---------|
| 🟢 Green | Currently Working | Employee is clocked in |
| 🟠 Orange | On Break | Employee is taking a break |
| 🟣 Purple | On Leave | Employee has approved leave |
| ⚪ Gray | Ready to Clock In | Employee is clocked out |

### Attendance Table
| Badge | Status |
|-------|--------|
| 🟢 Green "Clocked In" | Currently working |
| 🟣 Purple "On Leave" | On approved leave |
| ⚫ Gray "Clocked Out" | Not currently working |

---

## 🔧 Technical Quick Reference

### Development Commands
```bash
# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run linter
npm run lint
```

### Database Commands
```bash
# Generate Prisma Client
npx prisma generate

# Create migration
npx prisma migrate dev --name description

# Deploy migrations (production)
npx prisma migrate deploy

# Open Prisma Studio
npx prisma studio

# Seed database
npx prisma db seed

# Reset database (WARNING: deletes all data)
npx prisma migrate reset
```

### Docker Commands
```bash
# Start PostgreSQL
docker-compose up -d

# Stop PostgreSQL
docker-compose down

# View logs
docker-compose logs -f

# Restart database
docker-compose restart
```

---

## 📊 Database Schema Quick Reference

### Main Tables
- **User**: Employees and admins
- **Department**: Organizational units
- **Attendance**: Daily work records
- **Break**: Break periods within attendance
- **Leave**: Approved absences

### Key Relationships
- User → Department (many-to-one)
- User → Attendance (one-to-many)
- Attendance → Break (one-to-many)
- User → Leave (one-to-many)

---

## 🔌 API Endpoints Quick Reference

### Employees
- `GET /api/employees` - List all
- `POST /api/employees` - Create new
- `PUT /api/employees/:id` - Update
- `DELETE /api/employees/:id` - Delete

### Departments
- `GET /api/departments` - List all
- `POST /api/departments` - Create new
- `PUT /api/departments/:id` - Update
- `DELETE /api/departments/:id` - Delete

### Attendance
- `GET /api/attendance?date=YYYY-MM-DD&userId=xxx` - Query
- `POST /api/attendance` - Create record
- `PUT /api/attendance/:id` - Update record
- `DELETE /api/attendance/:id` - Delete record

### Breaks
- `GET /api/breaks?userId=xxx&date=YYYY-MM-DD` - Query
- `POST /api/breaks` - Start break
- `PUT /api/breaks/:id` - End break
- `DELETE /api/breaks/:id` - Delete break

### Leaves
- `GET /api/leaves` - List all
- `POST /api/leaves` - Create leave
- `PUT /api/leaves/:id` - Update leave
- `DELETE /api/leaves/:id` - Delete leave

---

## 🐛 Troubleshooting Quick Fixes

### Application Won't Start
```bash
rm -rf .next node_modules
npm install
npm run dev
```

### Database Connection Error
```bash
docker-compose restart
npx prisma generate
```

### TypeScript Errors
```bash
npx prisma generate
# Then restart VS Code TypeScript server
```

### Build Errors
```bash
rm -rf .next
npx prisma generate
npm run build
```

### Port Already in Use
```bash
# Find process using port 3000
lsof -i :3000

# Kill process
kill -9 <PID>
```

---

## 📱 Work Modes

| Mode | Icon | When to Use |
|------|------|-------------|
| Office | 🏢 | Working from company premises |
| WFH | 🏠 | Working from home/remotely |
| Other | 📍 | Client site, field work, etc. |

---

## ⏰ Attendance Statuses

| Status | Description | Auto-Set When |
|--------|-------------|---------------|
| PRESENT | Employee worked | Clock in |
| ABSENT | Employee didn't work | No clock in by end of day |
| LATE | Employee arrived late | Clock in after 9:00 AM |
| HALF_DAY | Partial day work | Less than 4 hours worked |
| LEAVE | Approved absence | Leave record exists |

---

## 🔐 Security Checklist

### Production Deployment
- [ ] Change default admin password
- [ ] Use strong NEXTAUTH_SECRET
- [ ] Enable HTTPS
- [ ] Use production DATABASE_URL
- [ ] Set up database backups
- [ ] Configure CORS properly
- [ ] Enable rate limiting
- [ ] Set up monitoring/logging
- [ ] Review environment variables
- [ ] Test authentication flow

---

## 📈 Performance Tips

### Frontend
- Tables auto-refresh every 10 seconds
- Use department filters to reduce data load
- Export reports instead of viewing large datasets
- Clear browser cache if experiencing slowness

### Backend
- Database indexes on date and userId fields
- Prisma query optimization
- Connection pooling enabled
- Efficient date range queries

---

## 💾 Backup & Recovery

### Quick Backup
```bash
# Backup database
pg_dump -h localhost -U user attendance_db > backup_$(date +%Y%m%d).sql

# Restore database
psql -h localhost -U user attendance_db < backup_20251216.sql
```

### What to Backup
- PostgreSQL database
- `.env` file (securely)
- Uploaded files (if any)
- Custom configurations

---

## 📞 Support Contacts

| Issue Type | Contact |
|------------|---------|
| Technical Issues | dev@redadair.com |
| User Support | support@redadair.com |
| Admin Access | admin@redadair.com |
| Emergency | [Emergency contact] |

---

## 🎯 Best Practices

### For Employees
- ✅ Clock in at start of work day
- ✅ Take breaks as needed
- ✅ Clock out at end of day
- ✅ Select correct work mode
- ❌ Don't share login credentials
- ❌ Don't clock in for others

### For Administrators
- ✅ Review attendance daily
- ✅ Approve/reject leaves promptly
- ✅ Keep employee data updated
- ✅ Generate regular reports
- ✅ Backup database regularly
- ❌ Don't delete records without backup
- ❌ Don't share admin credentials

---

## 📚 Additional Resources

- **Full Documentation**: `DOCUMENTATION.md`
- **API Documentation**: See API Endpoints section in full docs
- **Database Schema**: See `prisma/schema.prisma`
- **Environment Setup**: See Installation section in full docs

---

## 🔄 Version Information

- **Current Version**: 1.0.0
- **Last Updated**: December 16, 2025
- **Next.js Version**: 16.0.4
- **React Version**: 19.2.0
- **Node.js Required**: 18+

---

## ⚡ Keyboard Shortcuts (Future)

| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl + K` | Quick search |
| `Esc` | Close dialog |
| `Cmd/Ctrl + S` | Save form |
| `Cmd/Ctrl + E` | Export data |

---

## 🎨 UI Component Reference

### Buttons
- **Primary**: Green (Clock In, Submit, Save)
- **Secondary**: Gray (Cancel, Back)
- **Destructive**: Red (Delete, Clock Out)
- **Outline**: White with border (Edit, Break)

### Form Fields
- **Required**: Marked with asterisk (*)
- **Optional**: No asterisk
- **Disabled**: Grayed out, not clickable
- **Error**: Red border with error message

### Dialogs
- **Add**: Create new record
- **Edit**: Modify existing record
- **Delete**: Confirm deletion
- **Info**: Display information

---

**Quick Reference Version**: 1.0  
**For Full Documentation**: See `DOCUMENTATION.md`
