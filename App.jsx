const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

// Create axios instance with auth
const api = axios.create({ baseURL: API_URL });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

function App() {
  const [user, setUser] = useState(null);
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [workOrders, setWorkOrders] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [locations, setLocations] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(false);

  // Auth state
  const [showLoginForm, setShowLoginForm] = useState(!localStorage.getItem('token'));
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Filter state
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    vendor: '',
    location: '',
    sort: 'newest'
  });

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');
    if (token && userData) {
      setUser(JSON.parse(userData));
      setShowLoginForm(false);
      loadData();
    }
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [woRes, vendorsRes, locRes, metricsRes] = await Promise.all([
        api.get('/api/work-orders'),
        api.get('/api/vendors'),
        api.get('/api/locations'),
        api.get('/api/analytics/dashboard')
      ]);
      
      setWorkOrders(woRes.data.data);
      setVendors(vendorsRes.data);
      setLocations(locRes.data);
      setMetrics(metricsRes.data);
    } catch (error) {
      console.error('Error loading data:', error);
      alert('Error loading data: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const response = await api.post('/api/auth/login', {
        email: loginEmail,
        password: loginPassword
      });

      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
      setUser(response.data.user);
      setShowLoginForm(false);
      setLoginEmail('');
      setLoginPassword('');
      loadData();
    } catch (error) {
      alert('Login failed: ' + error.response?.data?.error || error.message);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    setShowLoginForm(true);
    setCurrentPage('dashboard');
  };

  const handleCreateWorkOrder = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    try {
      await api.post('/api/work-orders', {
        location_id: formData.get('location_id'),
        equipment: formData.get('equipment'),
        equipment_type: formData.get('equipment_type'),
        description: formData.get('description'),
        priority: formData.get('priority'),
        vendor_id: formData.get('vendor_id'),
        estimated_cost: parseFloat(formData.get('estimated_cost')) || 0
      });
      alert('Work order created successfully!');
      e.target.reset();
      await loadData();
    } catch (error) {
      alert('Error creating work order: ' + error.message);
    }
  };

  const handleUpdateWorkOrder = async (woId, newStatus) => {
    try {
      await api.patch(`/api/work-orders/${woId}`, { status: newStatus });
      await loadData();
    } catch (error) {
      alert('Error updating work order: ' + error.message);
    }
  };

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }));
  };

  if (!user || showLoginForm) {
    return (
      <div className="login-container">
        <div className="login-box">
          <h1>🍞 CBC Facilities</h1>
          <p>Work Order Management System</p>
          <form onSubmit={handleLogin}>
            <input
              type="email"
              placeholder="Email"
              value={loginEmail}
              onChange={(e) => setLoginEmail(e.target.value)}
              required
            />
            <input
              type="password"
              placeholder="Password"
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              required
            />
            <button type="submit">Login</button>
          </form>
          <p className="demo-text">
            Demo: admin@cbc.com / password123
          </p>
        </div>
      </div>
    );
  }

  const filteredWorkOrders = workOrders.filter(wo => {
    const matchSearch = !filters.search || 
      wo.wo_number?.toLowerCase().includes(filters.search.toLowerCase()) ||
      wo.equipment?.toLowerCase().includes(filters.search.toLowerCase());
    const matchStatus = !filters.status || wo.status === filters.status;
    const matchVendor = !filters.vendor || wo.vendor_id === filters.vendor;
    const matchLocation = !filters.location || wo.location_id === filters.location;
    return matchSearch && matchStatus && matchVendor && matchLocation;
  });

  return (
    <div className="app">
      <header className="header">
        <div className="header-left">
          <h1>🍞 CBC Facilities</h1>
          <p>Work Order Management System</p>
        </div>
        <div className="header-right">
          <span>{user.fullName} ({user.role})</span>
          <button className="logout-btn" onClick={handleLogout}>Logout</button>
        </div>
      </header>

      <nav className="nav">
        <button 
          className={currentPage === 'dashboard' ? 'active' : ''}
          onClick={() => setCurrentPage('dashboard')}
        >
          Dashboard
        </button>
        <button 
          className={currentPage === 'work-orders' ? 'active' : ''}
          onClick={() => setCurrentPage('work-orders')}
        >
          Work Orders
        </button>
        <button 
          className={currentPage === 'create' ? 'active' : ''}
          onClick={() => setCurrentPage('create')}
        >
          + New Work Order
        </button>
        <button 
          className={currentPage === 'reports' ? 'active' : ''}
          onClick={() => setCurrentPage('reports')}
        >
          Reports
        </button>
        {user.role === 'admin' && (
          <button 
            className={currentPage === 'users' ? 'active' : ''}
            onClick={() => setCurrentPage('users')}
          >
            Users
          </button>
        )}
      </nav>

      <main className="main">
        {/* Dashboard */}
        {currentPage === 'dashboard' && (
          <div className="page">
            <h2>Dashboard</h2>
            {metrics && (
              <div className="metrics-grid">
                <div className="metric">
                  <div className="metric-value">{metrics.total}</div>
                  <div className="metric-label">Total Work Orders</div>
                </div>
                <div className="metric">
                  <div className="metric-value">{metrics.open}</div>
                  <div className="metric-label">Open</div>
                </div>
                <div className="metric">
                  <div className="metric-value">{metrics.inProgress}</div>
                  <div className="metric-label">In Progress</div>
                </div>
                <div className="metric">
                  <div className="metric-value">{metrics.completed}</div>
                  <div className="metric-label">Completed</div>
                </div>
                <div className="metric">
                  <div className="metric-value">${(metrics.totalCost / 1000000).toFixed(2)}M</div>
                  <div className="metric-label">Total Cost</div>
                </div>
                <div className="metric">
                  <div className="metric-value">${(metrics.avgCost / 1000).toFixed(0)}K</div>
                  <div className="metric-label">Avg Cost</div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Work Orders */}
        {currentPage === 'work-orders' && (
          <div className="page">
            <h2>Work Orders</h2>
            
            <div className="filters">
              <input
                type="text"
                placeholder="Search by WO ID or Equipment"
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
              />
              <select 
                value={filters.status} 
                onChange={(e) => handleFilterChange('status', e.target.value)}
              >
                <option value="">All Status</option>
                <option value="Open">Open</option>
                <option value="In Progress">In Progress</option>
                <option value="Completed">Completed</option>
              </select>
              <select 
                value={filters.vendor} 
                onChange={(e) => handleFilterChange('vendor', e.target.value)}
              >
                <option value="">All Vendors</option>
                {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
              <select 
                value={filters.location} 
                onChange={(e) => handleFilterChange('location', e.target.value)}
              >
                <option value="">All Locations</option>
                {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>

            {loading ? (
              <div className="loading">Loading...</div>
            ) : (
              <table className="work-orders-table">
                <thead>
                  <tr>
                    <th>WO ID</th>
                    <th>Equipment</th>
                    <th>Location</th>
                    <th>Status</th>
                    <th>Vendor</th>
                    <th>Cost</th>
                    <th>Created</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredWorkOrders.map(wo => (
                    <tr key={wo.id}>
                      <td><strong>{wo.wo_number}</strong></td>
                      <td>{wo.equipment}</td>
                      <td>{wo.location?.name || '-'}</td>
                      <td>
                        <select 
                          value={wo.status}
                          onChange={(e) => handleUpdateWorkOrder(wo.id, e.target.value)}
                          className="status-select"
                        >
                          <option value="Open">Open</option>
                          <option value="Assigned">Assigned</option>
                          <option value="In Progress">In Progress</option>
                          <option value="Completed">Completed</option>
                        </select>
                      </td>
                      <td>{wo.vendor?.name || '-'}</td>
                      <td>${(wo.estimated_cost || 0).toLocaleString()}</td>
                      <td>{new Date(wo.created_at).toLocaleDateString()}</td>
                      <td>
                        <button className="view-btn" onClick={() => alert('View details')}>
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Create Work Order */}
        {currentPage === 'create' && (user.role === 'admin' || user.role === 'facility_manager' || user.role === 'facility_director') && (
          <div className="page">
            <h2>Create New Work Order</h2>
            <form className="create-form" onSubmit={handleCreateWorkOrder}>
              <div className="form-group">
                <label>Location *</label>
                <select name="location_id" required>
                  <option value="">Select location...</option>
                  {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Equipment *</label>
                <input type="text" name="equipment" placeholder="e.g., HVAC Unit, Refrigerator" required />
              </div>
              <div className="form-group">
                <label>Equipment Type</label>
                <select name="equipment_type">
                  <option value="">Select type...</option>
                  <option value="HVAC">HVAC</option>
                  <option value="Refrigeration">Refrigeration</option>
                  <option value="Plumbing">Plumbing</option>
                  <option value="Electrical">Electrical</option>
                  <option value="Fire Safety">Fire Safety</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div className="form-group">
                <label>Priority</label>
                <select name="priority">
                  <option value="L4-Standard">Standard</option>
                  <option value="L1-Emergency">Emergency</option>
                  <option value="L2-Urgent">Urgent</option>
                  <option value="L3-High">High</option>
                  <option value="L5-Low">Low</option>
                </select>
              </div>
              <div className="form-group">
                <label>Vendor</label>
                <select name="vendor_id">
                  <option value="">Unassigned</option>
                  {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Estimated Cost</label>
                <input type="number" name="estimated_cost" placeholder="0.00" step="0.01" />
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea name="description" placeholder="Describe the work needed..." rows="5"></textarea>
              </div>
              <button type="submit" className="submit-btn">Create Work Order</button>
            </form>
          </div>
        )}

        {/* Reports */}
        {currentPage === 'reports' && (
          <div className="page">
            <h2>Reports & Analytics</h2>
            <div className="report-section">
              <h3>Work Orders by Status</h3>
              {metrics && (
                <table className="report-table">
                  <thead>
                    <tr>
                      <th>Status</th>
                      <th>Count</th>
                      <th>Percentage</th>
                      <th>Total Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Open</td>
                      <td>{metrics.open}</td>
                      <td>{((metrics.open / metrics.total) * 100).toFixed(1)}%</td>
                      <td>${workOrders.filter(w => w.status === 'Open').reduce((sum, w) => sum + (w.estimated_cost || 0), 0).toLocaleString()}</td>
                    </tr>
                    <tr>
                      <td>In Progress</td>
                      <td>{metrics.inProgress}</td>
                      <td>{((metrics.inProgress / metrics.total) * 100).toFixed(1)}%</td>
                      <td>${workOrders.filter(w => w.status === 'In Progress').reduce((sum, w) => sum + (w.estimated_cost || 0), 0).toLocaleString()}</td>
                    </tr>
                    <tr>
                      <td>Completed</td>
                      <td>{metrics.completed}</td>
                      <td>{((metrics.completed / metrics.total) * 100).toFixed(1)}%</td>
                      <td>${workOrders.filter(w => w.status === 'Completed').reduce((sum, w) => sum + (w.estimated_cost || 0), 0).toLocaleString()}</td>
                    </tr>
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* Users (Admin Only) */}
        {currentPage === 'users' && user.role === 'admin' && (
          <div className="page">
            <h2>User Management</h2>
            <button className="add-user-btn" onClick={() => alert('Add user feature - Create new user form')}>
              + Add User
            </button>
            <p className="coming-soon">User management interface coming soon</p>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
