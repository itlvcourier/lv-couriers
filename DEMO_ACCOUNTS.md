# LV Couriers - Demo Accounts & Setup Guide

## Overview

LV Couriers is a production-ready delivery management system with three distinct user roles: Business, Driver, and Admin. This guide covers setting up demo accounts and testing the application.

## Database Schema

The database has been pre-configured with demo data:

### Businesses (3 demo accounts)
- **Downtown Deli** - Catering & food delivery
- **Vegas Auto Parts** - Auto parts distribution  
- **Lucky Pharmacy** - Prescription & medication delivery

### Drivers (4 demo accounts)
- **Marcus Johnson** - Available, 156 total deliveries, 4.9 rating
- **Sarah Chen** - On delivery, 243 total deliveries, 4.8 rating
- **Mike Rodriguez** - Available, 89 total deliveries, 4.7 rating
- **Emily Davis** - Offline, 67 total deliveries, 5.0 rating

### Sample Deliveries (8 demo records)
- 3 posted (available for drivers to claim)
- 1 claimed (driver assigned, not yet picked up)
- 1 in transit (actively being delivered)
- 3 delivered (completed)

## Demo Auth Accounts

The following demo auth accounts have been created and linked to the database:

### Business Demo Account
```
Email: business@demo.lvcouriers.com
Password: Demo@Business123
Role: Business
Permissions: Post deliveries, view own deliveries, live tracking
```

### Driver Demo Account
```
Email: driver@demo.lvcouriers.com
Password: Demo@Driver123
Role: Driver
Permissions: View available jobs, claim deliveries, complete deliveries, upload proof
```

### Admin Demo Account
```
Email: admin@demo.lvcouriers.com
Password: Demo@Admin123
Role: Admin
Permissions: Manage drivers, manage businesses, view all deliveries, invite drivers via email
```

## Creating Demo Auth Accounts

### Option 1: Using the Setup Script

If running locally, use the provided Node.js script:

```bash
# Set environment variables
export SUPABASE_URL="your-supabase-url"
export SUPABASE_ANON_KEY="your-anon-key"
export SUPABASE_SERVICE_KEY="your-service-key"

# Run the setup script
node scripts/create-demo-auth-users.js
```

### Option 2: Manual Setup via Supabase Dashboard

1. Go to your Supabase project dashboard
2. Navigate to Authentication > Users
3. Click "Create a new user"
4. Create each demo account with the credentials above
5. Ensure "Auto confirm user" is enabled
6. Add user metadata:
   - For business: `{ "role": "business" }`
   - For driver: `{ "role": "driver" }`
   - For admin: `{ "role": "admin" }`

## Testing the App

### 1. Test Business Portal
- Login with business account
- Post a new delivery or batch of deliveries from same location
- View live driver tracking when driver picks up delivery
- Receive notifications on delivery status changes

### 2. Test Driver Portal
- Login with driver account
- Browse available jobs (grouped by pickup location)
- Use "Claim All" to pick up multiple deliveries from same location
- View active deliveries with optimized route
- See numbered stops and ETAs
- Mark delivery as picked up and delivered
- Upload proof of delivery photos

### 3. Test Admin Portal
- Login with admin account
- View dashboard with real-time analytics
- Manage drivers (view, invite new, update status)
- Manage businesses (view, add new)
- View and filter all deliveries
- Generate and send driver invitation emails

## Key Features to Test

### Multi-Stop Deliveries
1. Post 2-3 deliveries from the same pickup address
2. As driver, use "Claim All" to pick all up
3. System auto-groups and optimizes route
4. Verify sequence is based on priority and distance

### Live Tracking
1. Post a delivery from Business account
2. Switch to Driver account and claim it
3. Mark as "Picked Up"
4. Return to Business account - see live driver location on map
5. Switch back to Driver and mark "Delivered" with photo

### Route Optimization
1. Claim multiple deliveries at different distances
2. Verify the app suggests the optimal sequence
3. Test manual drag-to-reorder functionality

### Driver Invitations
1. As Admin, navigate to Drivers section
2. Click "Invite Driver"
3. Enter email address
4. System generates temporary password
5. Driver receives email with login credentials

## Environment Variables

Ensure these are set in your Supabase project:

```
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

The service key is used server-side only and should never be exposed to clients.

## Resetting Demo Data

To clear all data and start fresh:

```sql
-- Delete all records (preserves schema)
DELETE FROM activity_events;
DELETE FROM status_history;
DELETE FROM deliveries;
DELETE FROM driver_locations;
DELETE FROM drivers;
DELETE FROM businesses;

-- Then re-seed with initial data using seed migration
```

## Production Notes

For production deployment:

1. **Change all demo passwords** before going live
2. **Delete demo accounts** or disable them
3. **Update RLS policies** - current demo uses permissive policies for testing
4. **Enable email verification** for new signups
5. **Set up proper email providers** (SendGrid, AWS SES) for invitations
6. **Configure environment properly** - use strong secrets
7. **Enable rate limiting** on auth endpoints
8. **Set up logging and monitoring** for auth events

## Troubleshooting

### Auth Errors
- Verify SUPABASE_URL and keys are correct
- Check that demo accounts exist in Supabase dashboard
- Ensure email confirmation is enabled for demo accounts

### Database Issues
- Check RLS policies allow the authenticated user
- Verify foreign key constraints for user_id linking
- Check that demo user_ids match between auth and database tables

### Tracking Not Working
- Verify browser geolocation permission is granted
- Check network tab for realtime subscription errors
- Ensure driver is on active delivery before tracking starts

## Support

For issues or questions, refer to:
- [Supabase Documentation](https://supabase.com/docs)
- [Next.js Documentation](https://nextjs.org/docs)
- Project README for architecture overview
