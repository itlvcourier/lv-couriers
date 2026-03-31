#!/usr/bin/env node

/**
 * Script to create demo Supabase Auth users
 * Usage: SUPABASE_URL=... SUPABASE_ANON_KEY=... SUPABASE_SERVICE_KEY=... node scripts/create-demo-auth-users.js
 */

const https = require('https');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables are required');
  process.exit(1);
}

const demoAccounts = [
  {
    email: 'business@demo.lvcouriers.com',
    password: 'Demo@Business123',
    user_id: '11000000-0000-0000-0000-000000000001',
    role: 'business',
  },
  {
    email: 'driver@demo.lvcouriers.com',
    password: 'Demo@Driver123',
    user_id: '22000000-0000-0000-0000-000000000001',
    role: 'driver',
  },
  {
    email: 'admin@demo.lvcouriers.com',
    password: 'Demo@Admin123',
    user_id: '33000000-0000-0000-0000-000000000001',
    role: 'admin',
  },
];

function makeRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(SUPABASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port || 443,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        apikey: SUPABASE_SERVICE_KEY,
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            data: data ? JSON.parse(data) : null,
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            data,
          });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function createDemoUsers() {
  console.log('Creating demo Supabase Auth accounts...\n');

  for (const account of demoAccounts) {
    try {
      console.log(`Creating ${account.role} account: ${account.email}`);

      const response = await makeRequest('/auth/v1/admin/users', 'POST', {
        email: account.email,
        password: account.password,
        email_confirm: true,
        user_metadata: {
          role: account.role,
        },
      });

      if (response.status === 200 || response.status === 201) {
        console.log(`✓ Created ${account.email}`);
        console.log(`  Role: ${account.role}`);
        console.log(`  User ID: ${account.user_id}`);
      } else {
        console.error(`✗ Failed to create ${account.email}`);
        console.error(`  Status: ${response.status}`);
        console.error(`  Response: ${JSON.stringify(response.data)}`);
      }
    } catch (error) {
      console.error(`✗ Error creating ${account.email}:`, error.message);
    }
    console.log();
  }

  console.log('\n=== Demo Account Credentials ===');
  console.log('Business Account:');
  console.log('  Email: business@demo.lvcouriers.com');
  console.log('  Password: Demo@Business123');
  console.log();
  console.log('Driver Account:');
  console.log('  Email: driver@demo.lvcouriers.com');
  console.log('  Password: Demo@Driver123');
  console.log();
  console.log('Admin Account:');
  console.log('  Email: admin@demo.lvcouriers.com');
  console.log('  Password: Demo@Admin123');
  console.log();
  console.log('Note: Change these passwords after first login for security.');
}

createDemoUsers().catch(console.error);
