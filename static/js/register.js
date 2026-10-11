/**
 * CareNest Patient Registration Multi-Step Wizard (Vanilla JS)
 */

let currentStep = 1;

document.addEventListener('DOMContentLoaded', () => {
  prefillUserInfo();
  setupStepValidation();
});

/**
 * Pre-fill authenticated user's email and mobile
 */
async function prefillUserInfo() {
  try {
    const res = await fetch('/api/registration', {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      credentials: 'same-origin'
    });
    if (res.ok) {
      const result = await res.json();
      if (result.success && result.data) {
        const data = result.data;
        const emailInput = document.getElementById('reg_email');
        const mobileInput = document.getElementById('reg_mobile');

        if (emailInput) emailInput.value = data.email || '';
        if (mobileInput) mobileInput.value = data.login_mobile || data.mobile || '';

        // If existing profile data is present, populate it
        if (data.first_name) {
          const fn = document.getElementById('first_name');
          const ln = document.getElementById('last_name');
          const dob = document.getElementById('date_of_birth');
          const gen = document.getElementById('gender');
          const bg = document.getElementById('blood_group');

          if (fn) fn.value = data.first_name || '';
          if (ln) ln.value = data.last_name || '';
          if (dob && data.date_of_birth) dob.value = data.date_of_birth.substring(0, 10);
          if (gen) gen.value = data.gender || '';
          if (bg) bg.value = data.blood_group || '';
        }
      }
    }
  } catch (err) {
    // Non-blocking
  }
}

/**
 * Navigate between wizard steps
 */
function goToStep(targetStep) {
  // If moving forward, validate current step first
  if (targetStep > currentStep) {
    const isValid = validateStep(currentStep);
    if (!isValid) return;
  }

  // Hide all panels
  document.querySelectorAll('.form-step-panel').forEach(panel => panel.classList.add('hidden'));

  // Show target panel
  const targetPanel = document.getElementById(`step-panel-${targetStep}`);
  if (targetPanel) targetPanel.classList.remove('hidden');

  // Update Stepper UI
  updateStepperUI(targetStep);

  currentStep = targetStep;
  window.scrollTo({ top: 120, behavior: 'smooth' });
}

function updateStepperUI(step) {
  for (let i = 1; i <= 3; i++) {
    const node = document.getElementById(`step-node-${i}`);
    const line = document.getElementById(`step-line-${i}`);

    if (node) {
      if (i < step) {
        node.className = 'stepper-step completed';
      } else if (i === step) {
        node.className = 'stepper-step active';
      } else {
        node.className = 'stepper-step';
      }
    }

    if (line) {
      line.classList.toggle('completed', i < step);
    }
  }
}

/**
 * Validate fields for a given step
 */
function validateStep(step) {
  clearStepErrors();
  let valid = true;

  if (step === 1) {
    const fn = document.getElementById('first_name').value.trim();
    const ln = document.getElementById('last_name').value.trim();
    const dob = document.getElementById('date_of_birth').value;
    const gender = document.getElementById('gender').value;

    if (!fn) {
      showRegError('first_name', 'First name is required.');
      valid = false;
    }
    if (!ln) {
      showRegError('last_name', 'Last name is required.');
      valid = false;
    }
    if (!dob) {
      showRegError('date_of_birth', 'Date of birth is required.');
      valid = false;
    } else {
      const dobDate = new Date(dob);
      if (dobDate > new Date()) {
        showRegError('date_of_birth', 'Date of birth cannot be in the future.');
        valid = false;
      }
    }
    if (!gender) {
      showRegError('gender', 'Please select your gender.');
      valid = false;
    }
  } else if (step === 2) {
    const mobile = document.getElementById('reg_mobile').value.trim().replace(/\D/g, '');
    const altMobile = document.getElementById('alternate_mobile').value.trim().replace(/\D/g, '');
    const addr1 = document.getElementById('address_line1').value.trim();
    const city = document.getElementById('city').value.trim();
    const state = document.getElementById('state').value;
    const pincode = document.getElementById('pincode').value.trim();

    if (!mobile || mobile.length !== 10) {
      showRegError('reg_mobile', 'Valid 10-digit primary mobile number is required.');
      valid = false;
    }
    if (altMobile && altMobile.length !== 10) {
      showRegError('alternate_mobile', 'Alternate mobile must be 10 digits.');
      valid = false;
    }
    if (!addr1) {
      showRegError('address_line1', 'Delivery address line 1 is required.');
      valid = false;
    }
    if (!city) {
      showRegError('city', 'City is required.');
      valid = false;
    }
    if (!state) {
      showRegError('state', 'Please select a State or UT.');
      valid = false;
    }
    if (!pincode || !/^\d{6}$/.test(pincode)) {
      showRegError('pincode', 'Please enter a valid 6-digit Indian pincode.');
      valid = false;
    }
  } else if (step === 3) {
    const emgName = document.getElementById('emergency_contact_name').value.trim();
    const emgPhone = document.getElementById('emergency_contact_phone').value.trim().replace(/\D/g, '');

    if (!emgName) {
      showRegError('emergency_contact_name', 'Emergency contact name is required.');
      valid = false;
    }
    if (!emgPhone || emgPhone.length !== 10) {
      showRegError('emergency_contact_phone', 'Valid 10-digit emergency contact phone is required.');
      valid = false;
    }
  }

  return valid;
}

/**
 * Submit complete registration form
 */
async function submitRegistration() {
  if (!validateStep(3)) return;

  const btn = document.getElementById('submit-registration-btn');
  const spinner = document.getElementById('reg-spinner');
  setRegButtonLoading(btn, spinner, true);

  const payload = {
    first_name: document.getElementById('first_name').value.trim(),
    last_name: document.getElementById('last_name').value.trim(),
    date_of_birth: document.getElementById('date_of_birth').value,
    gender: document.getElementById('gender').value,
    blood_group: document.getElementById('blood_group').value,
    mobile: document.getElementById('reg_mobile').value.trim().replace(/\D/g, ''),
    alternate_mobile: document.getElementById('alternate_mobile').value.trim().replace(/\D/g, ''),
    address_line1: document.getElementById('address_line1').value.trim(),
    address_line2: document.getElementById('address_line2').value.trim(),
    city: document.getElementById('city').value.trim(),
    state: document.getElementById('state').value,
    pincode: document.getElementById('pincode').value.trim(),
    allergies: document.getElementById('allergies').value.trim(),
    chronic_conditions: document.getElementById('chronic_conditions').value.trim(),
    current_medications: document.getElementById('current_medications').value.trim(),
    emergency_contact_name: document.getElementById('emergency_contact_name').value.trim(),
    emergency_contact_phone: document.getElementById('emergency_contact_phone').value.trim().replace(/\D/g, '')
  };

  try {
    const res = await fetch('/api/registration', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(payload),
      credentials: 'same-origin'
    });

    const result = await res.json();

    if (result.success) {
      showToast('Registration complete! Welcome to the CareNest family.', 'success');
      setTimeout(() => {
        window.location.href = '/documents';
      }, 1000);
    } else {
      // If already registered, offer to update via PUT
      if (res.status === 409) {
        await updateRegistrationFallback(payload);
      } else {
        showRegAlert(result.message || 'Registration submission failed.');
      }
    }
  } catch (err) {
    showRegAlert('Network error during registration. Please check connection and retry.');
  } finally {
    setRegButtonLoading(btn, spinner, false);
  }
}

async function updateRegistrationFallback(payload) {
  try {
    const res = await fetch('/api/registration', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      credentials: 'same-origin'
    });
    const result = await res.json();
    if (result.success) {
      showToast('Profile updated successfully!', 'success');
      setTimeout(() => { window.location.href = '/profile'; }, 1000);
    } else {
      showRegAlert(result.message || 'Update failed.');
    }
  } catch (err) {
    showRegAlert('Network error.');
  }
}

function setupStepValidation() {
  // Max DOB is today
  const dob = document.getElementById('date_of_birth');
  if (dob) {
    const today = new Date().toISOString().split('T')[0];
    dob.setAttribute('max', today);
  }
}

function showRegError(fieldId, msg) {
  const err = document.getElementById(`err-${fieldId}`);
  const inp = document.getElementById(fieldId);
  if (err) err.textContent = msg;
  if (inp) inp.classList.add('is-invalid');
}

function clearStepErrors() {
  document.querySelectorAll('.field-error-msg').forEach(el => el.textContent = '');
  document.querySelectorAll('.form-input, .form-select').forEach(el => el.classList.remove('is-invalid'));
  const alert = document.getElementById('registration-alert');
  if (alert) alert.classList.add('hidden');
}

function showRegAlert(msg) {
  const alert = document.getElementById('registration-alert');
  if (alert) {
    alert.textContent = msg;
    alert.classList.remove('hidden');
  }
}

function setRegButtonLoading(btn, spinner, isLoading) {
  if (!btn) return;
  btn.disabled = isLoading;
  const btnText = btn.querySelector('.btn-text');
  if (spinner) spinner.classList.toggle('hidden', !isLoading);
  if (btnText && isLoading) btnText.style.opacity = '0.5';
  if (btnText && !isLoading) btnText.style.opacity = '1';
}
