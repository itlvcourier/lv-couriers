# LV Couriers - Testing Guide

## Fixed Issues

The "Database error querying schema" issue has been resolved. The problem was:
1. Demo users were created with manually hashed passwords that didn't match Supabase Auth's format
2. This caused auth.users table to have corrupt data
3. When login attempted to query the schema, it failed

**Solution:** Deleted corrupt demo users and implemented proper signup flow using Supabase Auth SDK.

## How to Test

### 1. Create a Test Account

1. Go to `/auth/signup`
2. Enter an email and password (min 6 characters)
3. Select your role (Business or Driver)
4. Click "Create Account"
5. You should see "Account created! You can now sign in."

### 2. Sign In

1. Go to `/auth/login`
2. Enter the email and password you just created
3. Click "Sign in"
4. You'll be redirected to your dashboard:
   - **Business role** → `/business`
   - **Driver role** → `/driver`
   - **Admin role** → `/admin` (admin signup coming soon)

### 3. View Portal

Each portal shows placeholder content that loads data from your Supabase database:
- **Business Portal:** View and post deliveries
- **Driver Portal:** View available jobs, active deliveries, and history
- **Admin Portal:** Manage drivers, businesses, and deliveries

### 4. Sign Out

Click the "Sign Out" button in the bottom right corner of any portal.

## Demo Accounts

You can now create as many demo accounts as you want:

| Email | Password | Role |
|-------|----------|------|
| business@test.com | Test@123 | Business |
| driver@test.com | Test@123 | Driver |

## Database Schema

The database has all required tables:
- `auth.users` - Supabase Auth users
- `businesses` - Business accounts
- `drivers` - Driver accounts
- `deliveries` - Delivery requests
- `status_history` - Delivery status tracking
- `driver_locations` - Real-time driver locations
- `activity_events` - User activity logs

All tables have Row Level Security (RLS) policies enabled for data protection.

## Architecture

- **Auth:** Supabase Auth with email/password
- **Database:** Supabase PostgreSQL
- **Frontend:** Next.js 15 with React
- **UI Components:** shadcn/ui
- **Styling:** Tailwind CSS

## Next Steps

1. Test account creation and login
2. Create sample deliveries from business portal
3. Claim and complete deliveries from driver portal
4. Check admin portal for management features

All basic functionality is now working without schema errors!
