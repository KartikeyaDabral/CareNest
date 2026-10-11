/**
 * CareNest Patient Profile & Account Security Logic (Vanilla JS)
 */

let originalProfileData = null;
let isEditMode = false;

document.addEventListener('DOMContentLoaded', () => {
  loadProfileData();
});

/**
 * Fetch patient profile details
 */
async function loadProfileData() {
  try {
    const res = await fetch('/api/registration', {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      credentials: 'same-origin'
    });

    if (res.ok) {
      const result = await res.json();
      if (result.success && result.data) {
        originalProfileData = result.data;
        populateProfileFields(result.data);
      }
    }
  } catch (err) {
    showToast('Failed to load profile data.', 'error');
  }
}

/**
 * Populate form inputs and hero section
 */
function populateProfileFields(data) {
  const fullName = data.first_name ? `${data.first_name} ${data.last_name || ''}`.trim() : 'Patient Profile';
  const initials = data.first_name ? `${data.first_name[0]}${(data.last_name || '')[0] || ''}`.toUpperCase() : 'CN';

  // Hero section elements
  const heroName = document.getElementById('profile-hero-name');
  const heroAvatar = document.getElementById('profile-hero-avatar');
  const heroEmail = document.getElementById('profile-hero-email');
  const heroMobile = document.getElementById('profile-hero-mobile');
  const heroSince = document.getElementById('profile-hero-since');
  const regStatus = document.getElementById('profile-reg-status');

  if (heroName) heroName.textContent = fullName;
  if (heroAvatar) heroAvatar.textContent = initials;
  if (heroEmail) heroEmail.textContent = data.email || 'N/A';
  if (heroMobile) heroMobile.textContent = data.login_mobile ? `+91 ${data.login_mobile}` : (data.mobile ? `+91 ${data.mobile}` : 'N/A');
  if (heroSince && data.member_since) {
    const d = new Date(data.member_since);
    heroSince.textContent = `Member since ${d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}`;
  }
  if (regStatus) {
    regStatus.textContent = data.first_name ? 'Registered' : 'Incomplete Registration';
    regStatus.className = data.first_name ? 'reg-status-badge verified' : 'reg-status-badge pending';
  }

  // Inputs
  setInputValue('prof_first_name', data.first_name);
  setInputValue('prof_last_name', data.last_name);
  if (data.date_of_birth) {
    setInputValue('prof_date_of_birth', data.date_of_birth.substring(0, 10));
  }
  setInputValue('prof_gender', data.gender);
  setInputValue('prof_blood_group', data.blood_group);

  setInputValue('prof_email', data.email);
  setInputValue('prof_mobile', data.mobile || data.login_mobile);
  setInputValue('prof_alt_mobile', data.alternate_mobile);

  setInputValue('prof_address_line1', data.address_line1);
  setInputValue('prof_address_line2', data.address_line2);
  setInputValue('prof_city', data.city);
  setInputValue('prof_state', data.state);
  setInputValue('prof_pincode', data.pincode);

  setInputValue('prof_allergies', data.allergies);
  setInputValue('prof_chronic', data.chronic_conditions);
  setInputValue('prof_meds', data.current_medications);

  setInputValue('prof_emg_name', data.emergency_contact_name);
  setInputValue('prof_emg_phone', data.emergency_contact_phone);
}

function setInputValue(id, val) {
  const el = document.getElementById(id);
  if (el) el.value = val || '';
}

/**
 * Toggle Edit Mode
 */
function toggleEditMode() {
  isEditMode = !isEditMode;
  const toggleBtn = document.getElementById('toggle-edit-btn');
  const btnText = document.getElementById('edit-btn-text');
  const editControls = document.getElementById('edit-save-controls');

  const inputs = document.querySelectorAll('#profile-form input, #profile-form select');
  inputs.forEach(input => {
    // Keep email disabled at all times
    if (input.id === 'prof_email') return;
    input.disabled = !isEditMode;
  });

  if (isEditMode) {
    if (btnText) btnText.textContent = 'Editing Mode';
    if (toggleBtn) toggleBtn.classList.add('hidden');
    if (editControls) editControls.classList.remove('hidden');
    // Focus first name
    const fn = document.getElementById('prof_first_name');
    if (fn) fn.focus();
  } else {
    if (btnText) btnText.textContent = 'Edit Details';
    if (toggleBtn) toggleBtn.classList.remove('hidden');
    if (editControls) editControls.classList.add('hidden');
  }
}

function cancelEditMode() {
  if (originalProfileData) {
    populateProfileFields(originalProfileData);
  }
  toggleEditMode();
}

/**
 * Save profile changes via PUT /api/registration
 */
async function saveProfileChanges() {
  const saveBtn = document.getElementById('save-profile-btn');
  const spinner = document.getElementById('save-spinner');

  const payload = {
    first_name: document.getElementById('prof_first_name').value.trim(),
    last_name: document.getElementById('prof_last_name').value.trim(),
    date_of_birth: document.getElementById('prof_date_of_birth').value,
    gender: document.getElementById('prof_gender').value,
    blood_group: document.getElementById('prof_blood_group').value,
    mobile: document.getElementById('prof_mobile').value.trim().replace(/\D/g, ''),
    alternate_mobile: document.getElementById('prof_alt_mobile').value.trim().replace(/\D/g, ''),
    address_line1: document.getElementById('prof_address_line1').value.trim(),
    address_line2: document.getElementById('prof_address_line2').value.trim(),
    city: document.getElementById('prof_city').value.trim(),
    state: document.getElementById('prof_state').value,
    pincode: document.getElementById('prof_pincode').value.trim(),
    allergies: document.getElementById('prof_allergies').value.trim(),
    chronic_conditions: document.getElementById('prof_chronic').value.trim(),
    current_medications: document.getElementById('prof_meds').value.trim(),
    emergency_contact_name: document.getElementById('prof_emg_name').value.trim(),
    emergency_contact_phone: document.getElementById('prof_emg_phone').value.trim().replace(/\D/g, '')
  };

  if (!payload.first_name || !payload.last_name) {
    showToast('First name and last name are required.', 'error');
    return;
  }
  if (!payload.mobile || payload.mobile.length !== 10) {
    showToast('Valid 10-digit mobile number is required.', 'error');
    return;
  }
  if (!payload.pincode || payload.pincode.length !== 6) {
    showToast('Valid 6-digit pincode is required.', 'error');
    return;
  }

  setProfileButtonLoading(saveBtn, spinner, true);

  try {
    const res = await fetch('/api/registration', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(payload),
      credentials: 'same-origin'
    });

    const result = await res.json();
    if (result.success) {
      showToast('Profile information updated successfully!', 'success');
      originalProfileData = { ...originalProfileData, ...payload };
      toggleEditMode();
      loadProfileData();
    } else {
      showToast(result.message || 'Could not update profile.', 'error');
    }
  } catch (err) {
    showToast('Network error while saving profile.', 'error');
  } finally {
    setProfileButtonLoading(saveBtn, spinner, false);
  }
}

/**
 * Handle Change Password via PUT /api/auth/change-password
 */
async function handleChangePassword() {
  const errEl = document.getElementById('change-pwd-error');
  errEl.textContent = '';

  const currentPwd = document.getElementById('pwd_current').value;
  const newPwd = document.getElementById('pwd_new').value;
  const confirmPwd = document.getElementById('pwd_confirm').value;

  if (!currentPwd || !newPwd) {
    errEl.textContent = 'Please provide both your current and new password.';
    return;
  }

  if (newPwd.length < 8) {
    errEl.textContent = 'New password must be at least 8 characters long.';
    return;
  }

  if (newPwd !== confirmPwd) {
    errEl.textContent = 'New passwords do not match.';
    return;
  }

  const btn = document.getElementById('change-pwd-btn');
  const spinner = document.getElementById('change-pwd-spinner');
  setProfileButtonLoading(btn, spinner, true);

  try {
    const res = await fetch('/api/auth/change-password', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({
        current_password: currentPwd,
        new_password: newPwd,
        confirm_password: confirmPwd
      }),
      credentials: 'same-origin'
    });

    const result = await res.json();
    if (result.success) {
      showToast('Password changed successfully!', 'success');
      document.getElementById('change-pwd-form').reset();
    } else {
      errEl.textContent = result.message || 'Password update failed.';
    }
  } catch (err) {
    errEl.textContent = 'Network error while changing password.';
  } finally {
    setProfileButtonLoading(btn, spinner, false);
  }
}

/**
 * Delete Account Modal Logic
 */
function openDeleteAccountModal() {
  const modal = document.getElementById('delete-account-modal');
  const input = document.getElementById('delete-confirmation-input');
  const confirmBtn = document.getElementById('confirm-account-delete-btn');

  if (input) input.value = '';
  if (confirmBtn) confirmBtn.disabled = true;
  if (modal) modal.classList.remove('hidden');
}

function closeDeleteAccountModal() {
  const modal = document.getElementById('delete-account-modal');
  if (modal) modal.classList.add('hidden');
}

function toggleDeleteConfirmBtn(val) {
  const confirmBtn = document.getElementById('confirm-account-delete-btn');
  if (confirmBtn) {
    confirmBtn.disabled = val.trim().toUpperCase() !== 'DELETE';
  }
}

async function executeAccountDeletion() {
  try {
    const res = await fetch('/api/registration', {
      method: 'DELETE',
      credentials: 'same-origin'
    });

    const result = await res.json();
    if (result.success) {
      showToast('Account permanently deleted. Goodbye!', 'info');
      setTimeout(() => {
        window.location.href = '/';
      }, 1000);
    } else {
      showToast(result.message || 'Account deletion failed.', 'error');
    }
  } catch (err) {
    showToast('Network error during deletion.', 'error');
  }
}

function setProfileButtonLoading(btn, spinner, isLoading) {
  if (!btn) return;
  btn.disabled = isLoading;
  const btnText = btn.querySelector('.btn-text');
  if (spinner) spinner.classList.toggle('hidden', !isLoading);
  if (btnText && isLoading) btnText.style.opacity = '0.5';
  if (btnText && !isLoading) btnText.style.opacity = '1';
}
