const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

dotenv.config();

const app = express();
app.use(cors());app.use(cors({
  origin: '*',
  credentials: true
}));
app.use(express.json());

// Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Middleware: Verify JWT token
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// Middleware: Check role
const checkRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
};

// ========== AUTH ROUTES ==========

app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, fullName, role = 'technician' } = req.body;

    if (!email || !password || !fullName) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user
    const { data: user, error: insertError } = await supabase
      .from('users')
      .insert([
        {
          id: uuidv4(),
          email: email.toLowerCase(),
          password_hash: passwordHash,
          full_name: fullName,
          role: role,
          active: true
        }
      ])
      .select()
      .single();

    if (insertError) {
      return res.status(400).json({ error: insertError.message });
    }

    // Generate token
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({
      user: { id: user.id, email: user.email, fullName: user.full_name, role: user.role },
      token
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    // Get user
    const { data: user, error: fetchError } = await supabase
      .from('users')
      .select('*')
      .eq('email', email.toLowerCase())
      .single();

    if (fetchError || !user) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    // Check password
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    // Generate token
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({
      user: { id: user.id, email: user.email, fullName: user.full_name, role: user.role },
      token
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========== WORK ORDERS ==========

app.get('/api/work-orders', verifyToken, async (req, res) => {
  try {
    const { status, vendor_id, location_id, search, sortBy = 'created_at' } = req.query;

    let query = supabase.from('work_orders').select(`
      *,
      location:locations(name, region),
      vendor:vendors(name, rating),
      assigned_to:users!assigned_to(full_name),
      created_by:users!created_by(full_name)
    `);

    // Filter by role
    if (req.user.role === 'facility_director') {
      const { data: userLocation } = await supabase
        .from('users')
        .select('location_id')
        .eq('id', req.user.id)
        .single();

      if (userLocation?.location_id) {
        query = query.eq('location_id', userLocation.location_id);
      }
    } else if (req.user.role === 'vendor') {
      const { data: vendor } = await supabase
        .from('users')
        .select('vendor_id')
        .eq('id', req.user.id)
        .single();

      if (vendor?.vendor_id) {
        query = query.eq('vendor_id', vendor.vendor_id);
      }
    }

    // Apply filters
    if (status) query = query.eq('status', status);
    if (vendor_id) query = query.eq('vendor_id', vendor_id);
    if (location_id) query = query.eq('location_id', location_id);
    if (search) {
      query = query.or(`wo_number.ilike.%${search}%,equipment.ilike.%${search}%`);
    }

    // Order
    const orderMap = {
      'newest': 'created_at.desc',
      'oldest': 'created_at.asc',
      'cost-high': 'estimated_cost.desc',
      'cost-low': 'estimated_cost.asc'
    };
    const orderBy = orderMap[sortBy] || 'created_at.desc';
    query = query.order(...orderBy.split('.'));

    const { data, error } = await query.limit(500);

    if (error) throw error;

    res.json({ data, count: data.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/work-orders/:id', verifyToken, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('work_orders')
      .select(`
        *,
        location:locations(*),
        vendor:vendors(*),
        assigned_to:users!assigned_to(full_name, email),
        created_by:users!created_by(full_name),
        updates:work_order_updates(*, updated_by:users(full_name)),
        attachments:attachments(*, uploaded_by:users(full_name))
      `)
      .eq('id', req.params.id)
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Work order not found' });

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/work-orders', verifyToken, checkRole(['admin', 'facility_manager', 'facility_director']), async (req, res) => {
  try {
    const {
      location_id,
      equipment,
      equipment_type,
      description,
      priority,
      vendor_id,
      estimated_cost
    } = req.body;

    // Generate WO number
    const woNumber = `WO-${Date.now()}`;

    const { data, error } = await supabase
      .from('work_orders')
      .insert([
        {
          id: uuidv4(),
          wo_number: woNumber,
          location_id,
          equipment,
          equipment_type,
          description,
          priority: priority || 'L4-Standard',
          vendor_id: vendor_id || null,
          status: 'Open',
          created_by: req.user.id,
          estimated_cost: estimated_cost || 0
        }
      ])
      .select()
      .single();

    if (error) throw error;

    // Log audit
    await supabase.from('audit_log').insert([
      {
        id: uuidv4(),
        entity_type: 'work_order',
        entity_id: data.id,
        action: 'create',
        new_values: data,
        changed_by: req.user.id
      }
    ]);

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.patch('/api/work-orders/:id', verifyToken, async (req, res) => {
  try {
    const { status, assigned_to, actual_cost, notes } = req.body;

    const updateData = {};
    if (status) updateData.status = status;
    if (assigned_to) updateData.assigned_to = assigned_to;
    if (actual_cost !== undefined) updateData.actual_cost = actual_cost;
    if (notes) updateData.notes = notes;
    updateData.updated_by = req.user.id;
    updateData.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('work_orders')
      .update(updateData)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;

    // Log update
    if (status) {
      await supabase.from('work_order_updates').insert([
        {
          id: uuidv4(),
          work_order_id: req.params.id,
          status: status,
          note: notes || '',
          updated_by: req.user.id
        }
      ]);
    }

    // Log audit
    await supabase.from('audit_log').insert([
      {
        id: uuidv4(),
        entity_type: 'work_order',
        entity_id: req.params.id,
        action: 'update',
        new_values: updateData,
        changed_by: req.user.id
      }
    ]);

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========== VENDORS ==========

app.get('/api/vendors', verifyToken, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('vendors')
      .select('*')
      .eq('active', true)
      .order('name');

    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========== LOCATIONS ==========

app.get('/api/locations', verifyToken, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('locations')
      .select('*')
      .eq('active', true)
      .order('name');

    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========== ANALYTICS/DASHBOARD ==========

app.get('/api/analytics/dashboard', verifyToken, async (req, res) => {
  try {
    let query = supabase.from('work_orders').select('status, estimated_cost, created_at');

    // Filter by role
    if (req.user.role === 'facility_director') {
      const { data: userLocation } = await supabase
        .from('users')
        .select('location_id')
        .eq('id', req.user.id)
        .single();

      if (userLocation?.location_id) {
        query = query.eq('location_id', userLocation.location_id);
      }
    }

    const { data, error } = await query;

    if (error) throw error;

    const metrics = {
      total: data.length,
      open: data.filter(w => w.status === 'Open').length,
      inProgress: data.filter(w => w.status === 'In Progress').length,
      completed: data.filter(w => w.status === 'Completed').length,
      totalCost: data.reduce((sum, w) => sum + (w.estimated_cost || 0), 0),
      avgCost: data.length > 0 ? data.reduce((sum, w) => sum + (w.estimated_cost || 0), 0) / data.length : 0
    };

    res.json(metrics);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/analytics/vendor-performance', verifyToken, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('work_orders')
      .select('vendor_id, status, estimated_cost, vendors:vendor_id(name)');

    if (error) throw error;

    const vendorMap = {};
    data.forEach(wo => {
      const vendorId = wo.vendor_id;
      const vendorName = wo.vendors?.name || 'Unassigned';
      if (!vendorMap[vendorId]) {
        vendorMap[vendorId] = {
          name: vendorName,
          total: 0,
          completed: 0,
          cost: 0,
          avgCost: 0
        };
      }
      vendorMap[vendorId].total++;
      vendorMap[vendorId].cost += wo.estimated_cost || 0;
      if (wo.status === 'Completed') vendorMap[vendorId].completed++;
    });

    const report = Object.values(vendorMap).map(v => ({
      ...v,
      avgCost: v.cost / v.total
    })).sort((a, b) => b.total - a.total);

    res.json(report);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========== USERS ==========

app.get('/api/users', verifyToken, checkRole(['admin']), async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, email, full_name, role, active, created_at')
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========== HEALTH CHECK ==========

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Start server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`✅ CBC Facilities API running on http://localhost:${PORT}`);
  console.log(`   Supabase: ${process.env.SUPABASE_URL}`);
});
