# CBC Facilities Management Platform - Complete Deployment Guide

## 🎯 What You're Getting

A complete enterprise work order management system with:

- **Real-time multi-user access** - Multiple facility managers, area directors, vendors, and technicians working simultaneously
- **PostgreSQL database** - Persistent data via Supabase (no local storage limits)
- **Role-based access control** - Different views and permissions for Admin, Facility Manager, Facility Director, Vendor, Technician
- **Work order lifecycle management** - Track from creation through completion
- **Approval workflows** - Cost-based approval routing
- **Real-time dashboards** - Metrics, analytics, reporting
- **Audit trail** - Every change tracked with user and timestamp
- **Mobile responsive** - Works on phones, tablets, computers
- **Email notifications** - Status changes, approvals, assignments
- **File attachments** - Upload proposals, invoices, photos
- **Vendor management** - Performance tracking, ratings
- **Location analytics** - Cost by store, open items by location

---

## 📋 Quick Start (10 minutes)

### 1. Sign Up for Supabase (FREE)

1. Go to https://supabase.com
2. Click "Start your project"
3. Sign in with Google or GitHub
4. Create organization → Create project "CBC-Facilities"
5. Wait for project to initialize (~1 min)
6. Go to **Settings → API** and copy:
   - **Project URL** (starts with `https://xxxxx.supabase.co`)
   - **anon public key**
   - **service_role key** (scroll right)

Save these - you'll need them in a few minutes.

---

## 🏗️ Local Setup (Your Computer)

### Prerequisites

You need to install:
- **Node.js** (https://nodejs.org) - v16 or higher
- **Git** (https://git-scm.com) - for cloning

Verify installation:
```bash
node --version    # Should show v16+
npm --version     # Should show 8+
```

### Step 1: Create Database Tables

1. Go to your Supabase project
2. Click **SQL Editor** (left sidebar)
3. Click **New Query**
4. Copy & paste this entire SQL block:

```sql
-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255),
  role VARCHAR(50) NOT NULL DEFAULT 'technician',
  location_id UUID,
  vendor_id UUID,
  phone VARCHAR(20),
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Locations table
CREATE TABLE IF NOT EXISTS locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL UNIQUE,
  address VARCHAR(255),
  city VARCHAR(100),
  state VARCHAR(2),
  zip VARCHAR(10),
  region VARCHAR(50),
  phone VARCHAR(20),
  manager_id UUID REFERENCES users(id),
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Vendors table
CREATE TABLE IF NOT EXISTS vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL UNIQUE,
  contact_person VARCHAR(255),
  email VARCHAR(255),
  phone VARCHAR(20),
  service_types TEXT[],
  contract_start DATE,
  contract_end DATE,
  rate_per_hour DECIMAL(10,2),
  active BOOLEAN DEFAULT true,
  rating DECIMAL(3,2),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Work Orders table
CREATE TABLE IF NOT EXISTS work_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wo_number VARCHAR(50) UNIQUE NOT NULL,
  location_id UUID NOT NULL REFERENCES locations(id),
  equipment VARCHAR(255),
  equipment_type VARCHAR(100),
  description TEXT,
  priority VARCHAR(20) DEFAULT 'L4-Standard',
  status VARCHAR(50) DEFAULT 'Open',
  vendor_id UUID REFERENCES vendors(id),
  assigned_to UUID REFERENCES users(id),
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  scheduled_start DATE,
  scheduled_end DATE,
  actual_start TIMESTAMP,
  actual_end TIMESTAMP,
  estimated_cost DECIMAL(10,2),
  actual_cost DECIMAL(10,2),
  invoice_amount DECIMAL(10,2),
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMP,
  warranty_claim BOOLEAN DEFAULT false,
  notes TEXT,
  updated_at TIMESTAMP DEFAULT NOW(),
  updated_by UUID REFERENCES users(id)
);

-- Work Order Updates
CREATE TABLE IF NOT EXISTS work_order_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id UUID NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  status VARCHAR(50),
  note TEXT,
  updated_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- File Attachments
CREATE TABLE IF NOT EXISTS attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id UUID REFERENCES work_orders(id) ON DELETE CASCADE,
  file_name VARCHAR(255),
  file_type VARCHAR(50),
  file_url VARCHAR(500),
  uploaded_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Approval Rules
CREATE TABLE IF NOT EXISTS approval_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID REFERENCES locations(id),
  cost_threshold DECIMAL(10,2),
  approver_id UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Audit Log
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type VARCHAR(100),
  entity_id UUID,
  action VARCHAR(50),
  old_values JSONB,
  new_values JSONB,
  changed_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_work_orders_location ON work_orders(location_id);
CREATE INDEX idx_work_orders_vendor ON work_orders(vendor_id);
CREATE INDEX idx_work_orders_status ON work_orders(status);
CREATE INDEX idx_work_orders_created ON work_orders(created_at);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_locations_name ON locations(name);
```

Click **Run** - should take ~2 seconds.

---

### Step 2: Clone Backend

```bash
# Create project directory
mkdir -p ~/cbc-facilities-platform
cd ~/cbc-facilities-platform

# Create backend folder
mkdir backend
cd backend

# Initialize Node project
npm init -y

# Install dependencies
npm install express cors dotenv pg@latest @supabase/supabase-js bcryptjs jsonwebtoken nodemailer uuid

# Create .env file
cat > .env << 'EOF'
SUPABASE_URL=YOUR_PROJECT_URL_HERE
SUPABASE_KEY=YOUR_ANON_KEY_HERE
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY_HERE
JWT_SECRET=super_secret_key_change_this_in_production
PORT=3001
NODE_ENV=development
EOF
```

**⚠️ Important:** Replace the three values in `.env` with your Supabase credentials:
- `YOUR_PROJECT_URL_HERE` → Paste your Project URL
- `YOUR_ANON_KEY_HERE` → Paste your anon public key
- `YOUR_SERVICE_ROLE_KEY_HERE` → Paste your service_role key

Copy the server code:
```bash
# Copy server.js (provided in output files)
# Then start backend
npm start
```

You should see: `✅ CBC Facilities API running on http://localhost:3001`

---

### Step 3: Clone Frontend

In a **NEW terminal**:

```bash
cd ~/cbc-facilities-platform

# Create React app
npx create-react-app frontend

cd frontend

# Install packages
npm install axios react-router-dom zustand @tanstack/react-query date-fns

# Copy App.jsx and App.css (provided in output files)
# Then create .env
cat > .env << 'EOF'
REACT_APP_API_URL=http://localhost:3001
EOF

# Start frontend
npm start
```

Browser should open to http://localhost:3000 with login screen.

---

### Step 4: Create Admin User

In a **NEW terminal**:

```bash
# Register admin user
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@cbc.com",
    "password": "Admin123!@",
    "fullName": "Admin User",
    "role": "admin"
  }'
```

Success response:
```json
{
  "user": {
    "id": "uuid-here",
    "email": "admin@cbc.com",
    "fullName": "Admin User",
    "role": "admin"
  },
  "token": "jwt-token-here"
}
```

Now login at http://localhost:3000 with:
- Email: `admin@cbc.com`
- Password: `Admin123!@`

✅ **You're live locally!**

---

## 🚀 Deploy to Production (Cloud)

### Option A: Deploy Frontend to Vercel (Recommended)

Easiest deployment - takes 5 minutes:

1. Push code to GitHub
2. Go to https://vercel.com
3. Click "New Project"
4. Select your GitHub repo
5. Add environment variable:
   - `REACT_APP_API_URL` = Your backend URL (you'll get this below)
6. Click Deploy

Vercel gives you a live URL like `https://cbc-facilities.vercel.app`

### Option B: Deploy Backend to Heroku

1. Install Heroku CLI: https://devcenter.heroku.com/articles/heroku-cli
2. Login: `heroku login`
3. Create app: `heroku create cbc-facilities-api`
4. Add environment variables:
   ```bash
   heroku config:set SUPABASE_URL=your_url
   heroku config:set SUPABASE_KEY=your_key
   heroku config:set SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   heroku config:set JWT_SECRET=change_this_to_random_key
   ```
5. Deploy: `git push heroku main`

Heroku gives you a URL like `https://cbc-facilities-api.herokuapp.com`

Then update frontend `.env`:
```
REACT_APP_API_URL=https://cbc-facilities-api.herokuapp.com
```

---

## 👥 User Roles & Permissions

After creating admin account, add your team with roles:

### Admin
- Manage all work orders
- Manage users
- Configure approval rules
- View all analytics
- Access audit logs

### Facility Manager
- Create work orders at all locations
- Assign to vendors
- Approve WOs up to their limit
- View all location analytics

### Facility Director
- Create/manage WOs at assigned location only
- Cannot approve (need manager approval)
- View analytics for their location

### Vendor
- See only assigned work orders
- Update status on assigned WOs
- Upload files/notes
- Cannot create new WOs

### Technician
- See assigned work orders
- Update status (Open → In Progress → Completed)
- Add notes
- Upload before/after photos

---

## 📊 Key Features

### Dashboard
- Real-time metrics (Total WOs, Open, In Progress, Completed)
- Total cost tracking
- Status breakdown

### Work Orders
- Search by ID, equipment, location
- Filter by status, vendor, location
- Sort by date, cost, location
- Inline status updates
- View full details
- Add notes
- Upload files (proposals, invoices, photos)

### Reports
- Vendor performance (count, cost, completion %)
- Location analysis (cost per store, open items)
- Status breakdown with costs
- Budget tracking

### Admin Features
- User management
- Role assignment
- Approval rule configuration
- Audit trail

---

## 🔒 Security Best Practices

1. **Change JWT Secret** in production:
   ```
   JWT_SECRET=your_random_32_char_string_here
   ```

2. **Use strong passwords** for all accounts

3. **Enable Supabase Auth** (comes with Supabase)

4. **Set up HTTPS** (automatic on Vercel/Heroku)

5. **Regular backups** (Supabase handles this)

6. **Restrict API access** in Supabase:
   - Go to Auth → Policies
   - Set row-level security on sensitive tables

---

## 📱 Mobile Access

The platform is fully responsive. Users can:
- View dashboards on phones
- Update work order status in the field
- Upload photos from mobile devices
- Add notes
- See assignments

Access from any browser on any device.

---

## 🆘 Troubleshooting

### "Connection refused" error
- Make sure backend is running: `npm start` in backend folder
- Check port 3001 is not blocked

### "Database error" 
- Verify Supabase credentials in .env
- Make sure all tables were created
- Check database is active in Supabase console

### Login not working
- Verify admin user was created: `curl http://localhost:3001/api/health`
- Check password is correct
- Look for errors in browser console (F12 → Console tab)

### Frontend not connecting to backend
- Check REACT_APP_API_URL in frontend/.env
- Make sure backend is running
- Check browser console for CORS errors

### Work orders not loading
- Verify you have created locations (Step 3)
- Check browser console for error messages
- Try creating a work order manually through the form

---

## 📞 Support

Common issues & solutions:

**"CORS error when loading work orders"**
- Backend not running - start it: `npm start`
- Wrong API URL in frontend .env - verify it matches backend URL

**"Database connection failed"**
- Check Supabase credentials in .env
- Verify Supabase project status in console
- Try creating new project if issues persist

**"Work orders showing but no data"**
- Need to import data or create first WO manually
- Or run data import script (coming next)

**"Can't deploy to Vercel/Heroku"**
- Verify Node.js version >= 16
- Push to GitHub first
- Check Vercel/Heroku build logs for detailed errors

---

## 🎓 Next Steps

1. ✅ Setup and launch (what we just did)
2. 📥 Load your 10,000 existing work orders:
   - Use provided import-data.js script
   - Or manually upload via dashboard
3. 👥 Add your team:
   - Use Admin panel to create user accounts
   - Assign roles and locations
4. ⚙️ Configure:
   - Set approval rules by location
   - Add vendors
   - Configure notifications
5. 🎓 Train team:
   - Share login credentials
   - Show how to create/update work orders
   - Demo reports

---

## 📊 Your Platform is Ready

You now have an enterprise-grade work order management system that:
- ✅ Handles multiple users simultaneously
- ✅ Stores data permanently in PostgreSQL
- ✅ Provides real-time dashboards
- ✅ Tracks every change (audit trail)
- ✅ Works on phones and tablets
- ✅ Scales with your team
- ✅ Can integrate with other systems

**Total setup time: ~15 minutes** ⏱️

Questions? Check Supabase docs or ask your local developer for help! 🚀
