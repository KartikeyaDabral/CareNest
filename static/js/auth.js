/**
 * CareNest Authentication Logic (Vanilla JS)
 * Covers: Signup, Login, Forgot Password, Reset Password
 */

/**
 * Handle Patient Sign-Up
 */
async function handleSignup() {
  clearAuthErrors();

  const fullName = document.getElementById('full_name').value.trim();
  const email = document.getElementById('email').value.trim().toLowerCase();
  const mobile = document.getElementById('mobile').value.trim();
  const password = document.getElementById('password').value;
  const confirmPassword = document.getElementById('confirm_password').value;
  const termsChecked = document.getElementById('terms').checked;

  let hasError = false;

  // Validation: Full name
  if (!fullName) {
    showFieldError('full_name', 'Please enter your full name.');
    hasError = true;
  }

  // Validation: Email
  const emailRegex = /^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$/;
  if (!email || !emailRegex.test(email)) {
    showFieldError('email', 'Please provide a valid email address.');
    hasError = true;
  }

  // Validation: Mobile (10 digits)
  const cleanMobile = mobile.replace(/\D/g, '');
  if (!cleanMobile || cleanMobile.length !== 10 || !/^[6-9]/.test(cleanMobile)) {
    showFieldError('mobile', 'Please provide a valid 10-digit Indian mobile number.');
    hasError = true;
  }

  // Validation: Password complexity
  if (password.length < 8) {
    showFieldError('password', 'Password must be at least 8 characters long.');
    hasError = true;
  } else if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/\d/.test(password) || !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    showFieldError('password', 'Password must satisfy all complexity criteria below.');
    hasError = true;
  }

  // Validation: Confirm Password
  if (password !== confirmPassword) {
    showFieldError('confirm_password', 'Passwords do not match.');
    hasError = true;
  }

  // Validation: Terms
  if (!termsChecked) {
    showFieldError('terms', 'You must agree to the Terms of Service to proceed.');
    hasError = true;
  }

  if (hasError) return;

  // Button spinner
  const submitBtn = document.getElementById('signup-submit-btn');
  const spinner = document.getElementById('signup-spinner');
  setButtonLoading(submitBtn, spinner, true);

  try {
    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({
        full_name: fullName,
        email: email,
        mobile: cleanMobile,
        password: password,
        confirm_password: confirmPassword,
        terms: termsChecked
      }),
      credentials: 'same-origin'
    });

    const result = await res.json();

    if (result.success) {
      showToast('Account created successfully! Redirecting to patient registration...', 'success');
      setTimeout(() => {
        window.location.href = '/register';
      }, 1000);
    } else {
      showAuthAlert('signup-alert', result.message || 'Signup failed. Please verify your details.');
    }
  } catch (err) {
    showAuthAlert('signup-alert', 'Network or server error during sign up. Please try again.');
  } finally {
    setButtonLoading(submitBtn, spinner, false);
  }
}

/**
 * Handle Patient Login
 */
async function handleLogin() {
  clearAuthErrors();

  const identifier = document.getElementById('identifier').value.trim();
  const password = document.getElementById('password').value;
  const rememberMe = document.getElementById('remember_me') ? document.getElementById('remember_me').checked : false;

  let hasError = false;

  if (!identifier) {
    showFieldError('identifier', 'Please enter your registered email or mobile number.');
    hasError = true;
  }

  if (!password) {
    showFieldError('password', 'Please enter your password.');
    hasError = true;
  }

  if (hasError) return;

  const submitBtn = document.getElementById('login-submit-btn');
  const spinner = document.getElementById('login-spinner');
  setButtonLoading(submitBtn, spinner, true);

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({
        identifier: identifier,
        password: password,
        remember_me: rememberMe
      }),
      credentials: 'same-origin'
    });

    const result = await res.json();

    if (result.success) {
      showToast('Login successful! Welcome to CareNest.', 'success');
      setTimeout(() => {
        // If not registered yet, redirect to registration; otherwise profile
        if (result.data && !result.data.is_registered) {
          window.location.href = '/register';
        } else {
          window.location.href = '/profile';
        }
      }, 800);
    } else {
      // Check lockout status
      if (res.status === 403 && result.data && result.data.locked) {
        showAuthAlert('login-alert', result.message, 'error');
      } else {
        showAuthAlert('login-alert', result.message || 'Invalid credentials.');
      }
    }
  } catch (err) {
    showAuthAlert('login-alert', 'Network error during login. Please check connection and try again.');
  } finally {
    setButtonLoading(submitBtn, spinner, false);
  }
}

/**
 * Handle Forgot Password
 */
async function handleForgotPassword() {
  clearAuthErrors();

  const email = document.getElementById('email').value.trim().toLowerCase();
  const emailRegex = /^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$/;

  if (!email || !emailRegex.test(email)) {
    showFieldError('email', 'Please enter a valid email address.');
    return;
  }

  const submitBtn = document.getElementById('forgot-submit-btn');
  const spinner = document.getElementById('forgot-spinner');
  setButtonLoading(submitBtn, spinner, true);

  try {
    const res = await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ email: email }),
      credentials: 'same-origin'
    });

    const result = await res.json();

    if (result.success) {
      showAuthAlert('forgot-alert', result.message, 'info');
      // If demo token is provided in response (demo mode)
      if (result.data && result.data.demo_token) {
        const demoBox = document.getElementById('demo-token-box');
        const tokenVal = document.getElementById('demo-token-val');
        const resetLink = document.getElementById('demo-reset-link');

        if (demoBox && tokenVal && resetLink) {
          tokenVal.textContent = result.data.demo_token;
          resetLink.href = `/reset-password?token=${encodeURIComponent(result.data.demo_token)}`;
          demoBox.classList.remove('hidden');
        }
      }
    } else {
      showAuthAlert('forgot-alert', result.message || 'Unable to process request.', 'error');
    }
  } catch (err) {
    showAuthAlert('forgot-alert', 'Network error. Please try again.', 'error');
  } finally {
    setButtonLoading(submitBtn, spinner, false);
  }
}

/**
 * Handle Reset Password
 */
async function handleResetPassword() {
  clearAuthErrors();

  const token = document.getElementById('token').value.trim();
  const newPassword = document.getElementById('new_password').value;
  const confirmPassword = document.getElementById('confirm_password').value;

  let hasError = false;

  if (!token) {
    showFieldError('token', 'Reset token is required.');
    hasError = true;
  }

  if (newPassword.length < 8) {
    showFieldError('new_password', 'Password must be at least 8 characters.');
    hasError = true;
  } else if (!/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/\d/.test(newPassword) || !/[!@#$%^&*(),.?":{}|<>]/.test(newPassword)) {
    showFieldError('new_password', 'Password must satisfy all complexity requirements.');
    hasError = true;
  }

  if (newPassword !== confirmPassword) {
    showFieldError('confirm_password', 'Passwords do not match.');
    hasError = true;
  }

  if (hasError) return;

  const submitBtn = document.getElementById('reset-submit-btn');
  const spinner = document.getElementById('reset-spinner');
  setButtonLoading(submitBtn, spinner, true);

  try {
    const res = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({
        token: token,
        new_password: newPassword,
        confirm_password: confirmPassword
      }),
      credentials: 'same-origin'
    });

    const result = await res.json();

    if (result.success) {
      showToast('Password has been reset successfully! Please sign in.', 'success');
      setTimeout(() => {
        window.location.href = '/login';
      }, 1200);
    } else {
      showAuthAlert('reset-alert', result.message || 'Reset failed. Token may be invalid or expired.');
    }
  } catch (err) {
    showAuthAlert('reset-alert', 'Network error. Please try again.');
  } finally {
    setButtonLoading(submitBtn, spinner, false);
  }
}

/* Helpers */
function showFieldError(fieldId, msg) {
  const errEl = document.getElementById(`err-${fieldId}`);
  const inputEl = document.getElementById(fieldId);
  if (errEl) errEl.textContent = msg;
  if (inputEl) inputEl.classList.add('is-invalid');
}

function clearAuthErrors() {
  document.querySelectorAll('.field-error-msg').forEach(el => el.textContent = '');
  document.querySelectorAll('.form-input').forEach(el => el.classList.remove('is-invalid'));
  document.querySelectorAll('.alert-box').forEach(el => el.classList.add('hidden'));
}

function showAuthAlert(alertId, message, type = 'error') {
  const alertEl = document.getElementById(alertId);
  if (!alertEl) return;
  alertEl.textContent = message;
  alertEl.className = `alert-box alert-${type}`;
  alertEl.classList.remove('hidden');
}

function setButtonLoading(btn, spinner, isLoading) {
  if (!btn) return;
  btn.disabled = isLoading;
  const btnText = btn.querySelector('.btn-text');
  if (spinner) spinner.classList.toggle('hidden', !isLoading);
  if (btnText && isLoading) btnText.style.opacity = '0.5';
  if (btnText && !isLoading) btnText.style.opacity = '1';
}
