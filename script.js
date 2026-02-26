/* =============================================
   PARKSMART — Enhanced Application JavaScript
   Version 2.0 — Full Feature Platform
   localStorage-based, role-aware, fully dynamic
   ============================================= */

// =============================================
// SECTION 1: STORAGE & UTILITIES
// =============================================

function generateId(prefix = 'id') {
  return prefix + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 7);
}

function generateBookingId() {
  return 'BK-' + Date.now().toString(36).toUpperCase().slice(-6);
}

// =============================================
// INDIAN VEHICLE NUMBER PLATE VALIDATION
// =============================================

/**
 * Indian Vehicle Registration Number Formats:
 *
 * Standard (post-1980):  SS NN AA NNNN
 *   SS  = State code (2 letters)  e.g. TS, MH, DL, KA
 *   NN  = District/RTO code (2 digits)
 *   AA  = Series letters (1–3 letters, A–ZZZ)
 *   NNNN= 4-digit number (0001–9999)
 *   Example: TS09AB1234, MH12BC5678, DL3CAB0001
 *
 * BH Series (Bharat Series, since 2021): NN BH NNNN AA
 *   NN  = Year (20–99)
 *   BH  = Fixed literal
 *   NNNN= 4-digit number
 *   AA  = 1–2 letters
 *   Example: 22BH0001AA, 23BH9999XY
 *
 * Electric (old format with E suffix): same as standard but ends in 4 digits
 *   The vehicle type (EV) is separately tracked.
 *
 * Defence: 00 AA NNNN  (two zeros, 2 letters, 4 digits)
 *   Example: 00A12345 (simplified: varies by branch)
 *
 * Diplomatic: DD NNNNNN C  (DD=digits, C=country)
 *   Not commonly needed — we skip this.
 *
 * We validate:
 *  1. Standard format
 *  2. BH Series
 *  3. Defence (basic)
 */

const INDIAN_STATE_CODES = new Set([
  'AN','AP','AR','AS','BR','CG','CH','DD','DL','DN','GA','GJ','HP','HR',
  'JH','JK','KA','KL','LA','LD','MH','ML','MN','MP','MZ','NL','OD','PB',
  'PY','RJ','SK','TN','TR','TS','UK','UP','WB'
]);

// Regex patterns
const PLATE_PATTERNS = {
  // Standard: TS09AB1234 or TS09A1234 or TS09ABC1234
  standard: /^([A-Z]{2})(\d{2})([A-Z]{1,3})(\d{4})$/,
  // BH Series: 22BH0001AA or 22BH9999Z
  bhSeries: /^(\d{2})(BH)(\d{4})([A-Z]{1,2})$/,
  // Defence: 00A12345 (simplified)
  defence:  /^(00)([A-Z]{1,2})(\d{4,6})$/,
};

/**
 * Validate and parse an Indian vehicle number plate.
 * @param {string} raw - Raw input (will be normalised internally)
 * @returns {{ valid: boolean, normalized: string, type: string, state?: string, error?: string }}
 */
function validateIndianPlate(raw) {
  // Normalise: uppercase, strip spaces/hyphens
  const plate = raw.toUpperCase().replace(/[\s\-\.]/g, '');

  if (!plate) return { valid: false, error: 'Please enter a vehicle number.' };
  if (plate.length < 6)  return { valid: false, error: 'Vehicle number is too short.' };
  if (plate.length > 13) return { valid: false, error: 'Vehicle number is too long.' };

  // 1. Standard format
  const stdMatch = plate.match(PLATE_PATTERNS.standard);
  if (stdMatch) {
    const stateCode = stdMatch[1];
    const rtoCode   = stdMatch[2];
    const series    = stdMatch[3];
    const number    = stdMatch[4];

    if (!INDIAN_STATE_CODES.has(stateCode)) {
      return {
        valid: false,
        error: `"${stateCode}" is not a valid Indian state/UT code. Valid examples: TS, MH, DL, KA, TN, UP…`
      };
    }
    if (parseInt(number) === 0) {
      return { valid: false, error: 'Serial number cannot be 0000.' };
    }

    // Format nicely: TS 09 AB 1234
    const normalized = `${stateCode} ${rtoCode} ${series} ${number}`;
    const stateName = STATE_NAMES[stateCode] || stateCode;
    return {
      valid: true,
      normalized,
      compact: plate,
      type: 'Standard',
      state: stateName,
      stateCode,
      rtoCode,
      series,
      number,
      info: `${stateName} · RTO ${rtoCode} · Series ${series} · #${number}`
    };
  }

  // 2. BH Series
  const bhMatch = plate.match(PLATE_PATTERNS.bhSeries);
  if (bhMatch) {
    const year   = parseInt(bhMatch[1]);
    const number = bhMatch[3];
    const alpha  = bhMatch[4];
    if (year < 20 || year > 99) {
      return { valid: false, error: 'BH series year must be between 20 and 99 (e.g., 22BH…).' };
    }
    const normalized = `${bhMatch[1]} BH ${number} ${alpha}`;
    return {
      valid: true,
      normalized,
      compact: plate,
      type: 'BH Series (Bharat Series)',
      info: `Bharat Series · Year 20${bhMatch[1]} · #${number}${alpha}`
    };
  }

  // 3. Defence
  const defMatch = plate.match(PLATE_PATTERNS.defence);
  if (defMatch) {
    return {
      valid: true,
      normalized: plate,
      compact: plate,
      type: 'Defence Vehicle',
      info: 'Indian Defence Vehicle'
    };
  }

  // Nothing matched — give smart hint
  return {
    valid: false,
    error: buildHintMessage(plate)
  };
}

function buildHintMessage(plate) {
  // Try to detect what's wrong
  const stdPartial = plate.match(/^([A-Z]{2})(\d{2})/);
  if (stdPartial) {
    const sc = stdPartial[1];
    if (!INDIAN_STATE_CODES.has(sc)) {
      return `"${sc}" is not a valid state code. Expected format: TS09AB1234`;
    }
    return `Incomplete plate. Expected: STATE(2) + RTO(2) + SERIES(1–3 letters) + NUMBER(4 digits). Example: TS09AB1234`;
  }
  if (/^\d{2}BH/.test(plate)) {
    return `BH series format: YYBHNNNNAA (e.g., 22BH0001AA)`;
  }
  return `Invalid format. Use standard Indian format: TS09AB1234 (state + RTO + series + number)`;
}

const STATE_NAMES = {
  AN:'Andaman & Nicobar', AP:'Andhra Pradesh', AR:'Arunachal Pradesh',
  AS:'Assam', BR:'Bihar', CG:'Chhattisgarh', CH:'Chandigarh',
  DD:'Dadra & Nagar Haveli / Daman & Diu', DL:'Delhi', DN:'Dadra & Nagar Haveli',
  GA:'Goa', GJ:'Gujarat', HP:'Himachal Pradesh', HR:'Haryana',
  JH:'Jharkhand', JK:'Jammu & Kashmir', KA:'Karnataka', KL:'Kerala',
  LA:'Ladakh', LD:'Lakshadweep', MH:'Maharashtra', ML:'Meghalaya',
  MN:'Manipur', MP:'Madhya Pradesh', MZ:'Mizoram', NL:'Nagaland',
  OD:'Odisha', PB:'Punjab', PY:'Puducherry', RJ:'Rajasthan',
  SK:'Sikkim', TN:'Tamil Nadu', TR:'Tripura', TS:'Telangana',
  UK:'Uttarakhand', UP:'Uttar Pradesh', WB:'West Bengal'
};

/** Live-format the input as user types (add spaces, uppercase) */
function liveFormatPlate(inputEl) {
  let val = inputEl.value.toUpperCase().replace(/[\s\-\.]/g, '');

  // For standard format: insert spaces after position 2, 4, 7 (if applicable)
  // We let user type freely but show auto-formatted hint
  inputEl.value = val;

  const feedbackEl = document.getElementById('plateValidationMsg');
  if (!feedbackEl) return;

  if (val.length === 0) {
    feedbackEl.innerHTML = '';
    feedbackEl.className = '';
    return;
  }

  if (val.length < 5) {
    feedbackEl.innerHTML = `<span style="color:var(--gray-400);">Keep typing… e.g., TS09AB1234</span>`;
    return;
  }

  const result = validateIndianPlate(val);
  if (result.valid) {
    feedbackEl.innerHTML = `
      <div class="plate-valid">
        <span class="plate-check">✅</span>
        <div>
          <div class="plate-display">${result.normalized}</div>
          <div class="plate-meta">${result.type} · ${result.info}</div>
        </div>
      </div>`;
    feedbackEl.className = 'plate-feedback valid';
  } else {
    feedbackEl.innerHTML = `<span class="plate-error">⚠️ ${result.error}</span>`;
    feedbackEl.className = 'plate-feedback invalid';
  }
}

function getStore(key) {
  try { return JSON.parse(localStorage.getItem(key)) || []; }
  catch { return []; }
}

function setStore(key, data) {
  try { localStorage.setItem(key, JSON.stringify(data)); }
  catch (e) { console.error('Storage error', e); }
}

function getSession() {
  try { return JSON.parse(localStorage.getItem('pk_session')); }
  catch { return null; }
}

function setSession(user) {
  localStorage.setItem('pk_session', JSON.stringify(user));
}

function clearSession() {
  localStorage.removeItem('pk_session');
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<span>${icons[type] || 'ℹ️'}</span><span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

function formatDateTime(ts) {
  if (!ts) return 'N/A';
  const d = new Date(ts);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    + ' ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(ts) {
  if (!ts) return 'N/A';
  return new Date(ts).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDuration(ms) {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function scrollToSection(id) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: 'smooth' });
}

function statusBadge(status) {
  const map = {
    active: '<span class="badge badge-active">● Active</span>',
    completed: '<span class="badge badge-completed">✓ Completed</span>',
    pending: '<span class="badge badge-pending">⏳ Pending</span>',
    cancelled: '<span class="badge badge-cancelled">✕ Cancelled</span>',
    paid: '<span class="badge badge-paid">✓ Paid</span>',
    blocked: '<span class="badge badge-blocked">⛔ Blocked</span>',
  };
  return map[status] || `<span class="badge">${status}</span>`;
}

// =============================================
// SECTION 2: AUTHENTICATION
// =============================================

let _currentAuthRole = 'customer';

function openAuthModal(role = 'customer') {
  const session = getSession();
  if (session) {
    const dest = { owner: 'owner.html', admin: 'admin.html', customer: 'customer.html' };
    window.location.href = dest[session.role] || 'customer.html';
    return;
  }
  _currentAuthRole = role;
  setAuthRole(role);
  switchAuthTab('login');
  document.getElementById('authModal').classList.add('active');
}

function closeAuthModal() {
  document.getElementById('authModal').classList.remove('active');
  const fr = document.getElementById('forgotResult');
  if (fr) fr.innerHTML = '';
}

function setAuthRole(role) {
  _currentAuthRole = role;
  document.getElementById('loginRole').value = role;
  document.getElementById('registerRole').value = role;

  // Update role buttons
  ['customer', 'owner', 'admin'].forEach(r => {
    const btn = document.getElementById('roleBtn-' + r);
    if (btn) btn.classList.toggle('active', r === role);
  });

  // Show/hide owner fields
  const ownerExtra = document.getElementById('ownerExtraFields');
  if (ownerExtra) ownerExtra.classList.toggle('hidden', role !== 'owner');

  // Update title
  const titles = { customer: '🚗 Customer Access', owner: '🏢 Owner Access', admin: '🛡️ Admin Access' };
  const el = document.getElementById('authModalTitle');
  if (el) el.textContent = titles[role] || 'Sign In';
}

function switchAuthTab(tab) {
  const tabs = document.querySelectorAll('.modal-tab');
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  const forgotForm = document.getElementById('forgotForm');

  tabs.forEach(t => t.classList.remove('active'));

  loginForm && loginForm.classList.add('hidden');
  registerForm && registerForm.classList.add('hidden');
  forgotForm && forgotForm.classList.add('hidden');

  if (tab === 'login') {
    tabs[0] && tabs[0].classList.add('active');
    loginForm && loginForm.classList.remove('hidden');
  } else if (tab === 'register') {
    tabs[1] && tabs[1].classList.add('active');
    registerForm && registerForm.classList.remove('hidden');
  } else if (tab === 'forgot') {
    tabs[2] && tabs[2].classList.add('active');
    forgotForm && forgotForm.classList.remove('hidden');
  }
}

function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('loginEmail').value.trim().toLowerCase();
  const password = document.getElementById('loginPassword').value;
  const role = document.getElementById('loginRole').value;

  // Check if account is blocked
  const users = getStore('pk_users');
  const user = users.find(u => u.email === email && u.password === password && u.role === role);

  if (!user) {
    showToast('Invalid credentials or role mismatch.', 'error');
    return;
  }

  if (user.blocked) {
    showToast('Your account has been blocked. Contact admin.', 'error');
    return;
  }

  setSession(user);
  showToast(`Welcome back, ${user.name}! 👋`, 'success');
  const dest = { owner: 'owner.html', admin: 'admin.html', customer: 'customer.html' };
  setTimeout(() => window.location.href = dest[role] || 'customer.html', 700);
}

function handleRegister(e) {
  e.preventDefault();
  const name = document.getElementById('registerName').value.trim();
  const email = document.getElementById('registerEmail').value.trim().toLowerCase();
  const phone = document.getElementById('registerPhone').value.trim();
  const password = document.getElementById('registerPassword').value;
  const role = document.getElementById('registerRole').value;
  const business = document.getElementById('registerBusiness') ? document.getElementById('registerBusiness').value.trim() : '';

  // Validation
  if (!/^[0-9]{10}$/.test(phone.replace(/[\s\-+]/g, ''))) {
    showToast('Please enter a valid 10-digit phone number.', 'error');
    return;
  }

  const users = getStore('pk_users');
  if (users.find(u => u.email === email && u.role === role)) {
    showToast('An account with this email already exists for this role.', 'error');
    return;
  }

  const user = {
    id: generateId('usr'),
    name, email, phone, password, role,
    business: business || name,
    blocked: false,
    createdAt: Date.now()
  };

  users.push(user);
  setStore('pk_users', users);
  setSession(user);
  showToast(`Account created! Welcome, ${name}! 🎉`, 'success');
  const dest = { owner: 'owner.html', admin: 'admin.html', customer: 'customer.html' };
  setTimeout(() => window.location.href = dest[role] || 'customer.html', 700);
}

function handleForgotPassword(e) {
  e.preventDefault();
  const email = document.getElementById('forgotEmail').value.trim().toLowerCase();
  const role = _currentAuthRole;
  const resultEl = document.getElementById('forgotResult');

  const users = getStore('pk_users');
  const user = users.find(u => u.email === email && u.role === role);

  if (!user) {
    resultEl.innerHTML = `<div class="alert alert-error mt-2">No ${role} account found with this email.</div>`;
    return;
  }

  // Demo mode — show password
  resultEl.innerHTML = `
    <div class="alert alert-success mt-2">
      ✅ Account found! Your password is: <strong>${user.password}</strong>
      <br><small style="color:var(--gray-600);">In production, a reset link would be emailed.</small>
    </div>`;
}

function logout() {
  clearSession();
  window.location.href = 'index.html';
}

function requireAuth(role) {
  const session = getSession();
  if (!session || session.role !== role) {
    window.location.href = 'index.html';
    return null;
  }
  return session;
}

// =============================================
// SECTION 3: SLOT GENERATION & MANAGEMENT
// =============================================

function generateSlots(totalFloors, rows, columns, vehicleTypes) {
  const slots = [];
  let index = 0;
  for (let f = 0; f < totalFloors; f++) {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < columns; c++) {
        const rowLabel = String.fromCharCode(65 + r);
        const vType = vehicleTypes[index % vehicleTypes.length];
        slots.push({
          id: `F${f + 1}-${rowLabel}${c + 1}`,
          floor: f, row: r, col: c,
          status: 'available',
          vehicleType: vType,
          label: `F${f + 1}-${rowLabel}${c + 1}`
        });
        index++;
      }
    }
  }
  return slots;
}

// =============================================
// SECTION 4: INTELLIGENT SLOT ALLOCATION
// =============================================

function findOptimalSlot(parking, vehicleType) {
  const available = parking.slots.filter(s => s.status === 'available' && s.vehicleType === vehicleType);
  if (available.length === 0) return null;

  const floorStats = {};
  parking.slots.forEach(s => {
    if (!floorStats[s.floor]) floorStats[s.floor] = { total: 0, occupied: 0 };
    floorStats[s.floor].total++;
    if (s.status !== 'available') floorStats[s.floor].occupied++;
  });

  const maxFloor = Math.max(parking.totalFloors - 1, 1);
  const maxRow = Math.max(parking.rows - 1, 1);
  const maxCol = Math.max(parking.columns - 1, 1);
  const maxDist = maxFloor + maxRow + maxCol;
  const maxEdge = Math.floor(maxCol / 2) + maxRow;

  let bestSlot = null, bestScore = Infinity;

  for (const s of available) {
    const distScore = (s.floor + s.row + s.col) / (maxDist || 1);
    const fo = floorStats[s.floor];
    const occScore = fo.total > 0 ? fo.occupied / fo.total : 0;
    const edgeDist = Math.min(s.col, maxCol - s.col) + s.row;
    const accScore = edgeDist / (maxEdge || 1);
    const score = 0.5 * distScore + 0.3 * occScore + 0.2 * accScore;
    if (score < bestScore) { bestScore = score; bestSlot = s; }
  }

  return bestSlot;
}

// =============================================
// SECTION 5: DYNAMIC PRICING
// =============================================

function calculatePrice(parking) {
  const base = parking.pricePerHour;
  const breakdown = { base, occupancyMultiplier: 1, occupancyLabel: 'Standard rate', peakMultiplier: 1, peakLabel: '', final: base };

  if (!parking.dynamicPricing) { breakdown.final = base; return breakdown; }

  const total = parking.slots.length;
  const occupied = parking.slots.filter(s => s.status !== 'available').length;
  const occupancy = total > 0 ? occupied / total : 0;

  if (occupancy > 0.8) { breakdown.occupancyMultiplier = 1.5; breakdown.occupancyLabel = 'High demand (+50%)'; }
  else if (occupancy >= 0.5) { breakdown.occupancyMultiplier = 1.2; breakdown.occupancyLabel = 'Moderate demand (+20%)'; }
  else if (occupancy < 0.4) { breakdown.occupancyMultiplier = 0.8; breakdown.occupancyLabel = 'Low demand (−20%)'; }

  const hour = new Date().getHours();
  if (hour >= 18 && hour <= 22) { breakdown.peakMultiplier = 1.2; breakdown.peakLabel = 'Peak hours 6–10 PM (+20%)'; }

  breakdown.final = Math.round(base * breakdown.occupancyMultiplier * breakdown.peakMultiplier * 100) / 100;
  return breakdown;
}

function renderPriceBreakdown(breakdown) {
  let html = `<div class="price-breakdown">`;
  html += `<div class="price-row"><span>Base rate</span><span>₹${breakdown.base.toFixed(2)}/hr</span></div>`;
  if (breakdown.occupancyMultiplier !== 1) {
    html += `<div class="price-row"><span>${breakdown.occupancyLabel}</span><span class="price-surcharge">×${breakdown.occupancyMultiplier}</span></div>`;
  }
  if (breakdown.peakMultiplier !== 1) {
    html += `<div class="price-row"><span>${breakdown.peakLabel}</span><span class="price-surcharge">×${breakdown.peakMultiplier}</span></div>`;
  }
  html += `<div class="price-row total"><span>Effective rate</span><span class="price-tag">₹${breakdown.final.toFixed(2)}/hr</span></div>`;
  html += `</div>`;
  return html;
}

// =============================================
// SECTION 6: BOOKING FUNCTIONS
// =============================================

function createBookingWithDetails(parkingId, slotId, vehicleType, details = {}) {
  const user = getSession();
  if (!user) return { success: false, message: 'Not logged in' };

  const parkings = getStore('pk_parkings');
  const parking = parkings.find(p => p.id === parkingId);
  if (!parking) return { success: false, message: 'Parking not found' };

  const slot = parking.slots.find(s => s.id === slotId);
  if (!slot || slot.status !== 'available') return { success: false, message: 'Slot is not available' };

  // Check if user has active booking at same parking
  const existingBookings = getStore('pk_bookings');
  const hasActive = existingBookings.find(b => b.customerId === user.id && b.parkingId === parkingId && b.status === 'active');
  if (hasActive) return { success: false, message: 'You already have an active booking at this location.' };

  slot.status = 'reserved';
  setStore('pk_parkings', parkings);

  const pricing = calculatePrice(parking);

  const booking = {
    id: generateBookingId(),
    customerId: user.id,
    customerName: details.name || user.name,
    customerPhone: details.phone || user.phone,
    vehicleNumber: details.vehicleNumber || '',
    parkingId,
    parkingName: parking.name,
    parkingAddress: parking.address,
    ownerId: parking.ownerId,
    slotId: slot.id,
    vehicleType,
    startTime: Date.now(),
    scheduledDate: details.date || null,
    scheduledTime: details.time || null,
    endTime: null,
    status: 'active',
    paymentStatus: 'pending',
    pricePerHour: pricing.final,
    priceBreakdown: pricing,
    durationMinutes: 0,
    totalAmount: 0,
    createdAt: Date.now()
  };

  existingBookings.push(booking);
  setStore('pk_bookings', existingBookings);

  return { success: true, booking };
}

function endBooking(bookingId) {
  const bookings = getStore('pk_bookings');
  const booking = bookings.find(b => b.id === bookingId);
  if (!booking || booking.status !== 'active') return null;

  booking.endTime = Date.now();
  booking.status = 'completed';
  booking.paymentStatus = 'paid';

  const durationMs = booking.endTime - booking.startTime;
  const durationMinutes = Math.max(1, Math.ceil(durationMs / 60000));
  booking.durationMinutes = durationMinutes;
  booking.totalAmount = Math.round(booking.pricePerHour * (durationMinutes / 60) * 100) / 100;

  setStore('pk_bookings', bookings);

  // Free the slot
  const parkings = getStore('pk_parkings');
  const parking = parkings.find(p => p.id === booking.parkingId);
  if (parking) {
    const slot = parking.slots.find(s => s.id === booking.slotId);
    if (slot) { slot.status = 'available'; setStore('pk_parkings', parkings); }
  }

  return booking;
}

function cancelBooking(bookingId) {
  const bookings = getStore('pk_bookings');
  const booking = bookings.find(b => b.id === bookingId);
  if (!booking) return false;

  booking.status = 'cancelled';
  booking.endTime = Date.now();
  booking.paymentStatus = 'cancelled';
  setStore('pk_bookings', bookings);

  // Free the slot
  const parkings = getStore('pk_parkings');
  const parking = parkings.find(p => p.id === booking.parkingId);
  if (parking) {
    const slot = parking.slots.find(s => s.id === booking.slotId);
    if (slot) { slot.status = 'available'; setStore('pk_parkings', parkings); }
  }

  return true;
}

function generateReceiptHTML(booking) {
  const durH = Math.floor(booking.durationMinutes / 60);
  const durM = booking.durationMinutes % 60;
  const pb = booking.priceBreakdown || { base: booking.pricePerHour, occupancyMultiplier: 1, peakMultiplier: 1, final: booking.pricePerHour };

  return `
  <div class="receipt">
    <div class="receipt-header">
      <h3>🅿️ ParkSmart</h3>
      <p style="color:var(--gray-500);font-size:0.82rem;">Official Parking Receipt</p>
    </div>
    <div class="receipt-booking-id">${booking.id}</div>
    <div class="receipt-row"><span>Customer</span><span>${booking.customerName}</span></div>
    ${booking.vehicleNumber ? (() => {
      const pr = validateIndianPlate(booking.vehicleNumber);
      return `<div class="receipt-row"><span>Vehicle No.</span><span class="receipt-plate">${pr.valid ? pr.normalized : booking.vehicleNumber}</span></div>
      ${pr.valid ? `<div class="receipt-row"><span>Plate Type</span><span style="font-size:0.8rem;color:var(--gray-500);">${pr.type}${pr.state ? ' · '+pr.state : ''}</span></div>` : ''}`;
    })() : ''}
    <div class="receipt-row"><span>Parking</span><span>${booking.parkingName}</span></div>
    <div class="receipt-row"><span>Slot</span><span>${booking.slotId}</span></div>
    <div class="receipt-row"><span>Vehicle Type</span><span>${booking.vehicleType?.toUpperCase()}</span></div>
    <div class="receipt-row"><span>Start Time</span><span>${formatDateTime(booking.startTime)}</span></div>
    <div class="receipt-row"><span>End Time</span><span>${formatDateTime(booking.endTime)}</span></div>
    <div class="receipt-row"><span>Duration</span><span>${durH}h ${durM}m</span></div>
    <hr style="border:none;border-top:1.5px dashed var(--gray-200);margin:12px 0;">
    <div class="receipt-row"><span>Base Rate</span><span>₹${pb.base?.toFixed(2)}/hr</span></div>
    ${pb.occupancyMultiplier !== 1 ? `<div class="receipt-row"><span>${pb.occupancyLabel}</span><span>×${pb.occupancyMultiplier}</span></div>` : ''}
    ${pb.peakMultiplier !== 1 ? `<div class="receipt-row"><span>${pb.peakLabel}</span><span>×${pb.peakMultiplier}</span></div>` : ''}
    <div class="receipt-row"><span>Effective Rate</span><span>₹${booking.pricePerHour?.toFixed(2)}/hr</span></div>
    <div class="receipt-row total"><span>TOTAL AMOUNT</span><span>₹${booking.totalAmount?.toFixed(2)}</span></div>
    <div class="receipt-row"><span>Payment Status</span><span>${booking.paymentStatus === 'paid' ? '✅ Paid' : '⏳ Pending'}</span></div>
    <div class="receipt-footer">Thank you for using ParkSmart! Drive safe. 🚗</div>
  </div>`;
}

// =============================================
// SECTION 7: SLOT GRID RENDERING
// =============================================

function renderSlotGrid(parking, floor, containerId, options = {}) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const { selectable = false, vehicleFilter = null, onSelect = null } = options;
  let floorSlots = parking.slots.filter(s => s.floor === floor);
  floorSlots.sort((a, b) => a.row !== b.row ? a.row - b.row : a.col - b.col);

  let html = `<div class="slot-grid" style="grid-template-columns:repeat(${parking.columns},1fr);">`;
  floorSlots.forEach(slot => {
    let colorClass = 'slot-available';
    if (slot.status === 'occupied') colorClass = 'slot-occupied';
    else if (slot.status === 'reserved') colorClass = 'slot-reserved';

    let dimStyle = '';
    if (vehicleFilter && slot.vehicleType !== vehicleFilter) dimStyle = 'opacity:0.25;pointer-events:none;';

    const icon = slot.vehicleType === 'car' ? '🚗' : slot.vehicleType === 'bike' ? '🏍️' : '⚡';
    const clickable = selectable && slot.status === 'available' && (!vehicleFilter || slot.vehicleType === vehicleFilter);
    const clickHandler = clickable ? `onclick="selectSlot('${slot.id}','${containerId}')"` : '';

    html += `<div class="slot ${colorClass}" ${clickHandler} style="${dimStyle}" data-slot-id="${slot.id}" title="${slot.vehicleType} — ${slot.label} (${slot.status})">
      <span class="slot-label">${slot.label}</span>
      <span class="slot-icon">${icon}</span>
    </div>`;
  });
  html += `</div>`;
  container.innerHTML = html;
}

let _selectedSlotId = null;
function selectSlot(slotId, containerId) {
  _selectedSlotId = slotId;
  const container = document.getElementById(containerId);
  if (!container) return;
  container.querySelectorAll('.slot').forEach(el => el.classList.remove('slot-selected'));
  const selected = container.querySelector(`[data-slot-id="${slotId}"]`);
  if (selected) selected.classList.add('slot-selected');
  const bookBtn = document.getElementById('bookSelectedBtn');
  if (bookBtn) bookBtn.disabled = false;
}

// =============================================
// SECTION 8: INDEX PAGE
// =============================================

function initIndexPage() {
  renderPlatformAnalytics();
  renderHeroStats();

  // Close modal on overlay click
  const modal = document.getElementById('authModal');
  if (modal) modal.addEventListener('click', e => { if (e.target === e.currentTarget) closeAuthModal(); });

  // Check if already logged in
  const session = getSession();
  if (session) {
    // Add quick-access button
    const nav = document.querySelector('.nav-links');
    if (nav) {
      const dest = { owner: 'owner.html', admin: 'admin.html', customer: 'customer.html' };
      const btn = document.createElement('button');
      btn.className = 'btn btn-primary btn-sm';
      btn.textContent = `Go to Dashboard →`;
      btn.onclick = () => window.location.href = dest[session.role] || 'customer.html';
      nav.insertBefore(btn, nav.firstChild);
    }
  }
}

function renderHeroStats() {
  const users = getStore('pk_users');
  const parkings = getStore('pk_parkings');
  const bookings = getStore('pk_bookings');

  const owners = users.filter(u => u.role === 'owner').length;
  const locations = parkings.length;
  const totalBookings = bookings.length;
  const totalSlots = parkings.reduce((s, p) => s + (p.slots?.length || 0), 0);

  const set = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.querySelector('.val').textContent = val;
  };
  set('hStatOwners', owners);
  set('hStatLocations', locations);
  set('hStatBookings', totalBookings);
  set('hStatSlots', totalSlots);
}

function renderPlatformAnalytics() {
  const container = document.getElementById('platformStats');
  if (!container) return;

  const users = getStore('pk_users');
  const parkings = getStore('pk_parkings');
  const bookings = getStore('pk_bookings');

  const totalOwners = users.filter(u => u.role === 'owner').length;
  const totalCustomers = users.filter(u => u.role === 'customer').length;
  const totalLocations = parkings.length;
  const totalBookings = bookings.length;
  const totalRevenue = bookings.filter(b => b.status === 'completed').reduce((s, b) => s + (b.totalAmount || 0), 0);
  const totalSlots = parkings.reduce((s, p) => s + (p.slots?.length || 0), 0);
  const availSlots = parkings.reduce((s, p) => s + (p.slots?.filter(sl => sl.status === 'available').length || 0), 0);

  container.innerHTML = `
    <div class="stat-card"><div class="stat-icon-wrap">🏢</div><div class="stat-value">${totalOwners}</div><div class="stat-label">Parking Owners</div></div>
    <div class="stat-card green"><div class="stat-icon-wrap green">👥</div><div class="stat-value">${totalCustomers}</div><div class="stat-label">Customers</div></div>
    <div class="stat-card blue"><div class="stat-icon-wrap blue">📍</div><div class="stat-value">${totalLocations}</div><div class="stat-label">Locations</div></div>
    <div class="stat-card"><div class="stat-icon-wrap">🅿️</div><div class="stat-value">${availSlots}/${totalSlots}</div><div class="stat-label">Available Slots</div></div>
    <div class="stat-card purple"><div class="stat-icon-wrap purple">🎫</div><div class="stat-value">${totalBookings}</div><div class="stat-label">Total Bookings</div></div>
    <div class="stat-card green"><div class="stat-icon-wrap green">💰</div><div class="stat-value">₹${totalRevenue.toFixed(0)}</div><div class="stat-label">Platform Revenue</div></div>
  `;
}

// =============================================
// SECTION 9: CUSTOMER DASHBOARD
// =============================================

let _custNavHistory = [];
let _vehicleFilter = '';
let _allParkings = [];

function initCustomerPage() {
  const user = requireAuth('customer');
  if (!user) return;

  const el = document.getElementById('custGreeting');
  if (el) el.textContent = user.name;

  renderCustomerParkings();
  renderCustomerBookings();
  renderCustomerHistory();
  populateMisparkSelect();

  // Close modals on overlay
  ['bookingFormModal', 'receiptModal', 'custSlotModal'].forEach(id => {
    const modal = document.getElementById(id);
    if (modal) modal.addEventListener('click', e => { if (e.target === e.currentTarget) modal.classList.remove('active'); });
  });

  // Auto-refresh every 30s
  setInterval(() => {
    if (document.getElementById('sec-browse')?.classList.contains('active')) renderCustomerParkings();
  }, 30000);
}

function custNav(section, btnEl) {
  document.querySelectorAll('.page-section').forEach(s => s.classList.remove('active'));
  const sec = document.getElementById('sec-' + section);
  if (sec) sec.classList.add('active');

  document.querySelectorAll('.tab-nav-btn').forEach(b => b.classList.remove('active'));
  if (btnEl) btnEl.classList.add('active');

  if (section === 'bookings') renderCustomerBookings();
  if (section === 'history') renderCustomerHistory();
  if (section === 'browse') renderCustomerParkings();
  if (section === 'mispark') populateMisparkSelect();
}

function filterByVehicle(type) {
  _vehicleFilter = type;
  ['all', 'car', 'bike', 'ev'].forEach(v => {
    const btn = document.getElementById(`vf-${v}`);
    if (btn) {
      const active = (v === 'all' && type === '') || v === type;
      btn.style.background = active ? 'var(--primary-light)' : '';
      btn.style.color = active ? 'var(--primary-dark)' : '';
      btn.style.borderColor = active ? 'var(--primary)' : '';
      btn.className = active ? 'btn btn-sm btn-outline' : 'btn btn-sm btn-ghost';
    }
  });
  renderCustomerParkings();
}

function filterParkings(query) {
  renderCustomerParkings(query);
}

function renderCustomerParkings(searchQuery = '') {
  const parkings = getStore('pk_parkings');
  const container = document.getElementById('customerParkingsList');
  if (!container) return;

  let filtered = parkings;
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    filtered = parkings.filter(p => p.name.toLowerCase().includes(q) || p.address.toLowerCase().includes(q));
  }
  if (_vehicleFilter) {
    filtered = filtered.filter(p => p.vehicleTypes && p.vehicleTypes.includes(_vehicleFilter));
  }

  if (filtered.length === 0) {
    container.innerHTML = `<div class="empty-state">
      <div class="empty-icon">🔍</div>
      <h3>${parkings.length === 0 ? 'No parking locations yet' : 'No results found'}</h3>
      <p>${parkings.length === 0 ? "Owners haven't registered spaces yet. Check the demo." : 'Try different search terms or vehicle type.'}</p>
      ${parkings.length === 0 ? `<a href="demo.html" class="btn btn-primary mt-3">View Demo</a>` : ''}
    </div>`;
    return;
  }

  let html = '<div class="parking-grid">';
  filtered.forEach(p => {
    const totalSlots = p.slots?.length || 0;
    const available = p.slots?.filter(s => s.status === 'available').length || 0;
    const occupied = totalSlots - available;
    const availPct = totalSlots > 0 ? (available / totalSlots) * 100 : 0;
    const fillClass = availPct > 60 ? 'high' : availPct > 30 ? 'medium' : 'low';
    const pricing = calculatePrice(p);

    const badges = (p.vehicleTypes || []).map(vt => {
      const icon = vt === 'car' ? '🚗' : vt === 'bike' ? '🏍️' : '⚡';
      return `<span class="badge badge-${vt}">${icon} ${vt}</span>`;
    }).join('');

    html += `
    <div class="parking-card">
      <div class="parking-card-header">
        <h3>${p.name}</h3>
        <p style="font-size:0.82rem;color:var(--gray-500);margin-top:4px;">📍 ${p.address}</p>
      </div>
      <div class="parking-card-body">
        <div class="info-row">
          <span class="icon">🟢</span>
          <strong style="color:${available > 0 ? 'var(--success)' : 'var(--danger)'};">${available} available</strong>
          <span style="color:var(--gray-400);">/ ${totalSlots} total</span>
        </div>
        <div class="avail-bar"><div class="avail-fill ${fillClass}" style="width:${availPct}%"></div></div>
        <div class="info-row"><span class="icon">🏢</span>${p.totalFloors} Floor(s) · ${p.rows}×${p.columns} layout</div>
        <div class="info-row">
          <span class="icon">💰</span>
          <strong>₹${pricing.final.toFixed(2)}/hr</strong>
          ${p.dynamicPricing ? '<span class="badge badge-dynamic" style="font-size:0.68rem;margin-left:6px;">⚡ Dynamic</span>' : ''}
        </div>
        <div class="badges-row">${badges}</div>
      </div>
      <div class="parking-card-footer">
        ${available > 0
          ? `<button class="btn btn-primary btn-sm" onclick="viewParkingDetail('${p.id}')">🎫 Book Now</button>`
          : `<button class="btn btn-secondary btn-sm" disabled>Full 🔴</button>`
        }
        <button class="btn btn-ghost btn-sm" onclick="viewSlotGridOnly('${p.id}')">View Map</button>
      </div>
    </div>`;
  });
  html += '</div>';
  container.innerHTML = html;
}

// ===== PARKING DETAIL & BOOKING =====
let _custParkingId = null;
let _custFloor = 0;
let _custVehicle = null;

function viewParkingDetail(parkingId) {
  _custParkingId = parkingId;
  _custFloor = 0;
  _selectedSlotId = null;

  const parkings = getStore('pk_parkings');
  const parking = parkings.find(p => p.id === parkingId);
  if (!parking) return;

  _custVehicle = parking.vehicleTypes?.[0] || 'car';

  document.querySelectorAll('.page-section').forEach(s => s.classList.remove('active'));
  document.getElementById('sec-parking-detail')?.classList.add('active');
  document.querySelectorAll('.tab-nav-btn').forEach(b => b.classList.remove('active'));

  renderParkingDetail();
}

function viewSlotGridOnly(parkingId) {
  const parkings = getStore('pk_parkings');
  const parking = parkings.find(p => p.id === parkingId);
  if (!parking) return;

  const modal = document.getElementById('custSlotModal');
  const body = document.getElementById('custSlotModalBody');
  const title = document.getElementById('custSlotModalTitle');
  if (!modal || !body) return;

  title.textContent = parking.name + ' — Slot Map';

  let html = `<p style="color:var(--gray-600);font-size:0.875rem;margin-bottom:12px;">📍 ${parking.address}</p>`;
  html += `<div class="floor-tabs" id="modalFloorTabs">`;
  for (let f = 0; f < parking.totalFloors; f++) {
    html += `<button class="floor-tab ${f === 0 ? 'active' : ''}" onclick="switchViewFloor('${parking.id}',${f},this)">${f + 1}F</button>`;
  }
  html += `</div><div id="viewSlotGrid"></div>`;
  html += `<div class="slot-legend mt-2">
    <span><span class="legend-dot green"></span> Available</span>
    <span><span class="legend-dot yellow"></span> Reserved</span>
    <span><span class="legend-dot red"></span> Occupied</span>
  </div>`;

  body.innerHTML = html;
  renderSlotGrid(parking, 0, 'viewSlotGrid');
  modal.classList.add('active');
}

function switchViewFloor(parkingId, floor, btn) {
  const parkings = getStore('pk_parkings');
  const parking = parkings.find(p => p.id === parkingId);
  if (!parking) return;
  document.querySelectorAll('#modalFloorTabs .floor-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderSlotGrid(parking, floor, 'viewSlotGrid');
}

function closeCustSlotModal() {
  document.getElementById('custSlotModal')?.classList.remove('active');
}

function renderParkingDetail() {
  const parkings = getStore('pk_parkings');
  const parking = parkings.find(p => p.id === _custParkingId);
  if (!parking) return;

  const container = document.getElementById('parkingDetailView');
  if (!container) return;

  const totalSlots = parking.slots?.length || 0;
  const available = parking.slots?.filter(s => s.status === 'available').length || 0;
  const pricing = calculatePrice(parking);

  let html = `
  <div class="flex-between mb-3">
    <div>
      <h2 class="section-title">${parking.name}</h2>
      <p class="section-subtitle">📍 ${parking.address} · ${parking.totalFloors} Floor(s) · <strong style="color:${available > 0 ? 'var(--success)' : 'var(--danger)'};">${available}/${totalSlots} available</strong></p>
    </div>
  </div>`;

  html += renderPriceBreakdown(pricing);

  // Vehicle type selector
  html += `<h3 style="font-weight:700;margin:20px 0 10px;font-size:1rem;">Select Vehicle Type</h3>
  <div class="vehicle-select">`;
  (parking.vehicleTypes || ['car']).forEach(vt => {
    const icon = vt === 'car' ? '🚗' : vt === 'bike' ? '🏍️' : '⚡';
    const typeAvail = parking.slots?.filter(s => s.status === 'available' && s.vehicleType === vt).length || 0;
    html += `<button class="vehicle-option ${_custVehicle === vt ? 'selected' : ''}" onclick="custSelectVehicle('${vt}')">
      ${icon} ${vt.toUpperCase()} <span style="font-size:0.75rem;font-weight:400;color:var(--gray-400);">(${typeAvail} free)</span>
    </button>`;
  });
  html += `</div>`;

  // Floor tabs
  html += `<div class="floor-tabs" style="margin:16px 0 8px;">`;
  for (let f = 0; f < parking.totalFloors; f++) {
    const floorAvail = parking.slots?.filter(s => s.floor === f && s.status === 'available').length || 0;
    html += `<button class="floor-tab ${f === _custFloor ? 'active' : ''}" onclick="custSelectFloor(${f})">
      Floor ${f + 1} <span style="font-size:0.7rem;">(${floorAvail})</span>
    </button>`;
  }
  html += `</div>`;

  // Slot grid
  html += `<div id="custSlotGridInner"></div>`;
  html += `<div class="slot-legend mt-2">
    <span><span class="legend-dot green"></span> Available (click to select)</span>
    <span><span class="legend-dot yellow"></span> Reserved</span>
    <span><span class="legend-dot red"></span> Occupied</span>
  </div>`;

  // Booking actions
  html += `
  <div class="booking-form-card mt-3">
    <h3>🎫 Book a Slot</h3>
    <p class="subtitle">Select a green slot above, then fill in your details below.</p>
    <div id="selectedSlotDisplay" style="margin-bottom:14px;"></div>
    <button class="btn btn-primary btn-sm" id="bookSelectedBtn" disabled onclick="openBookingForm('selected')">
      🎫 Book Selected Slot
    </button>
    <button class="btn btn-outline btn-sm" onclick="openBookingForm('smart')" style="margin-left:8px;">
      🧠 Smart Allocate
    </button>
    <div id="bookingFeedback" class="mt-2"></div>
  </div>`;

  container.innerHTML = html;

  // Render slot grid
  renderSlotGrid(parking, _custFloor, 'custSlotGridInner', {
    selectable: true,
    vehicleFilter: _custVehicle
  });
}

function custSelectVehicle(vt) {
  _custVehicle = vt;
  _selectedSlotId = null;
  renderParkingDetail();
}

function custSelectFloor(f) {
  _custFloor = f;
  _selectedSlotId = null;
  const parkings = getStore('pk_parkings');
  const parking = parkings.find(p => p.id === _custParkingId);
  if (!parking) return;
  document.querySelectorAll('.floor-tab').forEach((tab, i) => tab.classList.toggle('active', i === f));
  renderSlotGrid(parking, f, 'custSlotGridInner', { selectable: true, vehicleFilter: _custVehicle });
  const bookBtn = document.getElementById('bookSelectedBtn');
  if (bookBtn) bookBtn.disabled = true;
  _selectedSlotId = null;
}

// Override selectSlot to also update display
const _origSelectSlot = selectSlot;
function selectSlot(slotId, containerId) {
  _selectedSlotId = slotId;
  const container = document.getElementById(containerId);
  if (!container) return;
  container.querySelectorAll('.slot').forEach(el => el.classList.remove('slot-selected'));
  const selected = container.querySelector(`[data-slot-id="${slotId}"]`);
  if (selected) selected.classList.add('slot-selected');

  const bookBtn = document.getElementById('bookSelectedBtn');
  if (bookBtn) bookBtn.disabled = false;

  const display = document.getElementById('selectedSlotDisplay');
  if (display) {
    display.innerHTML = `<div class="alert alert-info">Selected: <strong>${slotId}</strong> · ${_custVehicle?.toUpperCase()}</div>`;
  }
}

// ===== BOOKING FORM MODAL =====
let _bookingMode = 'selected';
function openBookingForm(mode) {
  _bookingMode = mode;
  const parkings = getStore('pk_parkings');
  const parking = parkings.find(p => p.id === _custParkingId);
  if (!parking) return;

  let slotToBook = null;
  if (mode === 'smart') {
    slotToBook = findOptimalSlot(parking, _custVehicle);
    if (!slotToBook) { showToast(`No ${_custVehicle} slots available.`, 'error'); return; }
  } else {
    if (!_selectedSlotId) { showToast('Please select a slot first.', 'error'); return; }
    slotToBook = parking.slots.find(s => s.id === _selectedSlotId);
    if (!slotToBook || slotToBook.status !== 'available') { showToast('Selected slot is no longer available.', 'error'); renderParkingDetail(); return; }
  }

  const modal = document.getElementById('bookingFormModal');
  const body = document.getElementById('bookingFormModalBody');
  const user = getSession();
  const pricing = calculatePrice(parking);
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  const timeStr = now.toTimeString().slice(0, 5);

  body.innerHTML = `
  <div style="background:var(--gray-50);border-radius:10px;padding:14px;margin-bottom:20px;">
    <div class="info-row"><span class="icon">📍</span> ${parking.name}</div>
    <div class="info-row"><span class="icon">🅿️</span> Slot: <strong>${slotToBook.label}</strong> ${mode === 'smart' ? '<span class="badge badge-active" style="font-size:0.7rem;">Smart Pick</span>' : ''}</div>
    <div class="info-row"><span class="icon">💰</span> ₹${pricing.final.toFixed(2)}/hr</div>
  </div>
  <form id="custBookingForm" onsubmit="submitBooking(event,'${parking.id}','${slotToBook.id}','${_custVehicle}')">
    <div class="form-group">
      <label>Your Name</label>
      <input type="text" id="bfName" value="${user?.name || ''}" required placeholder="Full name">
    </div>

    <div class="form-group">
      <label>
        Vehicle Registration Number
        <span class="plate-format-badge">🇮🇳 Indian Format</span>
      </label>
      <input
        type="text"
        id="bfVehicle"
        placeholder="e.g., TS09AB1234"
        required
        autocomplete="off"
        maxlength="13"
        oninput="liveFormatPlate(this)"
        style="font-family:monospace;font-size:1rem;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;"
      >
      <div id="plateValidationMsg" class="plate-feedback"></div>
      <div class="plate-examples">
        <span class="examples-label">Valid formats:</span>
        <span class="plate-example" onclick="fillPlateExample('TS09AB1234')">TS09AB1234</span>
        <span class="plate-example" onclick="fillPlateExample('MH12CD5678')">MH12CD5678</span>
        <span class="plate-example" onclick="fillPlateExample('DL3CAB0001')">DL3CAB0001</span>
        <span class="plate-example" onclick="fillPlateExample('22BH0001AA')">22BH0001AA</span>
      </div>
    </div>

    <div class="form-row">
      <div class="form-group">
        <label>Phone</label>
        <input type="tel" id="bfPhone" value="${user?.phone || ''}" required placeholder="10-digit number">
      </div>
      <div class="form-group">
        <label>Vehicle Type</label>
        <input type="text" value="${_custVehicle?.toUpperCase()}" readonly style="background:var(--gray-50);color:var(--gray-600);">
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Date</label>
        <input type="date" id="bfDate" value="${dateStr}" required>
      </div>
      <div class="form-group">
        <label>Time</label>
        <input type="time" id="bfTime" value="${timeStr}" required>
      </div>
    </div>
    <button type="submit" class="btn btn-primary btn-block mt-2">✅ Confirm Booking</button>
    <button type="button" class="btn btn-ghost btn-block mt-1" onclick="closeBookingFormModal()">Cancel</button>
  </form>`;

  modal.classList.add('active');
}

function closeBookingFormModal() {
  document.getElementById('bookingFormModal')?.classList.remove('active');
}

function fillPlateExample(plate) {
  const input = document.getElementById('bfVehicle');
  if (!input) return;
  input.value = plate;
  liveFormatPlate(input);
}

function submitBooking(e, parkingId, slotId, vehicleType) {
  e.preventDefault();
  const name          = document.getElementById('bfName').value.trim();
  const rawVehicle    = document.getElementById('bfVehicle').value.trim();
  const phone         = document.getElementById('bfPhone').value.trim();
  const date          = document.getElementById('bfDate').value;
  const time          = document.getElementById('bfTime').value;

  // ── Indian plate validation ──────────────────────────────────
  const plateResult = validateIndianPlate(rawVehicle);
  if (!plateResult.valid) {
    const feedbackEl = document.getElementById('plateValidationMsg');
    if (feedbackEl) {
      feedbackEl.innerHTML = `<span class="plate-error">⚠️ ${plateResult.error}</span>`;
      feedbackEl.className = 'plate-feedback invalid';
    }
    document.getElementById('bfVehicle').focus();
    showToast('Please enter a valid Indian vehicle number.', 'error');
    return;
  }

  // Store the compact (no-space) version in the booking
  const vehicleNumber = plateResult.compact;
  // ────────────────────────────────────────────────────────────

  const result = createBookingWithDetails(parkingId, slotId, vehicleType, { name, vehicleNumber, phone, date, time });

  if (result.success) {
    closeBookingFormModal();

    const feedback = document.getElementById('bookingFeedback');
    if (feedback) {
      feedback.innerHTML = `
      <div class="booking-success-banner mt-3">
        <div class="big-check">🎉</div>
        <h3>Booking Confirmed!</h3>
        <p style="color:var(--gray-600);font-size:0.875rem;">Your slot has been reserved successfully.</p>
        <div class="plate-confirmed-wrap">
          <span class="plate-confirmed-label">Vehicle</span>
          <span class="plate-confirmed">${plateResult.normalized}</span>
          <span class="plate-confirmed-type">${plateResult.type}</span>
        </div>
        <div class="booking-id-display">${result.booking.id}</div>
        <div style="margin-top:16px;display:flex;gap:10px;justify-content:center;flex-wrap:wrap;">
          <button class="btn btn-success btn-sm" onclick="viewReceipt('${result.booking.id}')">🧾 View Receipt</button>
          <button class="btn btn-secondary btn-sm" onclick="custNav('bookings')">My Bookings</button>
        </div>
      </div>`;
    }

    showToast(`✅ Slot ${slotId} booked! ID: ${result.booking.id}`, 'success');
    _selectedSlotId = null;
    setTimeout(() => renderParkingDetail(), 300);
  } else {
    showToast(result.message, 'error');
  }
}

// ===== CUSTOMER BOOKINGS =====
let _timerIntervals = {};

function renderCustomerBookings() {
  const user = getSession();
  if (!user) return;

  Object.values(_timerIntervals).forEach(clearInterval);
  _timerIntervals = {};

  const bookings = getStore('pk_bookings').filter(b => b.customerId === user.id && b.status === 'active');
  const container = document.getElementById('activeBookingsList');
  if (!container) return;

  if (bookings.length === 0) {
    container.innerHTML = `<div class="empty-state">
      <div class="empty-icon">🅿️</div>
      <h3>No active bookings</h3>
      <p>Browse available parking locations to make a booking.</p>
      <button class="btn btn-primary mt-3" onclick="custNav('browse')">Find Parking</button>
    </div>`;
    return;
  }

  let html = '';
  bookings.forEach(b => {
    html += `
    <div class="booking-card active-booking">
      <div class="flex-between">
        <div>
          <h3 style="font-size:1rem;font-weight:700;">${b.parkingName}</h3>
          <p style="font-size:0.82rem;color:var(--gray-500);">📍 ${b.parkingAddress || ''}</p>
          <p style="font-size:0.82rem;color:var(--gray-600);margin-top:4px;">
            Slot: <strong>${b.slotId}</strong> · ${b.vehicleType?.toUpperCase()}
            ${b.vehicleNumber ? (() => {
              const pr = validateIndianPlate(b.vehicleNumber);
              return `· <span class="receipt-plate" style="font-size:0.82rem;padding:2px 7px;">${pr.valid ? pr.normalized : b.vehicleNumber}</span>`;
            })() : ''}
          </p>
          <p style="font-size:0.8rem;color:var(--gray-400);">Booking ID: ${b.id} · Started: ${formatDateTime(b.startTime)}</p>
        </div>
        <div style="text-align:right;flex-shrink:0;">
          <div class="booking-timer" id="timer-${b.id}">00:00:00</div>
          <div class="booking-cost-live" id="cost-${b.id}">₹0.00</div>
          <p style="font-size:0.78rem;color:var(--gray-400);">₹${b.pricePerHour?.toFixed(2)}/hr</p>
        </div>
      </div>
      <div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap;">
        <button class="btn btn-danger btn-sm" onclick="handleEndBooking('${b.id}')">⏹ End Session</button>
        <button class="btn btn-ghost btn-sm" onclick="handleCancelBooking('${b.id}')">✕ Cancel</button>
        <button class="btn btn-secondary btn-sm" onclick="viewReceipt('${b.id}')">🧾 Preview</button>
      </div>
    </div>`;
  });
  container.innerHTML = html;

  bookings.forEach(b => {
    updateTimer(b);
    _timerIntervals[b.id] = setInterval(() => updateTimer(b), 1000);
  });
}

function renderCustomerHistory() {
  const user = getSession();
  if (!user) return;

  const bookings = getStore('pk_bookings')
    .filter(b => b.customerId === user.id && b.status !== 'active')
    .sort((a, b) => (b.endTime || b.createdAt) - (a.endTime || a.createdAt));

  const container = document.getElementById('historyBookingsList');
  if (!container) return;

  if (bookings.length === 0) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">📋</div><h3>No booking history</h3><p>Your completed and cancelled bookings will appear here.</p></div>`;
    return;
  }

  let html = '<div class="table-wrap"><table><thead><tr><th>Booking ID</th><th>Parking</th><th>Slot</th><th>Date</th><th>Duration</th><th>Amount</th><th>Status</th><th></th></tr></thead><tbody>';
  bookings.forEach(b => {
    const durH = Math.floor(b.durationMinutes / 60);
    const durM = b.durationMinutes % 60;
    html += `<tr>
      <td><span style="font-family:monospace;font-weight:700;font-size:0.85rem;">${b.id}</span></td>
      <td>${b.parkingName}</td>
      <td>${b.slotId}</td>
      <td>${formatDate(b.startTime)}</td>
      <td>${b.durationMinutes > 0 ? `${durH}h ${durM}m` : '—'}</td>
      <td><strong>₹${(b.totalAmount || 0).toFixed(2)}</strong></td>
      <td>${statusBadge(b.status)}</td>
      <td>${b.status === 'completed' ? `<button class="btn btn-secondary btn-sm" onclick="viewReceipt('${b.id}')">🧾</button>` : ''}</td>
    </tr>`;
  });
  html += '</tbody></table></div>';
  container.innerHTML = html;
}

function updateTimer(booking) {
  const elapsed = Date.now() - booking.startTime;
  const timerEl = document.getElementById('timer-' + booking.id);
  const costEl = document.getElementById('cost-' + booking.id);
  if (timerEl) timerEl.textContent = formatDuration(elapsed);
  if (costEl) costEl.textContent = `₹${(booking.pricePerHour * elapsed / 3600000).toFixed(2)}`;
}

function handleEndBooking(bookingId) {
  if (!confirm('End this parking session? You will be billed for the time used.')) return;
  if (_timerIntervals[bookingId]) { clearInterval(_timerIntervals[bookingId]); delete _timerIntervals[bookingId]; }
  const booking = endBooking(bookingId);
  if (booking) {
    showToast(`Session ended. Total: ₹${booking.totalAmount.toFixed(2)}`, 'success');
    renderCustomerBookings();
    viewReceipt(bookingId);
  }
}

function handleCancelBooking(bookingId) {
  if (!confirm('Cancel this booking? The slot will be freed.')) return;
  if (_timerIntervals[bookingId]) { clearInterval(_timerIntervals[bookingId]); delete _timerIntervals[bookingId]; }
  if (cancelBooking(bookingId)) {
    showToast('Booking cancelled.', 'info');
    renderCustomerBookings();
    renderCustomerHistory();
  }
}

function viewReceipt(bookingId) {
  const bookings = getStore('pk_bookings');
  const booking = bookings.find(b => b.id === bookingId);
  if (!booking) return;
  document.getElementById('receiptModalBody').innerHTML = generateReceiptHTML(booking);
  document.getElementById('receiptModal').classList.add('active');
}

function closeReceiptModal() {
  document.getElementById('receiptModal')?.classList.remove('active');
}

// ===== MISPARK =====
function populateMisparkSelect() {
  const user = getSession();
  if (!user) return;
  const bookings = getStore('pk_bookings').filter(b => b.customerId === user.id && b.status === 'active');
  const select = document.getElementById('misparkBookingSelect');
  if (!select) return;
  select.innerHTML = '<option value="">-- Select an active booking --</option>';
  bookings.forEach(b => {
    select.innerHTML += `<option value="${b.id}">${b.parkingName} — Slot ${b.slotId} (${b.id})</option>`;
  });
  const result = document.getElementById('misparkResult');
  if (result) result.innerHTML = '';
}

function handleMisparkCheck(e) {
  e.preventDefault();
  const bookingId = document.getElementById('misparkBookingSelect').value;
  const currentSlot = document.getElementById('misparkCurrentSlot').value.trim().toUpperCase();
  if (!bookingId) { showToast('Please select a booking.', 'error'); return; }
  const booking = getStore('pk_bookings').find(b => b.id === bookingId);
  if (!booking) return;
  const resultEl = document.getElementById('misparkResult');

  // Show booking plate info
  const pr = booking.vehicleNumber ? validateIndianPlate(booking.vehicleNumber) : null;
  const plateDisplay = pr?.valid ? pr.normalized : (booking.vehicleNumber || '—');

  if (booking.slotId.toUpperCase() === currentSlot) {
    resultEl.innerHTML = `<div class="mispark-result mispark-match mt-2">
      <h3>✅ No Mispark Detected</h3>
      <p>Vehicle <strong style="font-family:monospace;">${plateDisplay}</strong> is correctly parked at slot <strong>${booking.slotId}</strong>.</p>
      ${pr?.valid ? `<p style="font-size:0.82rem;margin-top:6px;color:#065F46;">${pr.type}${pr.state ? ' · '+pr.state : ''}</p>` : ''}
    </div>`;
  } else {
    resultEl.innerHTML = `<div class="mispark-result mispark-mismatch mt-2">
      <h3>🚨 MISPARK DETECTED!</h3>
      <p>Vehicle <strong style="font-family:monospace;">${plateDisplay}</strong> is at slot <strong>${currentSlot}</strong> but booking is for slot <strong>${booking.slotId}</strong>.</p>
      <p class="mt-1">Please move to the correct slot immediately to avoid penalties.</p>
    </div>`;
    showToast('⚠️ Mispark detected!', 'error');
  }
}

// =============================================
// SECTION 10: OWNER DASHBOARD
// =============================================

function initOwnerPage() {
  const user = requireAuth('owner');
  if (!user) return;
  const el = document.getElementById('ownerGreeting');
  if (el) el.textContent = user.name;

  renderOwnerStats();
  renderOwnerRecentBookings();
  renderOwnerParkings();
  renderOwnerBookings();
  renderReports('all');

  ['ownerSlotModal', 'ownerBookingModal'].forEach(id => {
    const modal = document.getElementById(id);
    if (modal) modal.addEventListener('click', e => { if (e.target === e.currentTarget) modal.classList.remove('active'); });
  });
}

function ownerNav(section, btnEl) {
  document.querySelectorAll('.page-section').forEach(s => s.classList.remove('active'));
  document.getElementById('sec-' + section)?.classList.add('active');
  document.querySelectorAll('.tab-nav-btn').forEach(b => b.classList.remove('active'));
  if (btnEl) btnEl.classList.add('active');

  if (section === 'bookings') renderOwnerBookings();
  if (section === 'parkings') renderOwnerParkings();
  if (section === 'reports') renderReports('all');
  if (section === 'dashboard') { renderOwnerStats(); renderOwnerRecentBookings(); }
}

function renderOwnerStats() {
  const user = getSession();
  if (!user) return;

  const parkings = getStore('pk_parkings').filter(p => p.ownerId === user.id);
  const bookings = getStore('pk_bookings');

  let totalSlots = 0, availableSlots = 0, bookedSlots = 0, totalRevenue = 0, activeBookings = 0;

  parkings.forEach(p => {
    totalSlots += p.slots?.length || 0;
    availableSlots += p.slots?.filter(s => s.status === 'available').length || 0;
    bookedSlots += p.slots?.filter(s => s.status !== 'available').length || 0;
    const pBookings = bookings.filter(b => b.parkingId === p.id);
    totalRevenue += pBookings.filter(b => b.status === 'completed').reduce((s, b) => s + (b.totalAmount || 0), 0);
    activeBookings += pBookings.filter(b => b.status === 'active').length;
  });

  const container = document.getElementById('ownerStats');
  if (!container) return;

  container.innerHTML = `
    <div class="stat-card"><div class="stat-icon-wrap">🏢</div><div class="stat-value">${parkings.length}</div><div class="stat-label">My Parkings</div></div>
    <div class="stat-card blue"><div class="stat-icon-wrap blue">🅿️</div><div class="stat-value">${totalSlots}</div><div class="stat-label">Total Slots</div></div>
    <div class="stat-card green"><div class="stat-icon-wrap green">🟢</div><div class="stat-value">${availableSlots}</div><div class="stat-label">Available Slots</div></div>
    <div class="stat-card red"><div class="stat-icon-wrap red">🔴</div><div class="stat-value">${bookedSlots}</div><div class="stat-label">Booked Slots</div></div>
    <div class="stat-card"><div class="stat-icon-wrap">🎫</div><div class="stat-value">${activeBookings}</div><div class="stat-label">Active Sessions</div></div>
    <div class="stat-card green"><div class="stat-icon-wrap green">💰</div><div class="stat-value">₹${totalRevenue.toFixed(0)}</div><div class="stat-label">Total Earnings</div></div>
  `;
}

function renderOwnerRecentBookings() {
  const user = getSession();
  if (!user) return;
  const parkings = getStore('pk_parkings').filter(p => p.ownerId === user.id).map(p => p.id);
  const bookings = getStore('pk_bookings')
    .filter(b => parkings.includes(b.parkingId))
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 5);

  const container = document.getElementById('ownerRecentBookings');
  if (!container) return;

  if (bookings.length === 0) {
    container.innerHTML = `<div class="empty-state" style="padding:30px;"><div class="empty-icon">🎫</div><h3>No bookings yet</h3></div>`;
    return;
  }

  let html = '<div class="table-wrap"><table><thead><tr><th>Booking ID</th><th>Customer</th><th>Parking</th><th>Slot</th><th>Time</th><th>Status</th></tr></thead><tbody>';
  bookings.forEach(b => {
    html += `<tr>
      <td><span style="font-family:monospace;font-size:0.82rem;font-weight:700;">${b.id}</span></td>
      <td>${b.customerName}</td>
      <td>${b.parkingName}</td>
      <td>${b.slotId}</td>
      <td>${formatDateTime(b.startTime)}</td>
      <td>${statusBadge(b.status)}</td>
    </tr>`;
  });
  html += '</tbody></table></div>';
  container.innerHTML = html;
}

function handleCreateParking(e) {
  e.preventDefault();
  const user = getSession();
  const name = document.getElementById('cpName').value.trim();
  const address = document.getElementById('cpAddress').value.trim();
  const totalFloors = parseInt(document.getElementById('cpFloors').value);
  const pricePerHour = parseFloat(document.getElementById('cpPrice').value);
  const rows = parseInt(document.getElementById('cpRows').value);
  const columns = parseInt(document.getElementById('cpCols').value);
  const dynamicPricing = document.getElementById('cpDynamic')?.checked || false;

  const vehicleTypes = [];
  document.querySelectorAll('#createParkingForm .checkbox-group input:checked').forEach(cb => vehicleTypes.push(cb.value));

  if (vehicleTypes.length === 0) { showToast('Please select at least one vehicle type.', 'error'); return; }

  const slots = generateSlots(totalFloors, rows, columns, vehicleTypes);
  const parking = {
    id: generateId('prk'),
    ownerId: user.id, ownerName: user.name,
    name, address, totalFloors, pricePerHour, rows, columns,
    vehicleTypes, dynamicPricing, slots,
    createdAt: Date.now()
  };

  const parkings = getStore('pk_parkings');
  parkings.push(parking);
  setStore('pk_parkings', parkings);

  showToast(`"${name}" created with ${slots.length} slots! 🎉`, 'success');
  e.target.reset();
  document.querySelector('#createParkingForm .checkbox-group input[value="car"]').checked = true;
  renderOwnerStats();
  renderOwnerParkings();
  ownerNav('parkings');
}

function renderOwnerParkings() {
  const user = getSession();
  if (!user) return;
  const parkings = getStore('pk_parkings').filter(p => p.ownerId === user.id);
  const bookings = getStore('pk_bookings');
  const container = document.getElementById('ownerParkingsList');
  if (!container) return;

  if (parkings.length === 0) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">🏗️</div><h3>No parking locations</h3><p>Click "Add Parking" to register your first space.</p><button class="btn btn-primary mt-3" onclick="ownerNav('create')">Add Parking</button></div>`;
    return;
  }

  let html = '<div class="parking-grid">';
  parkings.forEach(p => {
    const totalSlots = p.slots?.length || 0;
    const available = p.slots?.filter(s => s.status === 'available').length || 0;
    const occupied = totalSlots - available;
    const pBookings = bookings.filter(b => b.parkingId === p.id);
    const revenue = pBookings.filter(b => b.status === 'completed').reduce((s, b) => s + (b.totalAmount || 0), 0);
    const activeCount = pBookings.filter(b => b.status === 'active').length;
    const availPct = totalSlots > 0 ? (available / totalSlots * 100).toFixed(0) : 0;
    const fillClass = parseInt(availPct) > 60 ? 'high' : parseInt(availPct) > 30 ? 'medium' : 'low';
    const badges = (p.vehicleTypes || []).map(vt => `<span class="badge badge-${vt}">${vt === 'car' ? '🚗' : vt === 'bike' ? '🏍️' : '⚡'} ${vt}</span>`).join('');

    html += `
    <div class="parking-card">
      <div class="parking-card-header">
        <div class="flex-between">
          <h3>${p.name}</h3>
          <span class="badge badge-active" style="font-size:0.7rem;">${activeCount} active</span>
        </div>
        <p style="font-size:0.82rem;color:var(--gray-500);margin-top:4px;">📍 ${p.address}</p>
      </div>
      <div class="parking-card-body">
        <div class="info-row"><span class="icon">🏢</span>${p.totalFloors} Floor(s) · ${p.rows}×${p.columns} · ${totalSlots} total slots</div>
        <div class="info-row"><span class="icon">🟢</span>Available: <strong style="color:var(--success);">${available}</strong> / Occupied: <strong style="color:var(--danger);">${occupied}</strong></div>
        <div class="avail-bar"><div class="avail-fill ${fillClass}" style="width:${availPct}%"></div></div>
        <div class="info-row"><span class="icon">💰</span>₹${p.pricePerHour}/hr base · Revenue: <strong>₹${revenue.toFixed(2)}</strong></div>
        <div class="badges-row">${badges}</div>
        <div class="toggle-wrap">
          <button class="toggle ${p.dynamicPricing ? 'active' : ''}" onclick="toggleDynamic('${p.id}')"></button>
          <span class="toggle-label">Dynamic Pricing ${p.dynamicPricing ? 'ON ⚡' : 'OFF'}</span>
        </div>
      </div>
      <div class="parking-card-footer">
        <button class="btn btn-primary btn-sm" onclick="viewOwnerSlots('${p.id}')">🗺️ Slot Map</button>
        <button class="btn btn-secondary btn-sm" onclick="removeParking('${p.id}')">🗑️ Remove</button>
      </div>
    </div>`;
  });
  html += '</div>';
  container.innerHTML = html;
}

function toggleDynamic(parkingId) {
  const parkings = getStore('pk_parkings');
  const p = parkings.find(pk => pk.id === parkingId);
  if (!p) return;
  p.dynamicPricing = !p.dynamicPricing;
  setStore('pk_parkings', parkings);
  showToast(`Dynamic pricing ${p.dynamicPricing ? 'enabled ⚡' : 'disabled'} for "${p.name}"`, 'info');
  renderOwnerParkings();
}

function removeParking(parkingId) {
  const parkings = getStore('pk_parkings');
  const p = parkings.find(pk => pk.id === parkingId);
  if (!confirm(`Remove "${p?.name}"? All slot data will be deleted.`)) return;
  setStore('pk_parkings', parkings.filter(pk => pk.id !== parkingId));
  showToast('Parking location removed.', 'info');
  renderOwnerParkings();
  renderOwnerStats();
}

// ===== OWNER SLOT MODAL =====
let _ownerViewFloor = 0;
let _ownerViewParkingId = null;

function viewOwnerSlots(parkingId) {
  _ownerViewParkingId = parkingId;
  _ownerViewFloor = 0;
  renderOwnerSlotModal();
  document.getElementById('ownerSlotModal')?.classList.add('active');
}

function closeOwnerSlotModal() {
  document.getElementById('ownerSlotModal')?.classList.remove('active');
}

function renderOwnerSlotModal() {
  const parking = getStore('pk_parkings').find(p => p.id === _ownerViewParkingId);
  if (!parking) return;

  document.getElementById('ownerSlotModalTitle').textContent = parking.name + ' — Slot Map';

  let html = `<div class="floor-tabs">`;
  for (let f = 0; f < parking.totalFloors; f++) {
    const floorSlots = parking.slots?.filter(s => s.floor === f) || [];
    const avail = floorSlots.filter(s => s.status === 'available').length;
    html += `<button class="floor-tab ${f === _ownerViewFloor ? 'active' : ''}" onclick="ownerSelectFloor(${f})">Floor ${f + 1} (${avail} free)</button>`;
  }
  html += `</div>`;

  const floorSlots = parking.slots?.filter(s => s.floor === _ownerViewFloor) || [];
  const avail = floorSlots.filter(s => s.status === 'available').length;
  const occ = floorSlots.filter(s => s.status !== 'available').length;
  html += `<p style="color:var(--gray-600);font-size:0.875rem;margin-bottom:12px;">Floor ${_ownerViewFloor + 1}: <span style="color:var(--success);font-weight:600;">${avail} available</span> · <span style="color:var(--danger);font-weight:600;">${occ} occupied/reserved</span></p>`;
  html += `<div id="ownerSlotGridInner"></div>`;
  html += `<div class="slot-legend mt-2">
    <span><span class="legend-dot green"></span> Available</span>
    <span><span class="legend-dot red"></span> Occupied</span>
    <span><span class="legend-dot yellow"></span> Reserved</span>
  </div>`;

  document.getElementById('ownerSlotModalBody').innerHTML = html;
  renderSlotGrid(parking, _ownerViewFloor, 'ownerSlotGridInner');
}

function ownerSelectFloor(f) {
  _ownerViewFloor = f;
  renderOwnerSlotModal();
}

// ===== OWNER BOOKINGS =====
function renderOwnerBookings() {
  const user = getSession();
  if (!user) return;
  const myParkingIds = getStore('pk_parkings').filter(p => p.ownerId === user.id).map(p => p.id);
  const filter = document.getElementById('ownerBookingFilter')?.value || '';

  let bookings = getStore('pk_bookings').filter(b => myParkingIds.includes(b.parkingId));
  if (filter) bookings = bookings.filter(b => b.status === filter);
  bookings.sort((a, b) => b.createdAt - a.createdAt);

  const container = document.getElementById('ownerBookingsList');
  if (!container) return;

  if (bookings.length === 0) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">🎫</div><h3>No bookings found</h3></div>`;
    return;
  }

  let html = '<div class="table-wrap"><table><thead><tr><th>Booking ID</th><th>Customer</th><th>Parking</th><th>Slot</th><th>Vehicle</th><th>Start Time</th><th>Amount</th><th>Status</th><th>Actions</th></tr></thead><tbody>';
  bookings.forEach(b => {
    const durH = Math.floor(b.durationMinutes / 60);
    const durM = b.durationMinutes % 60;
    html += `<tr>
      <td><span style="font-family:monospace;font-weight:700;font-size:0.82rem;">${b.id}</span></td>
      <td>${b.customerName}<br><span style="font-size:0.75rem;color:var(--gray-400);">${b.customerPhone || ''}</span></td>
      <td>${b.parkingName}</td>
      <td>${b.slotId}</td>
      <td>${b.vehicleType?.toUpperCase()}${b.vehicleNumber ? `<br><span style="font-size:0.75rem;">${b.vehicleNumber}</span>` : ''}</td>
      <td>${formatDateTime(b.startTime)}</td>
      <td>
        <strong>₹${(b.totalAmount || 0).toFixed(2)}</strong>
        ${b.status === 'active' ? `<br><span style="font-size:0.75rem;color:var(--gray-400);">₹${b.pricePerHour}/hr</span>` : ''}
        ${b.durationMinutes > 0 ? `<br><span style="font-size:0.75rem;color:var(--gray-400);">${durH}h ${durM}m</span>` : ''}
      </td>
      <td>${statusBadge(b.status)}</td>
      <td>
        <div class="booking-actions">
          <button class="btn btn-secondary btn-sm" onclick="viewOwnerBookingDetail('${b.id}')">Details</button>
        </div>
      </td>
    </tr>`;
  });
  html += '</tbody></table></div>';
  container.innerHTML = html;
}

function viewOwnerBookingDetail(bookingId) {
  const booking = getStore('pk_bookings').find(b => b.id === bookingId);
  if (!booking) return;
  const durH = Math.floor(booking.durationMinutes / 60);
  const durM = booking.durationMinutes % 60;

  document.getElementById('ownerBookingModalBody').innerHTML = `
  <div style="background:var(--gray-50);border-radius:10px;padding:16px;margin-bottom:16px;">
    <div class="info-row"><span class="icon">🎫</span><strong>${booking.id}</strong></div>
    <div class="info-row"><span class="icon">👤</span>${booking.customerName} · ${booking.customerPhone || ''}</div>
    ${booking.vehicleNumber ? `<div class="info-row"><span class="icon">🚗</span>${booking.vehicleNumber} (${booking.vehicleType?.toUpperCase()})</div>` : ''}
    <div class="info-row"><span class="icon">📍</span>${booking.parkingName} — Slot ${booking.slotId}</div>
    <div class="info-row"><span class="icon">🕐</span>Started: ${formatDateTime(booking.startTime)}</div>
    ${booking.endTime ? `<div class="info-row"><span class="icon">🕐</span>Ended: ${formatDateTime(booking.endTime)}</div>` : ''}
    ${booking.durationMinutes > 0 ? `<div class="info-row"><span class="icon">⏱️</span>Duration: ${durH}h ${durM}m</div>` : ''}
    <div class="info-row"><span class="icon">💰</span>₹${booking.pricePerHour}/hr → Total: <strong>₹${(booking.totalAmount || 0).toFixed(2)}</strong></div>
    <div class="info-row"><span class="icon">📊</span>Status: ${statusBadge(booking.status)}</div>
  </div>
  ${booking.status === 'completed' ? generateReceiptHTML(booking) : ''}`;

  document.getElementById('ownerBookingModal').classList.add('active');
}

// ===== REPORTS =====
function renderReports(period) {
  const user = getSession();
  if (!user) return;

  const myParkingIds = getStore('pk_parkings').filter(p => p.ownerId === user.id).map(p => p.id);
  const allBookings = getStore('pk_bookings').filter(b => myParkingIds.includes(b.parkingId) && b.status === 'completed');

  const now = Date.now();
  let filtered = allBookings;
  if (period === 'daily') filtered = allBookings.filter(b => now - b.endTime < 86400000);
  else if (period === 'monthly') filtered = allBookings.filter(b => now - b.endTime < 30 * 86400000);

  const totalRevenue = filtered.reduce((s, b) => s + (b.totalAmount || 0), 0);
  const totalBookings = filtered.length;
  const avgAmount = totalBookings > 0 ? totalRevenue / totalBookings : 0;

  // Revenue by parking
  const byParking = {};
  filtered.forEach(b => {
    if (!byParking[b.parkingName]) byParking[b.parkingName] = { count: 0, revenue: 0 };
    byParking[b.parkingName].count++;
    byParking[b.parkingName].revenue += b.totalAmount || 0;
  });

  const container = document.getElementById('reportsContainer');
  if (!container) return;

  const periodLabel = period === 'daily' ? 'Today' : period === 'monthly' ? 'This Month' : 'All Time';

  let html = `
  <div class="report-grid">
    <div class="report-card"><div class="label">Total Revenue (${periodLabel})</div><div class="value">₹${totalRevenue.toFixed(2)}</div></div>
    <div class="report-card"><div class="label">Completed Bookings</div><div class="value">${totalBookings}</div></div>
    <div class="report-card"><div class="label">Avg per Booking</div><div class="value">₹${avgAmount.toFixed(2)}</div></div>
  </div>`;

  if (Object.keys(byParking).length > 0) {
    html += `<h3 style="font-weight:700;margin:24px 0 12px;font-size:1rem;">Earnings by Parking Location</h3>`;
    html += '<div class="table-wrap"><table><thead><tr><th>Parking Name</th><th>Bookings</th><th>Revenue</th></tr></thead><tbody>';
    Object.entries(byParking).sort((a, b) => b[1].revenue - a[1].revenue).forEach(([name, data]) => {
      html += `<tr><td>${name}</td><td>${data.count}</td><td><strong>₹${data.revenue.toFixed(2)}</strong></td></tr>`;
    });
    html += '</tbody></table></div>';
  } else {
    html += `<div class="empty-state" style="padding:40px;"><div class="empty-icon">📊</div><h3>No data for ${periodLabel}</h3></div>`;
  }

  container.innerHTML = html;
}

// =============================================
// SECTION 11: ADMIN PANEL
// =============================================

function initAdminPage() {
  const user = requireAuth('admin');
  if (!user) return;
  const el = document.getElementById('adminGreeting');
  if (el) el.textContent = user.name;

  renderAdminOverview();
  renderAdminUsers();
  renderAdminOwners();
  renderAdminParkings();
  renderAdminBookings();
  renderAdminRevenue();
}

function adminNav(page, btnEl) {
  document.querySelectorAll('.admin-page').forEach(p => p.classList.remove('active'));
  document.getElementById('ap-' + page)?.classList.add('active');
  document.querySelectorAll('.admin-nav-item').forEach(b => b.classList.remove('active'));
  if (btnEl) btnEl.classList.add('active');
}

function renderAdminOverview() {
  const users = getStore('pk_users');
  const parkings = getStore('pk_parkings');
  const bookings = getStore('pk_bookings');

  const owners = users.filter(u => u.role === 'owner').length;
  const customers = users.filter(u => u.role === 'customer').length;
  const locations = parkings.length;
  const totalSlots = parkings.reduce((s, p) => s + (p.slots?.length || 0), 0);
  const availSlots = parkings.reduce((s, p) => s + (p.slots?.filter(sl => sl.status === 'available').length || 0), 0);
  const totalBookings = bookings.length;
  const activeBookings = bookings.filter(b => b.status === 'active').length;
  const totalRevenue = bookings.filter(b => b.status === 'completed').reduce((s, b) => s + (b.totalAmount || 0), 0);

  const statsContainer = document.getElementById('adminOverviewStats');
  if (statsContainer) {
    statsContainer.innerHTML = `
      <div class="stat-card"><div class="stat-icon-wrap">👥</div><div class="stat-value">${customers}</div><div class="stat-label">Customers</div></div>
      <div class="stat-card blue"><div class="stat-icon-wrap blue">🏢</div><div class="stat-value">${owners}</div><div class="stat-label">Owners</div></div>
      <div class="stat-card"><div class="stat-icon-wrap">📍</div><div class="stat-value">${locations}</div><div class="stat-label">Parking Locations</div></div>
      <div class="stat-card green"><div class="stat-icon-wrap green">🅿️</div><div class="stat-value">${availSlots}/${totalSlots}</div><div class="stat-label">Available Slots</div></div>
      <div class="stat-card purple"><div class="stat-icon-wrap purple">🎫</div><div class="stat-value">${activeBookings}/${totalBookings}</div><div class="stat-label">Active/Total Bookings</div></div>
      <div class="stat-card green"><div class="stat-icon-wrap green">💰</div><div class="stat-value">₹${totalRevenue.toFixed(0)}</div><div class="stat-label">Total Revenue</div></div>
    `;
  }

  // Recent users
  const recentUsers = users.sort((a, b) => b.createdAt - a.createdAt).slice(0, 5);
  const ruContainer = document.getElementById('adminRecentUsers');
  if (ruContainer) {
    if (recentUsers.length === 0) {
      ruContainer.innerHTML = `<div class="empty-state" style="padding:30px;"><div class="empty-icon">👥</div><h3>No users yet</h3></div>`;
    } else {
      let html = '';
      recentUsers.forEach(u => {
        html += `<div class="booking-card" style="margin-bottom:10px;padding:14px;">
          <div class="flex-between">
            <div>
              <strong>${u.name}</strong> ${u.blocked ? statusBadge('blocked') : ''}
              <p style="font-size:0.8rem;color:var(--gray-400);">${u.email} · ${u.role}</p>
            </div>
            <span style="font-size:0.75rem;color:var(--gray-400);">${formatDate(u.createdAt)}</span>
          </div>
        </div>`;
      });
      ruContainer.innerHTML = html;
    }
  }

  // Recent bookings
  const recentBookings = bookings.sort((a, b) => b.createdAt - a.createdAt).slice(0, 5);
  const rbContainer = document.getElementById('adminRecentBookings');
  if (rbContainer) {
    if (recentBookings.length === 0) {
      rbContainer.innerHTML = `<div class="empty-state" style="padding:30px;"><div class="empty-icon">🎫</div><h3>No bookings yet</h3></div>`;
    } else {
      let html = '';
      recentBookings.forEach(b => {
        html += `<div class="booking-card" style="margin-bottom:10px;padding:14px;">
          <div class="flex-between">
            <div>
              <strong style="font-family:monospace;font-size:0.85rem;">${b.id}</strong> ${statusBadge(b.status)}
              <p style="font-size:0.8rem;color:var(--gray-400);">${b.customerName} @ ${b.parkingName}</p>
            </div>
            <strong>₹${(b.totalAmount || 0).toFixed(2)}</strong>
          </div>
        </div>`;
      });
      rbContainer.innerHTML = html;
    }
  }
}

function renderAdminUsers(filter = '') {
  const users = getStore('pk_users').filter(u => u.role === 'customer');
  const filtered = filter ? users.filter(u => u.name.toLowerCase().includes(filter) || u.email.toLowerCase().includes(filter)) : users;
  const container = document.getElementById('adminUsersList');
  if (!container) return;

  if (filtered.length === 0) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">👥</div><h3>No customers found</h3></div>`;
    return;
  }

  const bookings = getStore('pk_bookings');
  let html = '<div class="table-wrap"><table><thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Joined</th><th>Bookings</th><th>Status</th><th>Actions</th></tr></thead><tbody>';
  filtered.sort((a, b) => b.createdAt - a.createdAt).forEach(u => {
    const userBookings = bookings.filter(b => b.customerId === u.id).length;
    html += `<tr>
      <td><strong>${u.name}</strong></td>
      <td>${u.email}</td>
      <td>${u.phone || '—'}</td>
      <td>${formatDate(u.createdAt)}</td>
      <td>${userBookings}</td>
      <td>${u.blocked ? statusBadge('blocked') : '<span class="badge badge-active">Active</span>'}</td>
      <td>
        <div class="booking-actions">
          <button class="btn btn-sm ${u.blocked ? 'btn-success' : 'btn-danger'}" onclick="toggleBlockUser('${u.id}')">
            ${u.blocked ? '✓ Unblock' : '⛔ Block'}
          </button>
          <button class="btn btn-secondary btn-sm" onclick="removeUser('${u.id}','customer')">🗑️</button>
        </div>
      </td>
    </tr>`;
  });
  html += '</tbody></table></div>';
  container.innerHTML = html;
}

function renderAdminOwners(filter = '') {
  const users = getStore('pk_users').filter(u => u.role === 'owner');
  const filtered = filter ? users.filter(u => u.name.toLowerCase().includes(filter) || u.email.toLowerCase().includes(filter)) : users;
  const container = document.getElementById('adminOwnersList');
  if (!container) return;

  if (filtered.length === 0) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">🏢</div><h3>No owners found</h3></div>`;
    return;
  }

  const parkings = getStore('pk_parkings');
  const bookings = getStore('pk_bookings');
  let html = '<div class="table-wrap"><table><thead><tr><th>Name</th><th>Email</th><th>Joined</th><th>Parkings</th><th>Revenue</th><th>Status</th><th>Actions</th></tr></thead><tbody>';
  filtered.sort((a, b) => b.createdAt - a.createdAt).forEach(u => {
    const ownerParkings = parkings.filter(p => p.ownerId === u.id);
    const ownerParkingIds = ownerParkings.map(p => p.id);
    const revenue = bookings.filter(b => ownerParkingIds.includes(b.parkingId) && b.status === 'completed').reduce((s, b) => s + (b.totalAmount || 0), 0);
    html += `<tr>
      <td><strong>${u.name}</strong><br><span style="font-size:0.75rem;color:var(--gray-400);">${u.business || ''}</span></td>
      <td>${u.email}</td>
      <td>${formatDate(u.createdAt)}</td>
      <td>${ownerParkings.length}</td>
      <td><strong>₹${revenue.toFixed(2)}</strong></td>
      <td>${u.blocked ? statusBadge('blocked') : '<span class="badge badge-active">Active</span>'}</td>
      <td>
        <div class="booking-actions">
          <button class="btn btn-sm ${u.blocked ? 'btn-success' : 'btn-danger'}" onclick="toggleBlockUser('${u.id}')">
            ${u.blocked ? '✓ Unblock' : '⛔ Block'}
          </button>
          <button class="btn btn-secondary btn-sm" onclick="removeUser('${u.id}','owner')">🗑️</button>
        </div>
      </td>
    </tr>`;
  });
  html += '</tbody></table></div>';
  container.innerHTML = html;
}

function renderAdminParkings() {
  const parkings = getStore('pk_parkings');
  const container = document.getElementById('adminParkingsList');
  if (!container) return;

  if (parkings.length === 0) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">📍</div><h3>No parking locations</h3></div>`;
    return;
  }

  const bookings = getStore('pk_bookings');
  let html = '<div class="table-wrap"><table><thead><tr><th>Name</th><th>Owner</th><th>Address</th><th>Slots</th><th>Available</th><th>Revenue</th><th>Dynamic Pricing</th></tr></thead><tbody>';
  parkings.sort((a, b) => b.createdAt - a.createdAt).forEach(p => {
    const total = p.slots?.length || 0;
    const avail = p.slots?.filter(s => s.status === 'available').length || 0;
    const rev = bookings.filter(b => b.parkingId === p.id && b.status === 'completed').reduce((s, b) => s + (b.totalAmount || 0), 0);
    html += `<tr>
      <td><strong>${p.name}</strong></td>
      <td>${p.ownerName}</td>
      <td>${p.address}</td>
      <td>${total}</td>
      <td><strong style="color:${avail > 0 ? 'var(--success)' : 'var(--danger)'};">${avail}</strong></td>
      <td><strong>₹${rev.toFixed(2)}</strong></td>
      <td>${p.dynamicPricing ? '<span class="badge badge-dynamic">⚡ ON</span>' : '<span class="badge">OFF</span>'}</td>
    </tr>`;
  });
  html += '</tbody></table></div>';
  container.innerHTML = html;
}

function renderAdminBookings() {
  const filter = document.getElementById('adminBookingFilter')?.value || '';
  let bookings = getStore('pk_bookings');
  if (filter) bookings = bookings.filter(b => b.status === filter);
  bookings.sort((a, b) => b.createdAt - a.createdAt);

  const container = document.getElementById('adminBookingsList');
  if (!container) return;

  if (bookings.length === 0) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">🎫</div><h3>No bookings found</h3></div>`;
    return;
  }

  let html = '<div class="table-wrap"><table><thead><tr><th>Booking ID</th><th>Customer</th><th>Parking</th><th>Slot</th><th>Vehicle</th><th>Start</th><th>Amount</th><th>Status</th></tr></thead><tbody>';
  bookings.forEach(b => {
    html += `<tr>
      <td><span style="font-family:monospace;font-size:0.82rem;">${b.id}</span></td>
      <td>${b.customerName}<br><span style="font-size:0.75rem;color:var(--gray-400);">${b.customerPhone || ''}</span></td>
      <td>${b.parkingName}</td>
      <td>${b.slotId}</td>
      <td>${b.vehicleType?.toUpperCase()}${b.vehicleNumber ? `<br><span style="font-size:0.75rem;">${b.vehicleNumber}</span>` : ''}</td>
      <td>${formatDateTime(b.startTime)}</td>
      <td><strong>₹${(b.totalAmount || 0).toFixed(2)}</strong></td>
      <td>${statusBadge(b.status)}</td>
    </tr>`;
  });
  html += '</tbody></table></div>';
  container.innerHTML = html;
}

function renderAdminRevenue() {
  const bookings = getStore('pk_bookings').filter(b => b.status === 'completed');
  const parkings = getStore('pk_parkings');

  const totalRevenue = bookings.reduce((s, b) => s + (b.totalAmount || 0), 0);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const dailyRevenue = bookings.filter(b => b.endTime >= today.getTime()).reduce((s, b) => s + (b.totalAmount || 0), 0);
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).getTime();
  const monthlyRevenue = bookings.filter(b => b.endTime >= monthStart).reduce((s, b) => s + (b.totalAmount || 0), 0);

  const statsContainer = document.getElementById('adminRevenueStats');
  if (statsContainer) {
    statsContainer.innerHTML = `
      <div class="stat-card green"><div class="stat-icon-wrap green">💰</div><div class="stat-value">₹${totalRevenue.toFixed(2)}</div><div class="stat-label">Total Platform Revenue</div></div>
      <div class="stat-card"><div class="stat-icon-wrap">📅</div><div class="stat-value">₹${dailyRevenue.toFixed(2)}</div><div class="stat-label">Today's Revenue</div></div>
      <div class="stat-card blue"><div class="stat-icon-wrap blue">📆</div><div class="stat-value">₹${monthlyRevenue.toFixed(2)}</div><div class="stat-label">This Month</div></div>
      <div class="stat-card"><div class="stat-icon-wrap">🎫</div><div class="stat-value">${bookings.length}</div><div class="stat-label">Completed Bookings</div></div>
    `;
  }

  // By parking
  const byParking = {};
  bookings.forEach(b => {
    if (!byParking[b.parkingId]) byParking[b.parkingId] = { name: b.parkingName, count: 0, revenue: 0 };
    byParking[b.parkingId].count++;
    byParking[b.parkingId].revenue += b.totalAmount || 0;
  });

  const tableContainer = document.getElementById('adminRevenueTable');
  if (tableContainer) {
    if (Object.keys(byParking).length === 0) {
      tableContainer.innerHTML = `<div class="empty-state"><div class="empty-icon">💰</div><h3>No revenue data yet</h3></div>`;
      return;
    }
    let html = '<div class="table-wrap"><table><thead><tr><th>Parking Location</th><th>Bookings</th><th>Revenue</th><th>Share</th></tr></thead><tbody>';
    Object.values(byParking).sort((a, b) => b.revenue - a.revenue).forEach(d => {
      const pct = totalRevenue > 0 ? ((d.revenue / totalRevenue) * 100).toFixed(1) : 0;
      html += `<tr>
        <td><strong>${d.name}</strong></td>
        <td>${d.count}</td>
        <td><strong>₹${d.revenue.toFixed(2)}</strong></td>
        <td>
          <div style="display:flex;align-items:center;gap:8px;">
            <div style="flex:1;height:6px;background:var(--gray-200);border-radius:3px;">
              <div style="width:${pct}%;height:100%;background:var(--primary);border-radius:3px;"></div>
            </div>
            <span style="font-size:0.8rem;font-weight:600;">${pct}%</span>
          </div>
        </td>
      </tr>`;
    });
    html += '</tbody></table></div>';
    tableContainer.innerHTML = html;
  }
}

function toggleBlockUser(userId) {
  const users = getStore('pk_users');
  const user = users.find(u => u.id === userId);
  if (!user) return;
  user.blocked = !user.blocked;
  setStore('pk_users', users);
  showToast(`User "${user.name}" ${user.blocked ? 'blocked' : 'unblocked'}.`, user.blocked ? 'warning' : 'success');
  renderAdminUsers();
  renderAdminOwners();
  renderAdminOverview();
}

function removeUser(userId, role) {
  const users = getStore('pk_users');
  const user = users.find(u => u.id === userId);
  if (!confirm(`Remove user "${user?.name}"? This cannot be undone.`)) return;
  setStore('pk_users', users.filter(u => u.id !== userId));
  showToast('User removed.', 'info');
  if (role === 'customer') renderAdminUsers();
  else renderAdminOwners();
  renderAdminOverview();
}

function searchAdminUsers(query) {
  renderAdminUsers(query.toLowerCase());
}

function searchAdminOwners(query) {
  renderAdminOwners(query.toLowerCase());
}

// =============================================
// SECTION 12: DEMO PAGE
// =============================================

let _demoParking = null;
let _demoFloor = 0;
let _demoVehicle = 'car';

function initDemoData() {
  const slots = generateSlots(3, 5, 8, ['car', 'bike', 'ev']);
  const occupyCount = Math.floor(slots.length * 0.55);
  const shuffled = [...slots].sort(() => Math.random() - 0.5);
  for (let i = 0; i < occupyCount; i++) {
    shuffled[i].status = Math.random() > 0.3 ? 'occupied' : 'reserved';
  }
  _demoParking = {
    id: 'demo', ownerId: 'demo_owner', ownerName: 'Demo',
    name: 'Downtown Mall Parking', address: '123 Main Street, City Center',
    totalFloors: 3, pricePerHour: 60, rows: 5, columns: 8,
    vehicleTypes: ['car', 'bike', 'ev'], dynamicPricing: true, slots,
    createdAt: Date.now()
  };
}

function renderDemoPage() {
  if (!_demoParking) initDemoData();
  const p = _demoParking;
  const total = p.slots.length;
  const occupied = p.slots.filter(s => s.status !== 'available').length;
  const available = total - occupied;
  const occupancy = ((occupied / total) * 100).toFixed(1);
  const pricing = calculatePrice(p);

  const statsContainer = document.getElementById('demoStats');
  if (statsContainer) {
    statsContainer.innerHTML = `
      <div class="stat-card"><div class="stat-icon-wrap">🏢</div><div class="stat-value">${p.totalFloors}</div><div class="stat-label">Floors</div></div>
      <div class="stat-card blue"><div class="stat-icon-wrap blue">🅿️</div><div class="stat-value">${total}</div><div class="stat-label">Total Slots</div></div>
      <div class="stat-card green"><div class="stat-icon-wrap green">🟢</div><div class="stat-value">${available}</div><div class="stat-label">Available</div></div>
      <div class="stat-card"><div class="stat-icon-wrap">📊</div><div class="stat-value">${occupancy}%</div><div class="stat-label">Occupancy</div></div>
    `;
  }

  const pricingContainer = document.getElementById('demoPricing');
  if (pricingContainer) pricingContainer.innerHTML = renderPriceBreakdown(pricing);

  const vehicleContainer = document.getElementById('demoVehicleSelect');
  if (vehicleContainer) {
    vehicleContainer.innerHTML = p.vehicleTypes.map(vt => {
      const icon = vt === 'car' ? '🚗' : vt === 'bike' ? '🏍️' : '⚡';
      const avail = p.slots.filter(s => s.status === 'available' && s.vehicleType === vt).length;
      return `<button class="vehicle-option ${_demoVehicle === vt ? 'selected' : ''}" onclick="demoSelectVehicle('${vt}')">${icon} ${vt.toUpperCase()} (${avail})</button>`;
    }).join('');
  }

  const floorTabsContainer = document.getElementById('demoFloorTabs');
  if (floorTabsContainer) {
    let tabsHtml = '';
    for (let f = 0; f < p.totalFloors; f++) {
      const floorAvail = p.slots.filter(s => s.floor === f && s.status === 'available').length;
      tabsHtml += `<button class="floor-tab ${f === _demoFloor ? 'active' : ''}" onclick="demoSelectFloor(${f})">Floor ${f + 1} (${floorAvail})</button>`;
    }
    floorTabsContainer.innerHTML = tabsHtml;
  }

  renderSlotGrid(p, _demoFloor, 'demoSlotGrid', { vehicleFilter: _demoVehicle });
}

function demoSelectVehicle(vt) { _demoVehicle = vt; renderDemoPage(); }
function demoSelectFloor(f) { _demoFloor = f; renderDemoPage(); }

function demoSmartBook() {
  if (!_demoParking) return;
  const slot = findOptimalSlot(_demoParking, _demoVehicle);
  const resultEl = document.getElementById('demoBookingResult');
  if (!slot) {
    resultEl.innerHTML = `<div class="alert alert-warning">⚠️ No available ${_demoVehicle} slots.</div>`;
    return;
  }
  slot.status = 'reserved';
  resultEl.innerHTML = `<div class="alert alert-success">
    ✅ Smart allocation selected slot <strong>${slot.label}</strong> (Floor ${slot.floor + 1}, ${slot.vehicleType}).
    <br><small>Algorithm scored based on distance, floor occupancy, and accessibility.</small>
  </div>`;
  showToast(`Demo: Slot ${slot.label} allocated!`, 'success');
  renderDemoPage();
}

// =============================================
// SECTION 13: PAGE INITIALIZATION
// =============================================

// Seed admin account if none exists
function seedAdminAccount() {
  const users = getStore('pk_users');
  if (!users.find(u => u.role === 'admin')) {
    users.push({
      id: generateId('admin'),
      name: 'System Admin', email: 'admin@parksmart.in',
      phone: '9000000000', password: 'admin123',
      role: 'admin', blocked: false, createdAt: Date.now()
    });
    setStore('pk_users', users);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  seedAdminAccount();
  const page = document.body.dataset.page;

  switch (page) {
    case 'index': initIndexPage(); break;
    case 'owner': initOwnerPage(); break;
    case 'customer': initCustomerPage(); break;
    case 'admin': initAdminPage(); break;
    case 'demo': initDemoData(); renderDemoPage(); break;
  }
});
