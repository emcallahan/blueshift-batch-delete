// State management
const state = {
    apiKey: null,
    region: 'us',
    file: null,
    filePath: null,
    columns: [],
    rowCount: 0,
    preview: [],
    selectedColumn: null,
    identifierType: 'email',
    deleteAll: false,
    hasHeaders: true,
    jobId: null,
    jobStatus: 'idle',
    progress: { current: 0, total: 0 },
    logs: [],
    summary: null,
    eventSource: null
};

// DOM elements
const step1 = document.getElementById('step1');
const step2 = document.getElementById('step2');
const step3 = document.getElementById('step3');
const actionArea = document.getElementById('actionArea');
const progressSection = document.getElementById('progressSection');
const summarySection = document.getElementById('summarySection');

const apiKeyInput = document.getElementById('apiKey');
const regionSelect = document.getElementById('region');
const fileInput = document.getElementById('fileInput');
const fileUploadArea = document.getElementById('fileUploadArea');
const hasHeadersCheckbox = document.getElementById('hasHeaders');
const csvPreview = document.getElementById('csvPreview');
const previewTable = document.getElementById('previewTable');
const columnSelect = document.getElementById('columnName');
const identifierSelect = document.getElementById('identifierType');
const deleteAllCheckbox = document.getElementById('deleteAll');
const startBtn = document.getElementById('startBtn');
const cancelBtn = document.getElementById('cancelBtn');
const resetBtn = document.getElementById('resetBtn');
const confirmModal = document.getElementById('confirmModal');
const confirmYes = document.getElementById('confirmYes');
const confirmNo = document.getElementById('confirmNo');
const confirmCount = document.getElementById('confirmCount');
const progressFill = document.getElementById('progressFill');
const progressText = document.getElementById('progressText');
const logEntries = document.getElementById('logEntries');

// Initialize
function init() {
    // Step 1: API Configuration
    apiKeyInput.addEventListener('input', checkStep1);
    regionSelect.addEventListener('change', () => {
        state.region = regionSelect.value;
        checkStep1();
    });

    // Step 2: File Upload
    fileUploadArea.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', handleFileSelect);
    hasHeadersCheckbox.addEventListener('change', () => {
        state.hasHeaders = hasHeadersCheckbox.checked;
    });

    // Drag and drop
    fileUploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        fileUploadArea.classList.add('dragover');
    });
    fileUploadArea.addEventListener('dragleave', () => {
        fileUploadArea.classList.remove('dragover');
    });
    fileUploadArea.addEventListener('drop', handleFileDrop);

    // Step 3: Configuration
    columnSelect.addEventListener('change', checkStep3);
    identifierSelect.addEventListener('change', checkStep3);
    deleteAllCheckbox.addEventListener('change', checkStep3);

    // Actions
    startBtn.addEventListener('click', showConfirmation);
    confirmYes.addEventListener('click', startBatch);
    confirmNo.addEventListener('click', hideConfirmation);
    cancelBtn.addEventListener('click', cancelBatch);
    resetBtn.addEventListener('click', resetForm);

    checkStep1();
}

// Step 1: Validate API configuration
function checkStep1() {
    const apiKey = apiKeyInput.value.trim();
    const region = regionSelect.value;

    if (apiKey && region) {
        state.apiKey = apiKey;
        state.region = region;
        step2.removeAttribute('disabled');
    } else {
        step2.setAttribute('disabled', '');
        step3.setAttribute('disabled', '');
        actionArea.style.display = 'none';
    }
}

// Step 2: Handle file selection
async function handleFileSelect(e) {
    const file = e.target.files[0];
    if (file) {
        await uploadFile(file);
    }
}

// Step 2: Handle file drop
async function handleFileDrop(e) {
    e.preventDefault();
    fileUploadArea.classList.remove('dragover');

    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith('.csv')) {
        await uploadFile(file);
    } else {
        alert('Please upload a CSV file');
    }
}

// Step 2: Upload and parse CSV
async function uploadFile(file) {
    try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('hasHeaders', state.hasHeaders);

        const response = await fetch('/api/parse-csv', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to upload file');
        }

        const data = await response.json();
        state.file = file;
        state.filePath = data.filePath;
        state.columns = data.columns;
        state.rowCount = data.rowCount;
        state.preview = data.preview;

        // Update UI
        fileUploadArea.querySelector('.upload-prompt').style.display = 'none';
        const fileInfo = fileUploadArea.querySelector('.file-info');
        fileInfo.style.display = 'flex';
        fileInfo.querySelector('.file-name').textContent = file.name;

        // Show preview
        showPreview();

        // Populate column dropdown
        columnSelect.innerHTML = '<option value="">Select column...</option>';
        state.columns.forEach(col => {
            const option = document.createElement('option');
            option.value = col;
            option.textContent = col;
            columnSelect.appendChild(option);
        });

        // Enable step 3
        step3.removeAttribute('disabled');

    } catch (error) {
        alert('Error: ' + error.message);
    }
}

// Step 2: Show CSV preview
function showPreview() {
    if (state.preview.length === 0) return;

    csvPreview.style.display = 'block';

    // Create table
    let html = '<thead><tr>';
    state.columns.forEach(col => {
        html += `<th>${col}</th>`;
    });
    html += '</tr></thead><tbody>';

    state.preview.forEach(row => {
        html += '<tr>';
        state.columns.forEach(col => {
            html += `<td>${row[col] || ''}</td>`;
        });
        html += '</tr>';
    });
    html += '</tbody>';

    previewTable.innerHTML = html;
}

// Step 2: Remove file
document.querySelector('.btn-remove')?.addEventListener('click', (e) => {
    e.stopPropagation();
    fileInput.value = '';
    state.file = null;
    state.filePath = null;
    state.columns = [];
    state.preview = [];

    fileUploadArea.querySelector('.upload-prompt').style.display = 'block';
    fileUploadArea.querySelector('.file-info').style.display = 'none';
    csvPreview.style.display = 'none';

    step3.setAttribute('disabled', '');
    actionArea.style.display = 'none';
});

// Step 3: Validate configuration
function checkStep3() {
    state.selectedColumn = columnSelect.value;
    state.identifierType = identifierSelect.value;
    state.deleteAll = deleteAllCheckbox.checked;

    if (state.selectedColumn && state.identifierType) {
        actionArea.style.display = 'block';
        startBtn.disabled = false;
    } else {
        actionArea.style.display = 'none';
        startBtn.disabled = true;
    }
}

// Show confirmation modal
function showConfirmation() {
    confirmCount.textContent = state.rowCount;
    confirmModal.style.display = 'flex';
}

// Hide confirmation modal
function hideConfirmation() {
    confirmModal.style.display = 'none';
}

// Start batch processing
async function startBatch() {
    hideConfirmation();

    try {
        const response = await fetch('/api/start-batch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                apiKey: state.apiKey,
                region: state.region,
                identifierType: state.identifierType,
                columnName: state.selectedColumn,
                deleteAll: state.deleteAll,
                hasHeaders: state.hasHeaders,
                filePath: state.filePath
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to start batch');
        }

        const data = await response.json();
        state.jobId = data.jobId;
        state.jobStatus = 'running';

        // Hide configuration, show progress
        step1.style.display = 'none';
        step2.style.display = 'none';
        step3.style.display = 'none';
        actionArea.style.display = 'none';
        progressSection.style.display = 'block';

        // Connect to SSE
        connectSSE();

    } catch (error) {
        alert('Error: ' + error.message);
    }
}

// Connect to Server-Sent Events
function connectSSE() {
    state.eventSource = new EventSource('/api/progress');

    state.eventSource.addEventListener('connected', (e) => {
        console.log('SSE connected:', e.data);
    });

    state.eventSource.addEventListener('start', (e) => {
        const data = JSON.parse(e.data);
        state.progress.total = data.total;
        addLogEntry(`Starting batch deletion of ${data.total} records...`, 'info');
    });

    state.eventSource.addEventListener('progress', (e) => {
        const data = JSON.parse(e.data);
        state.progress = data;
        updateProgress();
    });

    state.eventSource.addEventListener('success', (e) => {
        const data = JSON.parse(e.data);
        addLogEntry(`✓ Deleted: ${data.identifier}`, 'success');
    });

    state.eventSource.addEventListener('failure', (e) => {
        const data = JSON.parse(e.data);
        addLogEntry(`✗ Failed: ${data.identifier} (${data.status}: ${data.error})`, 'failure');
    });

    state.eventSource.addEventListener('rateLimit', (e) => {
        const data = JSON.parse(e.data);
        addLogEntry(`⚠️ Rate limited - increasing delay to ${data.newDelay}ms`, 'info');
    });

    state.eventSource.addEventListener('complete', (e) => {
        const data = JSON.parse(e.data);
        state.summary = data;
        state.jobStatus = 'completed';
        showSummary();
        state.eventSource.close();
    });

    state.eventSource.addEventListener('cancelled', () => {
        addLogEntry('Batch processing cancelled', 'info');
        state.jobStatus = 'cancelled';
        state.eventSource.close();
        setTimeout(() => resetForm(), 2000);
    });

    state.eventSource.addEventListener('error', (e) => {
        if (e.data) {
            const data = JSON.parse(e.data);
            addLogEntry(`Error: ${data.message}`, 'failure');
        }
    });

    state.eventSource.onerror = () => {
        console.error('SSE connection error');
        if (state.jobStatus !== 'completed' && state.jobStatus !== 'cancelled') {
            addLogEntry('Connection lost. Attempting to reconnect...', 'info');
        }
    };
}

// Update progress bar
function updateProgress() {
    const percentage = state.progress.percentage || 0;
    progressFill.style.width = `${percentage}%`;
    progressText.textContent = `${state.progress.current} / ${state.progress.total} (${percentage}%)`;
}

// Add log entry
function addLogEntry(message, type = 'info') {
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    entry.textContent = message;
    logEntries.appendChild(entry);

    // Keep only last 50 entries
    while (logEntries.children.length > 50) {
        logEntries.removeChild(logEntries.firstChild);
    }

    // Auto-scroll to bottom
    logEntries.parentElement.scrollTop = logEntries.parentElement.scrollHeight;
}

// Show summary
function showSummary() {
    progressSection.style.display = 'none';
    summarySection.style.display = 'block';

    document.getElementById('summaryTotal').textContent = state.summary.totalProcessed;
    document.getElementById('summarySuccess').textContent = state.summary.successCount;
    document.getElementById('summaryFailed').textContent = state.summary.failureCount;
    document.getElementById('summaryDuration').textContent = state.summary.duration;

    // Add download buttons
    const downloadActions = document.getElementById('downloadActions');
    downloadActions.innerHTML = '';

    if (state.summary.hasFailedRecords) {
        const failedBtn = document.createElement('button');
        failedBtn.className = 'btn btn-secondary';
        failedBtn.textContent = 'Download Failed Records';
        failedBtn.onclick = () => downloadFile(state.summary.failedRecordsFile, 'failed');
        downloadActions.appendChild(failedBtn);
    }

    const logBtn = document.createElement('button');
    logBtn.className = 'btn btn-secondary';
    logBtn.textContent = 'Download Full Log';
    logBtn.onclick = () => downloadFile(state.summary.logFile, 'log');
    downloadActions.appendChild(logBtn);
}

// Download file
function downloadFile(filePath, type) {
    const endpoint = type === 'failed' ? '/api/download-failed' : '/api/download-log';
    window.location.href = `${endpoint}?file=${encodeURIComponent(filePath)}`;
}

// Cancel batch
async function cancelBatch() {
    if (confirm('Are you sure you want to cancel the batch processing?')) {
        try {
            await fetch('/api/cancel', { method: 'DELETE' });
        } catch (error) {
            console.error('Error cancelling batch:', error);
        }
    }
}

// Reset form
function resetForm() {
    // Clear state
    state.apiKey = null;
    state.file = null;
    state.filePath = null;
    state.columns = [];
    state.preview = [];
    state.jobStatus = 'idle';
    state.logs = [];
    state.summary = null;

    // Reset UI
    apiKeyInput.value = '';
    regionSelect.value = 'us';
    fileInput.value = '';
    hasHeadersCheckbox.checked = true;
    columnSelect.value = '';
    identifierSelect.value = 'email';
    deleteAllCheckbox.checked = false;

    fileUploadArea.querySelector('.upload-prompt').style.display = 'block';
    fileUploadArea.querySelector('.file-info').style.display = 'none';
    csvPreview.style.display = 'none';

    step1.style.display = 'block';
    step2.style.display = 'block';
    step2.setAttribute('disabled', '');
    step3.style.display = 'block';
    step3.setAttribute('disabled', '');
    actionArea.style.display = 'none';
    progressSection.style.display = 'none';
    summarySection.style.display = 'none';

    progressFill.style.width = '0%';
    progressText.textContent = '0 / 0 (0%)';
    logEntries.innerHTML = '';

    // Close SSE if open
    if (state.eventSource) {
        state.eventSource.close();
        state.eventSource = null;
    }

    checkStep1();
}

// Initialize on page load
init();
