# MarcOn

React (Vite) + Express + MongoDB (Mongoose), cookie sessions stored in MongoDB.

## Run
1. `cp backend/.env.example backend/.env` — set `MONGODB_URI` (local `mongodb://127.0.0.1:27017` or Atlas) and a `SESSION_SECRET` of 32+ characters.
2. `npm install` (installs `gsap` too)
3. `npm run admin:create -w backend` — creates the first CEO from the `INITIAL_ADMIN_*` vars. Remove the password var afterwards.
4. `npm run dev` → http://localhost:5173 (API on :4000, health at `/api/health/ready`). Vite proxies `/api` to the backend, so no frontend `.env` is needed in development.

Set `APP_TIMEZONE` (default `Asia/Kolkata`) so attendance days roll over at local midnight, not UTC.

## What works
- Login / logout, server-side sessions, rate-limited login
- Overview stats (org-wide for CEO/HR, personal for others)
- Attendance: check in / check out, 31-day history. If you checked in on an earlier day and never checked out, you can't check in again until you have sent a correction request for that day (the Attendance page shows a banner with a one-click "Request correction")
- Corrections: employees request a missing check-in/out (validated against the day, one pending request per day); CEO/HR approve or reject and the employee is notified
- Reports (CEO/HR, `/reports`): month picker, org KPIs, people-per-day column chart, ranking by hours or days, sortable table, and a per-person drill-down with a bar per day. **Export Excel** downloads a workbook with Summary, Daily log and Leave sheets
- Dashboard (CEO/HR): "Out of office today" roster plus who starts leave in the next 7 days
- Leave: request, list own; CEO/HR approve/reject (conditional update, cannot review your own)
- People (CEO/HR): list, add, activate/deactivate
- No screenshot/monitoring code.

## Not yet done
Transactional email delivery and binary file storage need production provider configuration. Verify against your own MongoDB before relying on it.

## Reports API (CEO/HR)

| Endpoint | Returns |
| --- | --- |
| `GET /api/reports/month?month=YYYY-MM` | totals, per-day head-count, one summary row per active person |
| `GET /api/reports/employee/:id?month=YYYY-MM` | one person's summary and every day of the month |
| `GET /api/reports/export?month=YYYY-MM` | `.xlsx` (Summary, Daily log, Leave); audited as `ATTENDANCE_REPORT_EXPORTED` |

A working day is a weekday that is not a holiday. Days before a person's account was created are not counted against them, and today is never "absent" until the day is over. Hours come from check-in to check-out; a past day with no check-out counts as a missed punch-out with 0 hours until a correction is approved.

## Role and permission matrix

| Area | Employee | Manager | HR | CEO |
| --- | --- | --- | --- | --- |
| Personal attendance, leave, corrections, work items | Own records | Own records | Own records | Own records |
| Team leave and overtime approvals | — | Direct reports only | Organization | Organization |
| People, departments, schedules, shifts | — | View assigned team via approvals | Manage | Manage |
| Leave policy, payroll, audit log, analytics | — | — | Manage/view | Manage/view |
| Announcements and document vault | Read/acknowledge own | Read/acknowledge own | Publish/manage | Publish/manage |
| MFA | Optional | Optional | Required/enrollable | Required/enrollable |
| Organizations | — | — | — | Manage |

## Multi-tenant migration

Before deploying tenant isolation over an existing database, run `npm run tenant:migrate -w backend`. It assigns existing records to the `default` organization and updates user uniqueness indexes to be organization-scoped.
