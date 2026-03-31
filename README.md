# LV Couriers - Delivery Operations Management System (DOMS)

Production-ready delivery management platform built with Next.js 15, Supabase, and React.

## 🚀 Quick Start

### Demo Accounts

| Role | Email | Password |
|------|-------|----------|
| Business | business@demo.lvcouriers.com | Demo@123 |
| Driver | driver@demo.lvcouriers.com | Demo@123 |
| Admin | admin@demo.lvcouriers.com | Demo@123 |

### Features by Role

**Driver Portal**
- Browse available delivery jobs
- Claim single or batch deliveries (multi-stop)
- Track active deliveries with optimized route sequencing
- View delivery history and earnings
- Auto-optimized delivery sequence by priority & distance

**Business Portal**
- Post new deliveries with batch support
- Track all deliveries in real-time
- Live driver location tracking on map
- View delivery status and history
- Receive notifications on status changes

**Admin Portal**
- System dashboard with analytics
- Manage drivers and businesses
- Send driver email invitations
- View all deliveries and system activity
- Post jobs on behalf of businesses

## 📦 Tech Stack

- **Frontend**: Next.js 15, React 19, TypeScript
- **Styling**: Tailwind CSS v4, shadcn/ui components
- **Database**: Supabase PostgreSQL with RLS
- **Maps**: Leaflet (OpenStreetMap)
- **Auth**: Supabase Auth with email/password
- **Real-time**: Supabase Realtime for live tracking
- **Forms**: React Hook Form, Zod validation

## 🏗️ Project Structure

```
app/
├── auth/              # Authentication pages (login, signup)
├── driver/            # Driver portal routes
├── business/          # Business portal routes
├── admin/             # Admin portal routes
├── api/               # API routes for operations
└── page.tsx           # Home page (redirects to auth)

components/
├── driver/            # Driver-specific components
├── business/          # Business-specific components
├── admin/             # Admin-specific components
├── maps/              # Map and tracking components
└── shared/            # Reusable components

lib/
├── db.ts              # Database operations
├── types.ts           # TypeScript types
├── auth-actions.ts    # Auth utilities
├── route-utils.ts     # Route optimization
├── live-tracking.ts   # Location tracking
├── notifications.ts   # Notification system
└── supabase/          # Supabase client setup
```

## 🗄️ Database Schema

### Tables
- **businesses** - Business accounts with contact info
- **drivers** - Driver profiles with ratings & status
- **deliveries** - Delivery jobs with pickup/dropoff details
- **status_history** - Delivery status change logs
- **activity_events** - System activity tracking
- **driver_locations** - Real-time GPS coordinates

### Key Features
- RLS (Row Level Security) enabled for all tables
- Bundle grouping for multi-stop pickups
- Coordinate fields for distance calculations
- Proper indexing for performance

## 🔐 Authentication

- Email/password authentication via Supabase Auth
- Role-based routing (automatic redirect after login)
- Email verification required
- Session management with secure cookies
- Driver onboarding via email invites

## 🗺️ Route Optimization

Automatic delivery sequencing based on:
- Priority level (rush vs standard)
- Distance from pickup (Haversine calculation)
- Previous stop location
- Manual drag-drop reordering available

## 📍 Live Tracking

- Browser geolocation every 15 seconds while on delivery
- Real-time map updates via Supabase Realtime
- Business sees driver location for their deliveries only
- ETA calculations based on distance

## 🔔 Notifications

- Browser push notifications for status changes
- Email confirmations for key events
- In-app toast notifications
- Customizable notification preferences (future)

## 📊 Admin Features

- Create drivers with temporary passwords
- Send email invitations to drivers
- View system analytics and activity
- Manage business and driver accounts
- Post jobs on behalf of businesses

## 🧪 Testing

1. Visit http://localhost:3000
2. Login with demo credentials (see Quick Start)
3. Test page available at /test for database connectivity check
4. Explore each portal's features

## 📝 Development

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build
npm start
```

## 🚀 Deployment

1. Deploy to Vercel: `vercel`
2. Set environment variables in Vercel dashboard
3. Database migrations run automatically on first deploy
4. RLS policies protect data access

## 📚 API Routes

- `POST /api/deliveries` - Create delivery
- `PUT /api/deliveries/[id]` - Update delivery status
- `POST /api/drivers/invite` - Send driver invitation
- `POST /api/locations` - Update driver location

## 🛠️ Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

## 📄 License

MIT

## 📧 Support

For issues or questions, contact: support@lvcouriers.com
