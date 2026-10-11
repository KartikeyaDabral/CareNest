/**
 * CareNest Documents & Prescription Management Logic (Vanilla JS)
 */

let selectedFile = null;
let currentDocuments = [];

document.addEventListener('DOMContentLoaded', () => {
  setupDropZone();
  loadUserDocuments();
});

/**
 * Setup Drag-and-Drop file handling & input listeners
 */
function setupDropZone() {
  const dropZone = document.getElementById('drop-zone');
  const fileInput = document.getElementById('file-input');
  const uploadBtn = document.getElementById('upload-submit-btn');

  if (!dropZone || !fileInput) return;

  // Drag over / leave effects
  ['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.add('dragover');
    });
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.remove('dragover');
    });
  });

  // Drop event
  dropZone.addEventListener('drop', (e) => {
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleFileSelected(files[0]);
    }
  });

  // Browse file selection
  fileInput.addEventListener('change', (e) => {
    if (fileInput.files && fileInput.files.length > 0) {
      handleFileSelected(fileInput.files[0]);
    }
  });
}

/**
 * Handle chosen file & generate preview
 */
function handleFileSelected(file) {
  const errEl = document.getElementById('upload-error-msg');
  const uploadBtn = document.getElementById('upload-submit-btn');
  errEl.textContent = '';

  // Validate format
  const allowedExtensions = ['pdf', 'jpg', 'jpeg', 'png'];
  const ext = file.name.split('.').pop().toLowerCase();

  if (!allowedExtensions.includes(ext)) {
    errEl.textContent = 'Invalid file format. Only PDF, JPG, and PNG files are accepted.';
    clearSelectedFile();
    return;
  }

  // Validate size (5 MB = 5 * 1024 * 1024)
  const maxSize = 5 * 1024 * 1024;
  if (file.size > maxSize) {
    errEl.textContent = `File size (${formatFileSize(file.size)}) exceeds the maximum limit of 5 MB.`;
    clearSelectedFile();
    return;
  }

  selectedFile = file;

  // Show preview UI
  const idleState = document.getElementById('drop-zone-idle');
  const previewState = document.getElementById('drop-zone-preview');
  const nameEl = document.getElementById('selected-file-name');
  const sizeEl = document.getElementById('selected-file-size');
  const typeEl = document.getElementById('selected-file-type');
  const thumbWrap = document.getElementById('preview-thumb-container');

  if (nameEl) nameEl.textContent = file.name;
  if (sizeEl) sizeEl.textContent = formatFileSize(file.size);
  if (typeEl) typeEl.textContent = ext.toUpperCase();

  // Render thumbnail
  if (thumbWrap) {
    thumbWrap.innerHTML = '';
    if (ext === 'pdf') {
      thumbWrap.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"/>
        </svg>
      `;
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = document.createElement('img');
        img.src = e.target.result;
        img.alt = 'Preview';
        thumbWrap.appendChild(img);
      };
      reader.readAsDataURL(file);
    }
  }

  if (idleState) idleState.classList.add('hidden');
  if (previewState) previewState.classList.remove('hidden');
  if (uploadBtn) uploadBtn.disabled = false;
}

function clearSelectedFile() {
  selectedFile = null;
  const fileInput = document.getElementById('file-input');
  if (fileInput) fileInput.value = '';

  const idleState = document.getElementById('drop-zone-idle');
  const previewState = document.getElementById('drop-zone-preview');
  const uploadBtn = document.getElementById('upload-submit-btn');

  if (idleState) idleState.classList.remove('hidden');
  if (previewState) previewState.classList.add('hidden');
  if (uploadBtn) uploadBtn.disabled = true;
}

/**
 * Upload document to server
 */
async function handleDocumentUpload() {
  if (!selectedFile) return;

  const docType = document.getElementById('doc_type_select').value;
  const uploadBtn = document.getElementById('upload-submit-btn');
  const spinner = document.getElementById('upload-spinner');
  const errEl = document.getElementById('upload-error-msg');
  errEl.textContent = '';

  const formData = new FormData();
  formData.append('file', selectedFile);
  formData.append('document_type', docType);

  setUploadLoading(uploadBtn, spinner, true);

  try {
    const res = await fetch('/api/documents', {
      method: 'POST',
      body: formData,
      credentials: 'same-origin'
    });

    const result = await res.json();

    if (result.success) {
      showToast(`${docType} uploaded successfully!`, 'success');
      clearSelectedFile();
      loadUserDocuments();
    } else {
      errEl.textContent = result.message || 'Upload failed.';
    }
  } catch (err) {
    errEl.textContent = 'Network error while uploading document.';
  } finally {
    setUploadLoading(uploadBtn, spinner, false);
  }
}

/**
 * Load documents list from GET /api/documents
 */
async function loadUserDocuments() {
  const tableBody = document.getElementById('documents-table-body');
  const emptyState = document.getElementById('table-empty');
  const loadingState = document.getElementById('table-loading');
  const tableWrapper = document.getElementById('table-wrapper');
  const countBadge = document.getElementById('doc-count-badge');

  if (!tableBody) return;

  if (loadingState) loadingState.classList.remove('hidden');
  if (emptyState) emptyState.classList.add('hidden');
  if (tableWrapper) tableWrapper.classList.add('hidden');

  try {
    const res = await fetch('/api/documents', {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      credentials: 'same-origin'
    });

    if (res.ok) {
      const result = await res.json();
      currentDocuments = result.data || [];

      if (countBadge) countBadge.textContent = currentDocuments.length;

      if (loadingState) loadingState.classList.add('hidden');

      if (currentDocuments.length === 0) {
        if (emptyState) emptyState.classList.remove('hidden');
        if (tableWrapper) tableWrapper.classList.add('hidden');
      } else {
        renderDocumentsTable(currentDocuments);
        if (emptyState) emptyState.classList.add('hidden');
        if (tableWrapper) tableWrapper.classList.remove('hidden');
      }
    } else {
      if (loadingState) loadingState.classList.add('hidden');
      if (emptyState) emptyState.classList.remove('hidden');
    }
  } catch (err) {
    if (loadingState) loadingState.classList.add('hidden');
    if (emptyState) emptyState.classList.remove('hidden');
  }
}

/**
 * Render document rows into table
 */
function renderDocumentsTable(docs) {
  const tableBody = document.getElementById('documents-table-body');
  if (!tableBody) return;

  tableBody.innerHTML = docs.map(doc => {
    const statusClass = (doc.status || 'Pending').toLowerCase();
    const formattedDate = formatDateTime(doc.uploaded_at);

    return `
      <tr>
        <td>
          <div class="flex items-center gap-2">
            <svg style="width:18px;height:18px;color:#0b8471;flex-shrink:0;" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clip-rule="evenodd"/>
            </svg>
            <strong>${escapeHtml(doc.original_file_name)}</strong>
          </div>
        </td>
        <td>
          <span class="doc-type-badge">${escapeHtml(doc.document_type)}</span>
        </td>
        <td>${doc.file_size_kb} KB</td>
        <td><small class="text-slate-600">${formattedDate}</small></td>
        <td>
          <span class="status-pill ${statusClass}">
            <span>●</span> ${escapeHtml(doc.status || 'Pending')}
          </span>
        </td>
        <td class="text-right">
          <div class="action-btns">
            <button type="button" class="btn btn-outline-teal btn-sm" onclick="openDocPreviewModal(${doc.document_id})">
              Preview
            </button>
            <a href="/api/documents/${doc.document_id}?download=1" class="btn btn-outline-teal btn-sm" download>
              Download
            </a>
            <button type="button" class="btn btn-outline-teal btn-sm" onclick="openDocReplaceModal(${doc.document_id}, '${escapeHtml(doc.document_type)}')">
              Replace
            </button>
            <button type="button" class="btn btn-outline-danger btn-sm" onclick="openDocDeleteModal(${doc.document_id}, '${escapeHtml(doc.original_file_name)}')">
              Delete
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

/**
 * Preview Modal logic
 */
function openDocPreviewModal(docId) {
  const doc = currentDocuments.find(d => d.document_id === docId);
  if (!doc) return;

  const modal = document.getElementById('doc-preview-modal');
  const title = document.getElementById('preview-modal-title');
  const content = document.getElementById('preview-modal-content');
  const dlLink = document.getElementById('preview-download-link');

  if (!modal || !content) return;

  title.textContent = `${doc.document_type}: ${doc.original_file_name}`;
  dlLink.href = `/api/documents/${doc.document_id}?download=1`;

  const isPdf = (doc.mime_type && doc.mime_type.includes('pdf')) || doc.original_file_name.toLowerCase().endsWith('.pdf');
  const fileUrl = `/api/documents/${doc.document_id}`;

  if (isPdf) {
    content.innerHTML = `
      <div style="height:500px;width:100%;">
        <iframe src="${fileUrl}" style="width:100%;height:100%;border:none;border-radius:8px;"></iframe>
      </div>
    `;
  } else {
    content.innerHTML = `
      <div style="text-align:center;padding:1rem;">
        <img src="${fileUrl}" alt="${escapeHtml(doc.original_file_name)}" style="max-width:100%;max-height:500px;border-radius:8px;box-shadow:0 4px 6px -1px rgba(0,0,0,0.1);">
      </div>
    `;
  }

  modal.classList.remove('hidden');
}

function closeDocPreviewModal() {
  const modal = document.getElementById('doc-preview-modal');
  if (modal) modal.classList.add('hidden');
}

/**
 * Replace Modal logic
 */
function openDocReplaceModal(docId, currentType) {
  const modal = document.getElementById('doc-replace-modal');
  const idInput = document.getElementById('replace-doc-id');
  const typeSelect = document.getElementById('replace-doc-type');
  const fileInput = document.getElementById('replace-file-input');
  const errEl = document.getElementById('replace-error-msg');

  if (!modal) return;
  idInput.value = docId;
  typeSelect.value = currentType || 'Prescription';
  if (fileInput) fileInput.value = '';
  if (errEl) errEl.textContent = '';

  modal.classList.remove('hidden');
}

function closeDocReplaceModal() {
  const modal = document.getElementById('doc-replace-modal');
  if (modal) modal.classList.add('hidden');
}

async function confirmReplaceDocument() {
  const docId = document.getElementById('replace-doc-id').value;
  const docType = document.getElementById('replace-doc-type').value;
  const fileInput = document.getElementById('replace-file-input');
  const errEl = document.getElementById('replace-error-msg');

  const formData = new FormData();
  formData.append('document_type', docType);
  if (fileInput.files && fileInput.files.length > 0) {
    formData.append('file', fileInput.files[0]);
  }

  try {
    const res = await fetch(`/api/documents/${docId}`, {
      method: 'PUT',
      body: formData,
      credentials: 'same-origin'
    });

    const result = await res.json();
    if (result.success) {
      showToast('Document updated successfully.', 'success');
      closeDocReplaceModal();
      loadUserDocuments();
    } else {
      errEl.textContent = result.message || 'Update failed.';
    }
  } catch (err) {
    errEl.textContent = 'Network error while updating document.';
  }
}

/**
 * Delete Modal logic
 */
function openDocDeleteModal(docId, docName) {
  const modal = document.getElementById('doc-delete-modal');
  const idInput = document.getElementById('delete-doc-id');
  const nameEl = document.getElementById('delete-doc-name');

  if (!modal) return;
  idInput.value = docId;
  if (nameEl) nameEl.textContent = docName;
  modal.classList.remove('hidden');
}

function closeDocDeleteModal() {
  const modal = document.getElementById('doc-delete-modal');
  if (modal) modal.classList.add('hidden');
}

async function confirmDeleteDocument() {
  const docId = document.getElementById('delete-doc-id').value;
  try {
    const res = await fetch(`/api/documents/${docId}`, {
      method: 'DELETE',
      credentials: 'same-origin'
    });
    const result = await res.json();
    if (result.success) {
      showToast('Document removed from records.', 'info');
      closeDocDeleteModal();
      loadUserDocuments();
    } else {
      showToast(result.message || 'Could not delete document.', 'error');
    }
  } catch (err) {
    showToast('Network error while deleting document.', 'error');
  }
}

/* Format utilities */
function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatDateTime(isoString) {
  if (!isoString) return 'Just now';
  try {
    const d = new Date(isoString);
    return d.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (e) {
    return isoString;
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/[&<>"']/g, s => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[s]);
}

function setUploadLoading(btn, spinner, isLoading) {
  if (!btn) return;
  btn.disabled = isLoading;
  const btnText = btn.querySelector('.btn-text');
  if (spinner) spinner.classList.toggle('hidden', !isLoading);
  if (btnText && isLoading) btnText.style.opacity = '0.5';
  if (btnText && !isLoading) btnText.style.opacity = '1';
}
