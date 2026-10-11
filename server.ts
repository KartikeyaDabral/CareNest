import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import cookieParser from 'cookie-parser';
import multer from 'multer';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;
const JWT_SECRET = process.env.JWT_SECRET_KEY || 'carenest_jwt_secret_signing_key_secure_vault_9921';

// Base Directories
const BASE_DIR = process.cwd();
const TEMPLATES_DIR = path.join(BASE_DIR, 'templates');
const STATIC_DIR = path.join(BASE_DIR, 'static');
const UPLOADS_DIR = path.join(BASE_DIR, 'uploads');
const DATA_FILE = path.join(BASE_DIR, 'carenest_data.json');

// Ensure uploads and base directories exist
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Multer Storage for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const user = (req as any).user;
    const userDir = path.join(UPLOADS_DIR, user ? String(user.user_id) : 'common');
    if (!fs.existsSync(userDir)) {
      fs.mkdirSync(userDir, { recursive: true });
    }
    cb(null, userDir);
  },
  filename: (req, file, cb) => {
    const cleanName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const uniqueName = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}_${cleanName}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB limit
  fileFilter: (req, file, cb) => {
    const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
    if (allowed.includes(file.mimetype) || /\.(pdf|jpg|jpeg|png)$/i.test(file.originalname)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, JPG, and PNG are allowed.'));
    }
  }
});

// Middlewares
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', (req.headers.origin as string) || '*');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Static Files & Uploads
app.use('/static', express.static(STATIC_DIR));
app.use('/uploads', express.static(UPLOADS_DIR));

// Simple In-Memory / File Persistent Store matching PostgreSQL schema
interface UserLogin {
  user_id: number;
  email: string;
  mobile: string;
  password_hash: string;
  is_registered: boolean;
  failed_attempts: number;
  locked_until: string | null;
  reset_token_hash: string | null;
  reset_token_expiry: string | null;
  created_at: string;
  updated_at: string;
  last_login_at: string | null;
}

interface UserRegistration {
  registration_id: number;
  user_id: number;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  gender: string;
  blood_group?: string;
  mobile: string;
  alternate_mobile?: string;
  address_line1: string;
  address_line2?: string;
  city: string;
  state: string;
  pincode: string;
  allergies?: string;
  chronic_conditions?: string;
  current_medications?: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  created_at: string;
  updated_at: string;
}

interface DocumentTrack {
  document_id: number;
  user_id: number;
  document_type: string;
  original_file_name: string;
  stored_file_name: string;
  file_path: string;
  file_size_kb: number;
  mime_type: string;
  status: 'Pending' | 'Verified' | 'Rejected';
  uploaded_at: string;
  updated_at: string;
  is_deleted: boolean;
}

interface DatabaseState {
  user_login: UserLogin[];
  user_registration: UserRegistration[];
  document_track: DocumentTrack[];
  next_user_id: number;
  next_reg_id: number;
  next_doc_id: number;
}

function loadDatabase(): DatabaseState {
  if (fs.existsSync(DATA_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
    } catch (e) {
      // ignore
    }
  }

  // Seed default demo user
  const salt = bcrypt.genSaltSync(10);
  const demoHash = bcrypt.hashSync('Password@123', salt);
  const now = new Date().toISOString();

  const initial: DatabaseState = {
    user_login: [
      {
        user_id: 1,
        email: 'demo@carenest.in',
        mobile: '9876543210',
        password_hash: demoHash,
        is_registered: true,
        failed_attempts: 0,
        locked_until: null,
        reset_token_hash: null,
        reset_token_expiry: null,
        created_at: now,
        updated_at: now,
        last_login_at: now
      }
    ],
    user_registration: [
      {
        registration_id: 1,
        user_id: 1,
        first_name: 'Ananya',
        last_name: 'Sharma',
        date_of_birth: '1994-06-15',
        gender: 'Female',
        blood_group: 'B+',
        mobile: '9876543210',
        alternate_mobile: '9876543299',
        address_line1: 'Flat 402, Green Meadows, 5th Main Road',
        address_line2: 'Near Indiranagar Metro',
        city: 'Bengaluru',
        state: 'Karnataka',
        pincode: '560038',
        allergies: 'Penicillin, Seasonal Pollen',
        chronic_conditions: 'Mild Asthma',
        current_medications: 'Montair LC 10mg, Budecort 200 Inhaler',
        emergency_contact_name: 'Rohan Sharma',
        emergency_contact_phone: '9876543211',
        created_at: now,
        updated_at: now
      }
    ],
    document_track: [],
    next_user_id: 2,
    next_reg_id: 2,
    next_doc_id: 1
  };

  // Create demo prescription document file
  const demoUserDir = path.join(UPLOADS_DIR, '1');
  if (!fs.existsSync(demoUserDir)) {
    fs.mkdirSync(demoUserDir, { recursive: true });
  }
  const demoDocPath = path.join(demoUserDir, 'demo_rx_dr_mehta.pdf');
  if (!fs.existsSync(demoDocPath)) {
    fs.writeFileSync(
      demoDocPath,
      '%PDF-1.4\n%CareNest Demo Prescription Document - Dr. Rajesh Mehta, MD (Cardiology)\nRx:\n1. Tab Atorvastatin 20mg - 1 OD\n2. Tab Telmisartan 40mg - 1 OD morning\n%%EOF'
    );
  }

  initial.document_track.push({
    document_id: 1,
    user_id: 1,
    document_type: 'Prescription',
    original_file_name: 'Prescription_Dr_Mehta_Cardiology.pdf',
    stored_file_name: 'demo_rx_dr_mehta.pdf',
    file_path: demoDocPath,
    file_size_kb: 145,
    mime_type: 'application/pdf',
    status: 'Verified',
    uploaded_at: now,
    updated_at: now,
    is_deleted: false
  });
  initial.next_doc_id = 2;

  fs.writeFileSync(DATA_FILE, JSON.stringify(initial, null, 2), 'utf-8');
  return initial;
}

function saveDatabase(db: DatabaseState) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2), 'utf-8');
  } catch (e) {
    console.error('Error saving db:', e);
  }
}

const db = loadDatabase();

// Authentication Helper & Middleware
function getUserFromToken(req: Request): UserLogin | null {
  const token = req.cookies.carenest_token || (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.split(' ')[1] : null);
  if (!token) return null;

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { sub: string | number };
    const userId = Number(decoded.sub);
    const user = db.user_login.find(u => u.user_id === userId);
    return user || null;
  } catch (e) {
    return null;
  }
}

function requireAuth(req: Request, res: Response, next: NextFunction) {
  const user = getUserFromToken(req);
  if (!user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required. Please log in to proceed.',
      data: null
    });
  }
  (req as any).user = user;
  next();
}

// Template Renderer for Jinja2 Templates
function renderTemplate(templateName: string, context: { is_authenticated: boolean; token?: string } = { is_authenticated: false }): string {
  const basePath = path.join(TEMPLATES_DIR, 'base.html');
  const pagePath = path.join(TEMPLATES_DIR, templateName);

  if (!fs.existsSync(basePath) || !fs.existsSync(pagePath)) {
    return `<h1>Template not found: ${templateName}</h1>`;
  }

  const baseHtml = fs.readFileSync(basePath, 'utf-8');
  const pageHtml = fs.readFileSync(pagePath, 'utf-8');

  // Parse blocks from pageHtml
  const blockRegex = /{% block ([a-zA-Z0-9_]+) %}([\s\S]*?){% endblock %}/g;
  const blocks: Record<string, string> = {};
  let match;
  while ((match = blockRegex.exec(pageHtml)) !== null) {
    blocks[match[1]] = match[2];
  }

  // Replace blocks in baseHtml
  let rendered = baseHtml;

  // Replace defined blocks
  for (const [blockName, blockContent] of Object.entries(blocks)) {
    const placeholderRegex = new RegExp(`{% block ${blockName} %}[\\s\\S]*?{% endblock %}`, 'g');
    rendered = rendered.replace(placeholderRegex, blockContent);
  }

  // Clean remaining empty blocks
  rendered = rendered.replace(/{% block [a-zA-Z0-9_]+ %}[\s\S]*?{% endblock %}/g, '');

  // Replace template variables
  rendered = rendered.replace(/{{ 'true' if is_authenticated else 'false' }}/g, context.is_authenticated ? 'true' : 'false');
  rendered = rendered.replace(/{{ token or '' }}/g, context.token || '');
  rendered = rendered.replace(/data-authenticated="[^"]*"/, `data-authenticated="${context.is_authenticated ? 'true' : 'false'}"`);

  return rendered;
}

// ====================================================================
// PAGE ROUTES (HTML Rendering)
// ====================================================================

app.get('/', (req, res) => {
  const user = getUserFromToken(req);
  res.send(renderTemplate('home.html', { is_authenticated: Boolean(user) }));
});

app.get('/signup', (req, res) => {
  const user = getUserFromToken(req);
  if (user) return res.redirect('/profile');
  res.send(renderTemplate('signup.html', { is_authenticated: false }));
});

app.get('/login', (req, res) => {
  const user = getUserFromToken(req);
  if (user) return res.redirect('/profile');
  res.send(renderTemplate('login.html', { is_authenticated: false }));
});

app.get('/forgot-password', (req, res) => {
  res.send(renderTemplate('forgot_password.html', { is_authenticated: false }));
});

app.get('/reset-password', (req, res) => {
  const token = typeof req.query.token === 'string' ? req.query.token : '';
  res.send(renderTemplate('reset_password.html', { is_authenticated: false, token }));
});

app.get('/register', (req, res) => {
  const user = getUserFromToken(req);
  if (!user) return res.redirect('/login');
  res.send(renderTemplate('register.html', { is_authenticated: true }));
});

app.get('/documents', (req, res) => {
  const user = getUserFromToken(req);
  if (!user) return res.redirect('/login');
  res.send(renderTemplate('documents.html', { is_authenticated: true }));
});

app.get('/profile', (req, res) => {
  const user = getUserFromToken(req);
  if (!user) return res.redirect('/login');
  res.send(renderTemplate('profile.html', { is_authenticated: true }));
});

// ====================================================================
// REST API ROUTES
// ====================================================================

// 1. Auth: POST /api/auth/signup
app.post('/api/auth/signup', (req, res) => {
  const { full_name, email, mobile, password, confirm_password, terms } = req.body;

  if (!terms) {
    return res.status(400).json({ success: false, message: 'You must agree to the Terms of Service to continue.', data: null });
  }

  if (!full_name || !full_name.trim()) {
    return res.status(400).json({ success: false, message: 'Please enter your full name.', data: null });
  }

  const cleanEmail = String(email || '').trim().toLowerCase();
  const emailRegex = /^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$/;
  if (!emailRegex.test(cleanEmail)) {
    return res.status(400).json({ success: false, message: 'Please enter a valid email address.', data: null });
  }

  const cleanMobile = String(mobile || '').replace(/\D/g, '');
  if (cleanMobile.length !== 10 || !/^[6-9]/.test(cleanMobile)) {
    return res.status(400).json({ success: false, message: 'Please enter a valid 10-digit Indian mobile number.', data: null });
  }

  if (password !== confirm_password) {
    return res.status(400).json({ success: false, message: 'Passwords do not match.', data: null });
  }

  if (
    password.length < 8 ||
    !/[A-Z]/.test(password) ||
    !/[a-z]/.test(password) ||
    !/\d/.test(password) ||
    !/[!@#$%^&*(),.?":{}|<>]/.test(password)
  ) {
    return res.status(400).json({
      success: false,
      message: 'Password must be at least 8 characters and include uppercase, lowercase, number, and special character.',
      data: null
    });
  }

  // Check unique constraints
  const existingEmail = db.user_login.find(u => u.email === cleanEmail);
  if (existingEmail) {
    return res.status(409).json({ success: false, message: 'An account with this email already exists. Please log in.', data: null });
  }

  const existingMobile = db.user_login.find(u => u.mobile === cleanMobile);
  if (existingMobile) {
    return res.status(409).json({ success: false, message: 'An account with this mobile number already exists. Please log in.', data: null });
  }

  const salt = bcrypt.genSaltSync(10);
  const passwordHash = bcrypt.hashSync(password, salt);
  const now = new Date().toISOString();

  const newUser: UserLogin = {
    user_id: db.next_user_id++,
    email: cleanEmail,
    mobile: cleanMobile,
    password_hash: passwordHash,
    is_registered: false,
    failed_attempts: 0,
    locked_until: null,
    reset_token_hash: null,
    reset_token_expiry: null,
    created_at: now,
    updated_at: now,
    last_login_at: now
  };

  db.user_login.push(newUser);

  // Pre-seed draft registration with name and contact
  const nameParts = full_name.trim().split(' ');
  const firstName = nameParts[0];
  const lastName = nameParts.slice(1).join(' ') || '';

  db.user_registration.push({
    registration_id: db.next_reg_id++,
    user_id: newUser.user_id,
    first_name: firstName,
    last_name: lastName,
    date_of_birth: '2000-01-01',
    gender: 'Prefer not to say',
    mobile: cleanMobile,
    address_line1: '',
    city: '',
    state: '',
    pincode: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
    created_at: now,
    updated_at: now
  });

  saveDatabase(db);

  // Create JWT token & set cookie
  const token = jwt.sign({ sub: newUser.user_id }, JWT_SECRET, { expiresIn: '1d' });
  res.cookie('carenest_token', token, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000
  });

  return res.status(201).json({
    success: true,
    message: 'Account created successfully. Welcome to CareNest!',
    data: {
      user_id: newUser.user_id,
      email: newUser.email,
      mobile: newUser.mobile,
      is_registered: false,
      token
    }
  });
});

// 2. Auth: POST /api/auth/login
app.post('/api/auth/login', (req, res) => {
  const { identifier, password, remember_me } = req.body;

  if (!identifier || !password) {
    return res.status(400).json({ success: false, message: 'Please provide both email/mobile and password.', data: null });
  }

  const cleanIdent = String(identifier).trim().toLowerCase().replace(/\s|-/g, '');
  const cleanMobile = cleanIdent.startsWith('+91') ? cleanIdent.substring(3) : cleanIdent;

  const user = db.user_login.find(u => u.email === cleanIdent || u.mobile === cleanMobile);

  if (!user) {
    return res.status(401).json({ success: false, message: 'Invalid email/mobile or password.', data: null });
  }

  // Check lockout status
  if (user.locked_until) {
    const lockTime = new Date(user.locked_until).getTime();
    if (lockTime > Date.now()) {
      const remainingMinutes = Math.max(1, Math.ceil((lockTime - Date.now()) / (60 * 1000)));
      return res.status(403).json({
        success: false,
        message: `Account is temporarily locked due to 5 failed attempts. Please try again in ${remainingMinutes} minute(s) or use 'Forgot Password'.`,
        data: { locked: true, remaining_minutes: remainingMinutes }
      });
    }
  }

  // Verify password
  const isMatch = bcrypt.compareSync(password, user.password_hash);

  if (!isMatch) {
    user.failed_attempts = (user.failed_attempts || 0) + 1;
    if (user.failed_attempts >= 5) {
      user.locked_until = new Date(Date.now() + 15 * 60 * 1000).toISOString();
      saveDatabase(db);
      return res.status(403).json({
        success: false,
        message: 'Account locked for 15 minutes due to 5 failed login attempts. Please reset your password if needed.',
        data: { locked: true }
      });
    } else {
      saveDatabase(db);
      const remaining = 5 - user.failed_attempts;
      return res.status(401).json({
        success: false,
        message: `Invalid email/mobile or password. (${remaining} attempt${remaining > 1 ? 's' : ''} remaining before temporary lockout)`,
        data: null
      });
    }
  }

  // Login success
  user.failed_attempts = 0;
  user.locked_until = null;
  user.last_login_at = new Date().toISOString();
  saveDatabase(db);

  const maxAge = remember_me ? 7 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
  const token = jwt.sign({ sub: user.user_id }, JWT_SECRET, { expiresIn: remember_me ? '7d' : '1d' });

  res.cookie('carenest_token', token, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge
  });

  return res.status(200).json({
    success: true,
    message: 'Login successful. Welcome back to CareNest!',
    data: {
      user_id: user.user_id,
      email: user.email,
      mobile: user.mobile,
      is_registered: user.is_registered,
      token
    }
  });
});

// 3. Auth: POST /api/auth/logout
app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('carenest_token');
  return res.status(200).json({ success: true, message: 'You have been logged out successfully.', data: null });
});

// 4. Auth: GET /api/auth/me
app.get('/api/auth/me', (req, res) => {
  const user = getUserFromToken(req);
  if (!user) {
    return res.status(401).json({ success: false, message: 'Not authenticated', data: null });
  }

  const profile = db.user_registration.find(r => r.user_id === user.user_id) || {};

  return res.status(200).json({
    success: true,
    message: 'User profile retrieved.',
    data: {
      user_id: user.user_id,
      email: user.email,
      mobile: user.mobile,
      is_registered: user.is_registered,
      profile: {
        first_name: profile.first_name || '',
        last_name: profile.last_name || '',
        gender: profile.gender || '',
        city: profile.city || '',
        state: profile.state || ''
      }
    }
  });
});

// 5. Auth: POST /api/auth/forgot-password
app.post('/api/auth/forgot-password', (req, res) => {
  const { email } = req.body;
  const cleanEmail = String(email || '').trim().toLowerCase();

  const user = db.user_login.find(u => u.email === cleanEmail);
  let demoToken = null;

  if (user) {
    const rawToken = 'CN-' + Math.random().toString(36).substring(2, 10).toUpperCase();
    const tokenHash = bcrypt.hashSync(rawToken, 8);
    user.reset_token_hash = tokenHash;
    user.reset_token_expiry = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    saveDatabase(db);
    demoToken = rawToken;
    console.log(`\n========================================\n[CareNest DEMO] Reset token for ${cleanEmail}: ${rawToken}\nLink: /reset-password?token=${rawToken}\n========================================\n`);
  }

  return res.status(200).json({
    success: true,
    message: 'If this email is registered with CareNest, password reset instructions and a verification token have been dispatched.',
    data: {
      demo_token: demoToken,
      demo_note: 'For review/testing convenience, you can use the token shown here or in the terminal console.'
    }
  });
});

// 6. Auth: POST /api/auth/reset-password
app.post('/api/auth/reset-password', (req, res) => {
  const { token, new_password, confirm_password } = req.body;

  if (!token) {
    return res.status(400).json({ success: false, message: 'Reset token is missing.', data: null });
  }

  if (new_password !== confirm_password) {
    return res.status(400).json({ success: false, message: 'Passwords do not match.', data: null });
  }

  if (
    new_password.length < 8 ||
    !/[A-Z]/.test(new_password) ||
    !/[a-z]/.test(new_password) ||
    !/\d/.test(new_password) ||
    !/[!@#$%^&*(),.?":{}|<>]/.test(new_password)
  ) {
    return res.status(400).json({
      success: false,
      message: 'New password must be at least 8 characters with uppercase, lowercase, number, and special character.',
      data: null
    });
  }

  // Match user by reset token hash & expiry
  const now = Date.now();
  const user = db.user_login.find(u => {
    if (!u.reset_token_hash || !u.reset_token_expiry) return false;
    const expiry = new Date(u.reset_token_expiry).getTime();
    if (expiry < now) return false;
    return bcrypt.compareSync(token, u.reset_token_hash);
  });

  if (!user) {
    return res.status(400).json({ success: false, message: 'Invalid or expired password reset token.', data: null });
  }

  const salt = bcrypt.genSaltSync(10);
  user.password_hash = bcrypt.hashSync(new_password, salt);
  user.reset_token_hash = null;
  user.reset_token_expiry = null;
  user.failed_attempts = 0;
  user.locked_until = null;
  user.updated_at = new Date().toISOString();
  saveDatabase(db);

  return res.status(200).json({
    success: true,
    message: 'Password has been reset successfully. Please log in with your new password.',
    data: null
  });
});

// 7. Auth: PUT /api/auth/change-password
app.put('/api/auth/change-password', requireAuth, (req, res) => {
  const user = (req as any).user as UserLogin;
  const { current_password, new_password, confirm_password } = req.body;

  if (!current_password || !new_password) {
    return res.status(400).json({ success: false, message: 'Please provide both current and new passwords.', data: null });
  }

  if (new_password !== confirm_password) {
    return res.status(400).json({ success: false, message: 'New passwords do not match.', data: null });
  }

  if (
    new_password.length < 8 ||
    !/[A-Z]/.test(new_password) ||
    !/[a-z]/.test(new_password) ||
    !/\d/.test(new_password) ||
    !/[!@#$%^&*(),.?":{}|<>]/.test(new_password)
  ) {
    return res.status(400).json({ success: false, message: 'Password does not meet complexity requirements.', data: null });
  }

  if (!bcrypt.compareSync(current_password, user.password_hash)) {
    return res.status(400).json({ success: false, message: 'Current password is incorrect.', data: null });
  }

  const salt = bcrypt.genSaltSync(10);
  user.password_hash = bcrypt.hashSync(new_password, salt);
  user.updated_at = new Date().toISOString();
  saveDatabase(db);

  return res.status(200).json({ success: true, message: 'Your password has been changed successfully.', data: null });
});

// 8. Registration: POST /api/registration
app.post('/api/registration', requireAuth, (req, res) => {
  const user = (req as any).user as UserLogin;
  const data = req.body;

  const {
    first_name, last_name, date_of_birth, gender, blood_group,
    mobile, alternate_mobile, address_line1, address_line2, city, state, pincode,
    allergies, chronic_conditions, current_medications,
    emergency_contact_name, emergency_contact_phone
  } = data;

  if (!first_name || !last_name) {
    return res.status(400).json({ success: false, message: 'First name and last name are required.', data: null });
  }

  if (!date_of_birth) {
    return res.status(400).json({ success: false, message: 'Date of birth is required.', data: null });
  }

  if (!address_line1 || !city || !state) {
    return res.status(400).json({ success: false, message: 'Address, city, and state are required.', data: null });
  }

  if (!pincode || !/^\d{6}$/.test(pincode)) {
    return res.status(400).json({ success: false, message: 'Pincode must be exactly 6 digits.', data: null });
  }

  if (!emergency_contact_name || !emergency_contact_phone) {
    return res.status(400).json({ success: false, message: 'Emergency contact name and phone are required.', data: null });
  }

  let reg = db.user_registration.find(r => r.user_id === user.user_id);
  const now = new Date().toISOString();

  if (reg) {
    // Update existing registration
    Object.assign(reg, {
      first_name, last_name, date_of_birth, gender, blood_group,
      mobile, alternate_mobile, address_line1, address_line2, city, state, pincode,
      allergies, chronic_conditions, current_medications,
      emergency_contact_name, emergency_contact_phone,
      updated_at: now
    });
  } else {
    reg = {
      registration_id: db.next_reg_id++,
      user_id: user.user_id,
      first_name, last_name, date_of_birth, gender, blood_group,
      mobile, alternate_mobile, address_line1, address_line2, city, state, pincode,
      allergies, chronic_conditions, current_medications,
      emergency_contact_name, emergency_contact_phone,
      created_at: now,
      updated_at: now
    };
    db.user_registration.push(reg);
  }

  user.is_registered = true;
  user.updated_at = now;
  saveDatabase(db);

  return res.status(201).json({
    success: true,
    message: 'Healthcare profile registered successfully!',
    data: reg
  });
});

// 9. Registration: GET /api/registration
app.get('/api/registration', requireAuth, (req, res) => {
  const user = (req as any).user as UserLogin;
  const reg = db.user_registration.find(r => r.user_id === user.user_id);

  if (!reg) {
    return res.status(200).json({
      success: true,
      message: 'User found, profile pending completion.',
      data: {
        user_id: user.user_id,
        email: user.email,
        login_mobile: user.mobile,
        is_registered: false
      }
    });
  }

  return res.status(200).json({
    success: true,
    message: 'Profile retrieved successfully.',
    data: {
      ...reg,
      email: user.email,
      login_mobile: user.mobile,
      member_since: user.created_at
    }
  });
});

// 10. Registration: PUT /api/registration
app.put('/api/registration', requireAuth, (req, res) => {
  const user = (req as any).user as UserLogin;
  const data = req.body;

  let reg = db.user_registration.find(r => r.user_id === user.user_id);
  const now = new Date().toISOString();

  if (!reg) {
    reg = {
      registration_id: db.next_reg_id++,
      user_id: user.user_id,
      first_name: data.first_name || '',
      last_name: data.last_name || '',
      date_of_birth: data.date_of_birth || '2000-01-01',
      gender: data.gender || 'Prefer not to say',
      blood_group: data.blood_group || '',
      mobile: data.mobile || user.mobile,
      alternate_mobile: data.alternate_mobile || '',
      address_line1: data.address_line1 || '',
      address_line2: data.address_line2 || '',
      city: data.city || '',
      state: data.state || '',
      pincode: data.pincode || '',
      allergies: data.allergies || '',
      chronic_conditions: data.chronic_conditions || '',
      current_medications: data.current_medications || '',
      emergency_contact_name: data.emergency_contact_name || '',
      emergency_contact_phone: data.emergency_contact_phone || '',
      created_at: now,
      updated_at: now
    };
    db.user_registration.push(reg);
  } else {
    Object.assign(reg, data, { updated_at: now });
  }

  user.is_registered = true;
  user.updated_at = now;
  saveDatabase(db);

  return res.status(200).json({
    success: true,
    message: 'Healthcare profile updated successfully.',
    data: reg
  });
});

// 11. Registration: DELETE /api/registration (Cascade delete account)
app.delete('/api/registration', requireAuth, (req, res) => {
  const user = (req as any).user as UserLogin;
  const userId = user.user_id;

  // Remove records
  db.user_login = db.user_login.filter(u => u.user_id !== userId);
  db.user_registration = db.user_registration.filter(r => r.user_id !== userId);
  db.document_track = db.document_track.filter(d => d.user_id !== userId);
  saveDatabase(db);

  // Remove files
  const userDir = path.join(UPLOADS_DIR, String(userId));
  if (fs.existsSync(userDir)) {
    fs.rmSync(userDir, { recursive: true, force: true });
  }

  res.clearCookie('carenest_token');

  return res.status(200).json({
    success: true,
    message: 'Your CareNest account and all associated health documents have been permanently deleted.',
    data: null
  });
});

// 12. Documents: POST /api/documents
app.post('/api/documents', requireAuth, upload.single('file'), (req, res) => {
  const user = (req as any).user as UserLogin;
  const file = req.file;
  const document_type = req.body.document_type || 'Prescription';

  if (!file) {
    return res.status(400).json({ success: false, message: 'No file uploaded or file rejected.', data: null });
  }

  const now = new Date().toISOString();
  const doc: DocumentTrack = {
    document_id: db.next_doc_id++,
    user_id: user.user_id,
    document_type,
    original_file_name: file.originalname,
    stored_file_name: file.filename,
    file_path: file.path,
    file_size_kb: Math.max(1, Math.round(file.size / 1024)),
    mime_type: file.mimetype,
    status: 'Pending',
    uploaded_at: now,
    updated_at: now,
    is_deleted: false
  };

  db.document_track.push(doc);
  saveDatabase(db);

  return res.status(201).json({
    success: true,
    message: `${document_type} uploaded successfully and queued for verification.`,
    data: doc
  });
});

// 13. Documents: GET /api/documents
app.get('/api/documents', requireAuth, (req, res) => {
  const user = (req as any).user as UserLogin;
  const docs = db.document_track
    .filter(d => d.user_id === user.user_id && !d.is_deleted)
    .sort((a, b) => new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime());

  return res.status(200).json({
    success: true,
    message: `Retrieved ${docs.length} documents.`,
    data: docs
  });
});

// 14. Documents: GET /api/documents/:id (View / Download)
app.get('/api/documents/:id', requireAuth, (req, res) => {
  const user = (req as any).user as UserLogin;
  const docId = Number(req.params.id);
  const doc = db.document_track.find(d => d.document_id === docId && d.user_id === user.user_id && !d.is_deleted);

  if (!doc) {
    return res.status(404).json({ success: false, message: 'Document not found or access denied.', data: null });
  }

  const filePath = path.join(UPLOADS_DIR, String(user.user_id), doc.stored_file_name);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ success: false, message: 'Physical file not found on disk.', data: null });
  }

  const asDownload = req.query.download === '1';
  if (asDownload) {
    return res.download(filePath, doc.original_file_name);
  } else {
    res.setHeader('Content-Type', doc.mime_type);
    return res.sendFile(filePath);
  }
});

// 15. Documents: PUT /api/documents/:id (Replace / Update)
app.put('/api/documents/:id', requireAuth, upload.single('file'), (req, res) => {
  const user = (req as any).user as UserLogin;
  const docId = Number(req.params.id);
  const doc = db.document_track.find(d => d.document_id === docId && d.user_id === user.user_id && !d.is_deleted);

  if (!doc) {
    return res.status(404).json({ success: false, message: 'Document not found.', data: null });
  }

  const document_type = req.body.document_type;
  if (document_type) {
    doc.document_type = document_type;
  }

  if (req.file) {
    // Delete old file
    const oldPath = path.join(UPLOADS_DIR, String(user.user_id), doc.stored_file_name);
    if (fs.existsSync(oldPath)) {
      try { fs.unlinkSync(oldPath); } catch (e) {}
    }

    doc.original_file_name = req.file.originalname;
    doc.stored_file_name = req.file.filename;
    doc.file_path = req.file.path;
    doc.file_size_kb = Math.max(1, Math.round(req.file.size / 1024));
    doc.mime_type = req.file.mimetype;
    doc.status = 'Pending';
  }

  doc.updated_at = new Date().toISOString();
  saveDatabase(db);

  return res.status(200).json({
    success: true,
    message: 'Document updated successfully.',
    data: doc
  });
});

// 16. Documents: DELETE /api/documents/:id (Soft delete)
app.delete('/api/documents/:id', requireAuth, (req, res) => {
  const user = (req as any).user as UserLogin;
  const docId = Number(req.params.id);
  const doc = db.document_track.find(d => d.document_id === docId && d.user_id === user.user_id);

  if (!doc) {
    return res.status(404).json({ success: false, message: 'Document not found.', data: null });
  }

  doc.is_deleted = true;
  doc.updated_at = new Date().toISOString();
  saveDatabase(db);

  // Remove from disk
  const filePath = path.join(UPLOADS_DIR, String(user.user_id), doc.stored_file_name);
  if (fs.existsSync(filePath)) {
    try { fs.unlinkSync(filePath); } catch (e) {}
  }

  return res.status(200).json({
    success: true,
    message: 'Document deleted successfully.',
    data: null
  });
});

// Centralized error handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ success: false, message: 'File exceeds maximum permitted limit of 5 MB.', data: null });
  }
  return res.status(500).json({ success: false, message: err.message || 'Internal server error', data: null });
});

// Start Server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`CareNest Server running at http://0.0.0.0:${PORT}`);
});
