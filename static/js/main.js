/**
 * CareNest Healthcare & E-Pharmacy Platform
 * Core Main JavaScript (ES6+ Vanilla JS)
 */

// Global User State
window.currentUser = null;

document.addEventListener('DOMContentLoaded', () => {
  initAuthUI();
  initSearchAutocomplete();
  initMobileMenu();
  setupEventListeners();
});

/**
 * Check authenticated state & sync header navigation
 */
async function initAuthUI() {
  const guestNav = document.getElementById('guest-nav');
  const userNav = document.getElementById('user-nav');
  const userDisplayName = document.getElementById('user-display-name');
  const userAvatarInitials = document.getElementById('user-avatar-initials');
  const dropdownUserName = document.getElementById('dropdown-user-name');
  const dropdownUserEmail = document.getElementById('dropdown-user-email');
  const dropdownCompleteReg = document.getElementById('dropdown-complete-reg');

  try {
    const res = await fetch('/api/auth/me', {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      credentials: 'same-origin'
    });

    if (res.ok) {
      const result = await res.json();
      if (result.success && result.data) {
        window.currentUser = result.data;
        const profile = result.data.profile || {};
        const fullName = profile.first_name ? `${profile.first_name} ${profile.last_name || ''}`.trim() : (result.data.email.split('@')[0]);
        const initials = profile.first_name ? `${profile.first_name[0]}${(profile.last_name || '')[0] || ''}`.toUpperCase() : 'CN';

        if (guestNav) guestNav.classList.add('hidden');
        if (userNav) userNav.classList.remove('hidden');

        if (userDisplayName) userDisplayName.textContent = profile.first_name || 'My Account';
        if (userAvatarInitials) userAvatarInitials.textContent = initials;
        if (dropdownUserName) dropdownUserName.textContent = fullName;
        if (dropdownUserEmail) dropdownUserEmail.textContent = result.data.email;

        // If not registered, prompt to complete registration
        if (!result.data.is_registered && dropdownCompleteReg) {
          dropdownCompleteReg.classList.remove('hidden');
        }

        // Update mobile links
        document.querySelectorAll('.auth-only').forEach(el => el.classList.remove('hidden'));
        document.querySelectorAll('.guest-only').forEach(el => el.classList.add('hidden'));
        return;
      }
    }
  } catch (err) {
    // Unauthenticated or network error
  }

  // Fallback to guest mode
  if (guestNav) guestNav.classList.remove('hidden');
  if (userNav) userNav.classList.add('hidden');
  document.querySelectorAll('.auth-only').forEach(el => el.classList.add('hidden'));
  document.querySelectorAll('.guest-only').forEach(el => el.classList.remove('hidden'));
}

/**
 * Setup common event listeners
 */
function setupEventListeners() {
  // User dropdown menu toggle
  const userMenuBtn = document.getElementById('user-menu-btn');
  const userDropdownMenu = document.getElementById('user-dropdown-menu');

  if (userMenuBtn && userDropdownMenu) {
    userMenuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isHidden = userDropdownMenu.classList.contains('hidden');
      userDropdownMenu.classList.toggle('hidden', !isHidden);
      userMenuBtn.setAttribute('aria-expanded', isHidden ? 'true' : 'false');
    });

    // Close dropdown on outside click
    document.addEventListener('click', (e) => {
      if (!userDropdownMenu.contains(e.target) && !userMenuBtn.contains(e.target)) {
        userDropdownMenu.classList.add('hidden');
        userMenuBtn.setAttribute('aria-expanded', 'false');
      }
    });
  }

  // Logout Buttons
  const logoutBtn = document.getElementById('logout-btn');
  const mobileLogoutBtn = document.getElementById('mobile-logout-btn');

  if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);
  if (mobileLogoutBtn) mobileLogoutBtn.addEventListener('click', handleLogout);
}

/**
 * Handle user logout
 */
async function handleLogout() {
  try {
    const res = await fetch('/api/auth/logout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin'
    });
    const data = await res.json();
    if (data.success) {
      showToast('Logged out successfully', 'info');
      setTimeout(() => {
        window.location.href = '/login';
      }, 500);
    }
  } catch (err) {
    window.location.href = '/login';
  }
}

/**
 * Mobile Navigation Drawer Toggle
 */
function initMobileMenu() {
  const toggleBtn = document.getElementById('mobile-menu-btn');
  const drawer = document.getElementById('mobile-nav-drawer');

  if (toggleBtn && drawer) {
    toggleBtn.addEventListener('click', () => {
      drawer.classList.toggle('hidden');
    });
  }
}

/**
 * Toast Notification System
 * @param {string} message 
 * @param {'success'|'error'|'info'|'warning'} type 
 * @param {number} duration 
 */
function showToast(message, type = 'info', duration = 4000) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.setAttribute('role', 'alert');

  const titles = {
    success: 'Success',
    error: 'Notice',
    info: 'CareNest Notification',
    warning: 'Warning'
  };

  toast.innerHTML = `
    <div class="toast-content">
      <div class="toast-title">${titles[type] || 'Notice'}</div>
      <div class="toast-msg">${message}</div>
    </div>
    <button class="toast-close" aria-label="Close notification">✕</button>
  `;

  const closeBtn = toast.querySelector('.toast-close');
  closeBtn.addEventListener('click', () => {
    toast.remove();
  });

  container.appendChild(toast);

  setTimeout(() => {
    if (toast.parentElement) {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }
  }, duration);
}

/**
 * Show / Hide password visibility helper
 */
function togglePasswordVisibility(inputId, btn) {
  const input = document.getElementById(inputId);
  if (!input) return;

  if (input.type === 'password') {
    input.type = 'text';
    btn.textContent = '🔒';
    btn.setAttribute('aria-label', 'Hide password');
  } else {
    input.type = 'password';
    btn.textContent = '👁️';
    btn.setAttribute('aria-label', 'Show password');
  }
}

/**
 * Real-time password requirement checklist validation
 */
function checkPasswordRequirements(password, containerId = 'password-checklist') {
  const container = document.getElementById(containerId);
  if (!container) return;

  const prefix = containerId === 'password-checklist' ? 'req-' : (containerId.includes('reset') ? 'reset-req-' : 'change-req-');

  const lengthEl = document.getElementById(`${prefix}length`);
  const upperEl = document.getElementById(`${prefix}upper`);
  const lowerEl = document.getElementById(`${prefix}lower`);
  const numberEl = document.getElementById(`${prefix}number`);
  const specialEl = document.getElementById(`${prefix}special`);

  const hasLength = password.length >= 8;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);

  updateCheckItem(lengthEl, hasLength);
  updateCheckItem(upperEl, hasUpper);
  updateCheckItem(lowerEl, hasLower);
  updateCheckItem(numberEl, hasNumber);
  updateCheckItem(specialEl, hasSpecial);
}

function updateCheckItem(element, isValid) {
  if (!element) return;
  element.classList.toggle('valid', isValid);
  const icon = element.querySelector('span');
  if (icon) {
    icon.textContent = isValid ? '✓' : '✕';
  }
}

/**
 * Search Bar Autocomplete / Suggestion Dropdown
 */
function initSearchAutocomplete() {
  const searchInput = document.getElementById('global-search-input');
  const searchClearBtn = document.getElementById('search-clear-btn');
  const searchDropdown = document.getElementById('search-dropdown');
  const suggestionsList = document.getElementById('search-suggestions-list');

  if (!searchInput || !searchDropdown) return;

  const dataset = [
    { brand: 'Pan 40 Tablet', salt: 'Pantoprazole 40mg', generic: 'Pantocare 40', save: 'Save 74%' },
    { brand: 'Atorva 20 Tablet', salt: 'Atorvastatin 20mg', generic: 'Atorin 20', save: 'Save 75%' },
    { brand: 'Telma 40 Tablet', salt: 'Telmisartan 40mg', generic: 'Telmipres 40', save: 'Save 73%' },
    { brand: 'Glycomet-GP 2', salt: 'Metformin + Glimepiride', generic: 'Met-Glim 2 Forte', save: 'Save 71%' },
    { brand: 'Augmentin 625 Duo', salt: 'Amoxycillin + Clavulanate', generic: 'Moxclav 625', save: 'Save 66%' },
    { brand: 'Ecosprin 75', salt: 'Aspirin 75mg', generic: 'Aspicare 75', save: 'Save 60%' },
    { brand: 'Dolo 650 Tablet', salt: 'Paracetamol 650mg', generic: 'Paracip 650', save: 'Save 55%' }
  ];

  searchInput.addEventListener('input', () => {
    const query = searchInput.value.trim().toLowerCase();

    if (query.length > 0) {
      if (searchClearBtn) searchClearBtn.classList.remove('hidden');
      const filtered = dataset.filter(item => 
        item.brand.toLowerCase().includes(query) || 
        item.salt.toLowerCase().includes(query) ||
        item.generic.toLowerCase().includes(query)
      );

      renderSuggestions(filtered.length > 0 ? filtered : dataset.slice(0, 4));
      searchDropdown.classList.remove('hidden');
    } else {
      if (searchClearBtn) searchClearBtn.classList.add('hidden');
      searchDropdown.classList.add('hidden');
    }
  });

  searchInput.addEventListener('focus', () => {
    renderSuggestions(dataset.slice(0, 4));
    searchDropdown.classList.remove('hidden');
  });

  if (searchClearBtn) {
    searchClearBtn.addEventListener('click', () => {
      searchInput.value = '';
      searchClearBtn.classList.add('hidden');
      searchDropdown.classList.add('hidden');
    });
  }

  // Outside click to close search dropdown
  document.addEventListener('click', (e) => {
    if (!searchInput.contains(e.target) && !searchDropdown.contains(e.target)) {
      searchDropdown.classList.add('hidden');
    }
  });

  function renderSuggestions(items) {
    if (!suggestionsList) return;
    suggestionsList.innerHTML = items.map(item => `
      <div class="search-item" onclick="selectSearchItem('${item.brand}')">
        <div class="search-item-info">
          <strong>${item.brand}</strong>
          <small>${item.salt} · Substitute: ${item.generic}</small>
        </div>
        <span class="search-item-save">${item.save}</span>
      </div>
    `).join('');
  }
}

function selectSearchItem(brandName) {
  const searchInput = document.getElementById('global-search-input');
  const searchDropdown = document.getElementById('search-dropdown');
  if (searchInput) searchInput.value = brandName;
  if (searchDropdown) searchDropdown.classList.add('hidden');
  showToast(`Looking up doctor-approved generic substitutes for ${brandName}...`, 'info');
  // Scroll to savings showcase
  const el = document.getElementById('savings-showcase');
  if (el) el.scrollIntoView({ behavior: 'smooth' });
}

function handleGlobalSearch() {
  const input = document.getElementById('global-search-input');
  if (!input || !input.value.trim()) return;
  const term = input.value.trim();
  showToast(`Searching for "${term}" and generic substitutes...`, 'info');
  const showcase = document.getElementById('savings-showcase');
  if (showcase) {
    showcase.scrollIntoView({ behavior: 'smooth' });
  } else {
    window.location.href = '/#savings-showcase';
  }
}

/**
 * Terms of Service Modal Demo
 */
function showTermsModal(e) {
  if (e) e.preventDefault();
  const modal = document.getElementById('global-modal-backdrop');
  const title = document.getElementById('modal-title');
  const body = document.getElementById('modal-body');
  const footer = document.getElementById('modal-footer');
  const closeBtn = document.getElementById('modal-close-btn');

  if (!modal) return;

  title.textContent = 'CareNest Terms of Service & Privacy Policy';
  body.innerHTML = `
    <div style="font-size:0.875rem;line-height:1.6;color:#334155;">
      <p><strong>1. Licensed Pharmacy Operations:</strong> CareNest acts in strict accordance with the Drugs and Cosmetics Act of India. Prescription medications are only dispensed following audit by a registered clinical pharmacist against a valid doctor's prescription.</p>
      <br>
      <p><strong>2. Bioequivalent Generic Substitutes:</strong> Where generic substitutes are offered, CareNest certifies that medicines contain identical chemical salts, identical strengths, and WHO-GMP batch certifications.</p>
      <br>
      <p><strong>3. Privacy & Document Storage:</strong> Your health records, diagnostic files, and personal contact details are 256-bit encrypted and never shared with advertisers or third parties without consent.</p>
    </div>
  `;
  footer.innerHTML = `
    <button type="button" class="btn btn-accent btn-sm" onclick="document.getElementById('global-modal-backdrop').classList.add('hidden')">I Understand</button>
  `;

  modal.classList.remove('hidden');
  closeBtn.onclick = () => modal.classList.add('hidden');
}
