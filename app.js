// ============================================
// PG WORKSHOP REGISTRATION PORTAL
// Frontend JavaScript (app.js) – ULTRA FAST EDITION
// ============================================

// Configuration
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyuEj2pySImGcHQvlcmW4tHxoUgZR7vU2uQEhxpUaT3EvenqARuO7wsxoFqweIqjC5b/exec";
const CSV_STUDENTS_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQoxIRr-axYhnWISr0bVPaTIhZK-aoBv3KZQZCdCJDlrCtgbFfw0F29IyxV6pyMIQRjb9UmRIPrOZRw/pub?gid=0&single=true&output=csv";

// Slot rules
const SLOT_RULES = {
    "PG Second Year": { "week-1": 14, "week-2": 15, "week-3": 15 },
    "PG First Year":  { "week-1": 11, "week-2": 12, "week-3": 12 }
};

const WEEKS = ["week-1", "week-2", "week-3"];
const WEEK_DISPLAY_NAMES = {
    "week-1": "Week 1",
    "week-2": "Week 2",
    "week-3": "Week 3"
};

// Year classification lists (hardcoded for speed)
const PG_SECOND_YEAR = [16074, 16075, 16077, 16078, 16082, 16110, 16122, 16128, 16138, 16146, 16148, 16150, 16156, 16158, 16160, 16172, 16176, 16178, 16179, 16185, 16187, 16194, 16207, 16215, 16219, 16222, 16227, 16232, 16234, 16245, 16248, 16262, 16271, 16273, 16274, 16279, 16297, 16300, 16308, 16334, 16382, 16383, 16552, 16612];
const PG_FIRST_YEAR = [16620, 16622, 16628, 16635, 16648, 16649, 16651, 16663, 16666, 16668, 16678, 16683, 16691, 16696, 16701, 16709, 16715, 16739, 16751, 16770, 16784, 16798, 16807, 16821, 16823, 16835, 16846, 16855, 16875, 16889, 16960, 17028, 17047, 17106, 17195];

// ============================================
// GLOBAL STATE (Optimized for speed)
// ============================================
let studentsMap = new Map();               // enrol -> { name, mode }
let registrations = [];                    // raw registration objects
let slotUsageCache = {                     // precomputed slot usage
    "PG Second Year": { "week-1": 0, "week-2": 0, "week-3": 0 },
    "PG First Year":  { "week-1": 0, "week-2": 0, "week-3": 0 }
};
let currentStudent = null;
let selectedWeek = null;
let dataReady = false;                     // both CSV and registrations loaded
let pendingEnrol = null;                   // if user typed before data ready

// DOM elements
const enrolInput = document.getElementById('enrolNo');
const studentNameField = document.getElementById('studentName');
const modeField = document.getElementById('modeField');
const yearField = document.getElementById('yearField');
const weekContainer = document.getElementById('weekContainer');
const weekSlotInfo = document.getElementById('weekSlotInfo');
const submitBtn = document.getElementById('submitBtn');
const alertPopup = document.getElementById('alertPopup');
const enrolError = document.getElementById('enrolError');
const statusContainer = document.getElementById('statusContainer');
const statusDisplay = document.getElementById('statusDisplay');

// ============================================
// 🚀 INIT – PARALLEL LOAD, INPUT ENABLED IMMEDIATELY
// ============================================
(async function init() {
    // Enable input right away – no "Loading..." placeholder
    enrolInput.disabled = false;
    enrolInput.placeholder = "Enter your enrolment number";
    
    // Start both fetches in parallel
    const csvPromise = loadCSVData();
    const regPromise = loadRegistrations();
    
    await Promise.all([csvPromise, regPromise]);
    
    // Data is ready
    dataReady = true;
    computeSlotUsage();            // build cache from registrations
    
    // If user already typed something, process it now
    if (pendingEnrol) {
        lookupStudent(pendingEnrol);
        pendingEnrol = null;
    }
    
    // Start background refresh (every 30s) to keep slots accurate
    setInterval(async () => {
        await loadRegistrations();
        computeSlotUsage();
        // If a student is currently viewing, refresh week cards to show latest slots
        if (currentStudent && currentStudent.year) {
            renderWeekCards(currentStudent.year);
        }
    }, 30000);
    
    console.log('⚡ Portal ready – all data cached');
})();

// ============================================
// 📥 FAST CSV LOAD (parses directly into Map)
// ============================================
async function loadCSVData() {
    try {
        const response = await fetch(CSV_STUDENTS_URL);
        const text = await response.text();
        const lines = text.split(/\r?\n/);
        if (lines.length < 2) return;
        
        // Detect headers
        const headers = lines[0].split(',').map(h => h.replace(/["']/g, '').trim().toLowerCase());
        const enrolIdx = headers.findIndex(h => h.includes('enrol') || h === 'enrl no');
        const nameIdx = headers.findIndex(h => h === 'name');
        const modeIdx = headers.findIndex(h => h === 'mode');
        
        studentsMap.clear();
        
        // Fast manual parsing (no regex)
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            const values = fastCSVRow(line);
            const enrol = values[enrolIdx]?.trim() || '';
            const name = values[nameIdx]?.trim() || '';
            const mode = values[modeIdx]?.trim() || '';
            if (enrol && name) {
                studentsMap.set(enrol, { name, mode: mode || 'Not Specified' });
            }
        }
        console.log(`📋 ${studentsMap.size} students loaded`);
    } catch (e) {
        console.error("CSV load error:", e);
        showAlert("Could not load student list. Refresh the page.", true);
    }
}

// Ultra‑fast CSV row split (handles quoted commas)
function fastCSVRow(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
            inQuotes = !inQuotes;
        } else if (ch === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
        } else {
            current += ch;
        }
    }
    result.push(current.trim());
    return result;
}

// ============================================
// 📋 LOAD REGISTRATIONS (cached, no UI block)
// ============================================
async function loadRegistrations() {
    try {
        const resp = await fetch(`${APPS_SCRIPT_URL}?action=getAllRegistrations&t=${Date.now()}`);
        const data = await resp.json();
        if (Array.isArray(data)) {
            registrations = data;
        } else if (data.data && Array.isArray(data.data)) {
            registrations = data.data;
        } else {
            registrations = [];
        }
    } catch (e) {
        console.warn("Registrations fetch failed, using last known data");
        // Keep existing registrations
    }
}

// Compute slot usage cache from registrations array
function computeSlotUsage() {
    // Reset cache
    slotUsageCache = {
        "PG Second Year": { "week-1": 0, "week-2": 0, "week-3": 0 },
        "PG First Year":  { "week-1": 0, "week-2": 0, "week-3": 0 }
    };
    for (const reg of registrations) {
        const year = reg.year;
        const week = reg.status;
        if (year && week && slotUsageCache[year] && slotUsageCache[year][week] !== undefined) {
            slotUsageCache[year][week]++;
        }
    }
}

// ============================================
// ⚡ LIGHTNING‑FAST LOOKUP (no awaits, pure sync)
// ============================================
function getYearFromEnrol(enrol) {
    const num = parseInt(enrol);
    if (PG_SECOND_YEAR.includes(num)) return "PG Second Year";
    if (PG_FIRST_YEAR.includes(num)) return "PG First Year";
    return null;
}

function lookupStudent(enrol) {
    const clean = String(enrol).trim();
    if (!clean) {
        resetUI();
        return;
    }
    
    // If data isn't ready yet, store for later
    if (!dataReady) {
        pendingEnrol = clean;
        enrolInput.placeholder = "Loading data...";
        return;
    }
    
    const student = studentsMap.get(clean);
    if (!student) {
        enrolError.textContent = "❌ Enrolment number not found";
        enrolError.classList.remove("hidden");
        resetUI();
        return;
    }
    
    const year = getYearFromEnrol(clean);
    if (!year) {
        enrolError.textContent = "❌ Enrolment number not recognized";
        enrolError.classList.remove("hidden");
        resetUI();
        return;
    }
    
    enrolError.classList.add("hidden");
    
    // Check existing registration (case‑insensitive)
    const existing = registrations.find(r => 
        String(r.enrol).trim().toLowerCase() === clean.toLowerCase()
    );
    
    currentStudent = {
        enrol: clean,
        name: student.name,
        mode: student.mode,
        year: year,
        status: existing?.status || ""
    };
    
    // Populate fields instantly
    studentNameField.value = currentStudent.name;
    modeField.value = currentStudent.mode;
    yearField.value = currentStudent.year;
    
    // Show registration status if any
    if (currentStudent.status) {
        statusContainer.classList.remove("hidden");
        const weekName = WEEK_DISPLAY_NAMES[currentStudent.status] || currentStudent.status;
        statusDisplay.innerHTML = `<span class="status-badge status-submitted"><i class="fas fa-check-circle mr-1"></i> Registered for ${weekName}</span>`;
        submitBtn.disabled = true;
        submitBtn.style.opacity = "0.6";
        submitBtn.style.cursor = "not-allowed";
        selectedWeek = null;
        showAlert(`ℹ️ You have already registered for ${weekName}.`, false);
    } else {
        statusContainer.classList.add("hidden");
        statusDisplay.innerHTML = "";
        submitBtn.disabled = false;
        submitBtn.style.opacity = "1";
        submitBtn.style.cursor = "pointer";
        selectedWeek = null;
    }
    
    renderWeekCards(currentStudent.year);
}

function resetUI() {
    studentNameField.value = '';
    modeField.value = '';
    yearField.value = '';
    currentStudent = null;
    selectedWeek = null;
    statusContainer.classList.add("hidden");
    statusDisplay.innerHTML = "";
    submitBtn.disabled = false;
    submitBtn.style.opacity = "1";
    submitBtn.style.cursor = "pointer";
    renderWeekCards(null);
}

// ============================================
// 🎴 WEEK CARDS – RENDER FROM CACHE (instant)
// ============================================
function isSlotAvailable(week, year) {
    const used = slotUsageCache[year]?.[week] || 0;
    const limit = SLOT_RULES[year]?.[week] || 0;
    return used < limit;
}

function getRemainingSlots(week, year) {
    const used = slotUsageCache[year]?.[week] || 0;
    const limit = SLOT_RULES[year]?.[week] || 0;
    return Math.max(0, limit - used);
}

function renderWeekCards(year) {
    if (!year) {
        weekContainer.innerHTML = `
            <div class="col-span-3 text-center text-gray-400 py-8">
                <i class="fas fa-search text-3xl mb-2"></i>
                <p>Enter your enrolment number to see available weeks</p>
            </div>
        `;
        weekSlotInfo.innerHTML = '';
        return;
    }
    
    let html = '';
    for (const week of WEEKS) {
        const limit = SLOT_RULES[year][week] || 0;
        const used = slotUsageCache[year]?.[week] || 0;
        const available = used < limit;
        const remaining = limit - used;
        const isSelected = (selectedWeek === week);
        const disabled = !available || (currentStudent?.status && currentStudent.status !== "");
        
        const baseClass = 'week-card' + (disabled ? ' disabled' : ' cursor-pointer hover:shadow-md transition-all');
        const selectedClass = isSelected ? ' selected' : '';
        const clickAttr = disabled ? '' : `onclick="selectWeek('${week}')"`;
        
        html += `
            <div class="${baseClass}${selectedClass}" ${clickAttr} data-week="${week}">
                <div class="flex flex-col items-center">
                    <h3 class="font-bold text-gray-800 text-lg mb-2">${WEEK_DISPLAY_NAMES[week]}</h3>
                    <div class="slot-badge ${!available ? 'slot-full' : 'bg-emerald-100 text-emerald-700'}">
                        ${available ? `${remaining} slots left` : 'Full'}
                    </div>
                    <div class="mt-2 text-xs text-gray-500">
                        ${available ? `Available: ${remaining} / ${limit}` : `No slots available`}
                    </div>
                </div>
            </div>
        `;
    }
    weekContainer.innerHTML = html;
    
    // Summary info
    const syW1 = getRemainingSlots("week-1", "PG Second Year");
    const syW2 = getRemainingSlots("week-2", "PG Second Year");
    const syW3 = getRemainingSlots("week-3", "PG Second Year");
    const fyW1 = getRemainingSlots("week-1", "PG First Year");
    const fyW2 = getRemainingSlots("week-2", "PG First Year");
    const fyW3 = getRemainingSlots("week-3", "PG First Year");
    
    weekSlotInfo.innerHTML = `
        <div class="flex flex-wrap gap-3 justify-between w-full">
            <span class="bg-gray-100 px-3 py-1.5 rounded-full text-xs font-medium">
                <i class="fas fa-calendar-week text-emerald-600 mr-1"></i> PG Second Year: 
                W1(${syW1}) | W2(${syW2}) | W3(${syW3})
            </span>
            <span class="bg-gray-100 px-3 py-1.5 rounded-full text-xs font-medium">
                <i class="fas fa-calendar-week text-emerald-600 mr-1"></i> PG First Year: 
                W1(${fyW1}) | W2(${fyW2}) | W3(${fyW3})
            </span>
        </div>
    `;
}

// Global week selector (called from onclick)
window.selectWeek = function(week) {
    if (!currentStudent) {
        showAlert("Please enter a valid enrolment number first");
        return;
    }
    if (currentStudent.status) {
        showAlert(`You have already registered for ${WEEK_DISPLAY_NAMES[currentStudent.status]}.`);
        return;
    }
    if (!isSlotAvailable(week, currentStudent.year)) {
        showAlert(`No available slots for ${WEEK_DISPLAY_NAMES[week]}.`);
        renderWeekCards(currentStudent.year);
        return;
    }
    selectedWeek = week;
    renderWeekCards(currentStudent.year);
    showAlert(`Selected: ${WEEK_DISPLAY_NAMES[week]}`, false);
};

// ============================================
// 📤 SUBMIT REGISTRATION
// ============================================
async function submitRegistration() {
    if (!currentStudent) {
        showAlert("❌ Please enter a valid enrolment number first.");
        return;
    }
    if (currentStudent.status) {
        showAlert(`⚠️ Already registered for ${WEEK_DISPLAY_NAMES[currentStudent.status]}.`);
        return;
    }
    if (!selectedWeek) {
        showAlert("⚠️ Please select a week before submitting.");
        return;
    }
    if (!isSlotAvailable(selectedWeek, currentStudent.year)) {
        showAlert(`❌ No slots left for ${WEEK_DISPLAY_NAMES[selectedWeek]}.`);
        renderWeekCards(currentStudent.year);
        return;
    }
    
    const originalHTML = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<div class="loading-spinner"></div> Submitting...';
    
    try {
        const resp = await fetch(APPS_SCRIPT_URL, {
            method: "POST",
            mode: "cors",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                action: "updateStatus",
                enrolNo: currentStudent.enrol,
                status: selectedWeek,
                year: currentStudent.year,
                name: currentStudent.name,
                mode: currentStudent.mode
            })
        });
        const result = await resp.json();
        
        if (result.success) {
            // Update local state instantly
            currentStudent.status = selectedWeek;
            registrations.push({
                enrol: currentStudent.enrol,
                name: currentStudent.name,
                year: currentStudent.year,
                mode: currentStudent.mode,
                status: selectedWeek,
                submission_date: new Date().toISOString()
            });
            computeSlotUsage(); // refresh cache
            
            showAlert(`✅ Success! Registered for ${WEEK_DISPLAY_NAMES[selectedWeek]}.`, false);
            statusContainer.classList.remove("hidden");
            statusDisplay.innerHTML = `<span class="status-badge status-submitted"><i class="fas fa-check-circle mr-1"></i> Registered for ${WEEK_DISPLAY_NAMES[selectedWeek]}</span>`;
            renderWeekCards(currentStudent.year);
            submitBtn.disabled = true;
            submitBtn.style.opacity = "0.6";
            submitBtn.style.cursor = "not-allowed";
        } else {
            showAlert(`❌ Registration failed: ${result.error || "Unknown error"}`);
            await loadRegistrations();
            computeSlotUsage();
            renderWeekCards(currentStudent.year);
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalHTML;
            submitBtn.style.opacity = "1";
        }
    } catch (e) {
        console.error(e);
        showAlert("Network error. Please try again.");
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalHTML;
        submitBtn.style.opacity = "1";
    }
}

// ============================================
// 🔔 ALERT POPUP
// ============================================
function showAlert(msg, isError = true) {
    alertPopup.textContent = msg;
    alertPopup.style.background = isError ? "#dc2626" : "#059669";
    alertPopup.classList.add('show');
    setTimeout(() => alertPopup.classList.remove('show'), 3000);
}

// ============================================
// 🎧 EVENT LISTENERS (smart debounce)
// ============================================
let debounceTimer;
enrolInput.addEventListener('input', (e) => {
    const val = e.target.value.trim();
    clearTimeout(debounceTimer);
    // Use a tiny debounce (60ms) to avoid jank while still feeling instant
    debounceTimer = setTimeout(() => {
        // Use requestIdleCallback for non‑blocking UI updates
        if (window.requestIdleCallback) {
            requestIdleCallback(() => lookupStudent(val));
        } else {
            lookupStudent(val);
        }
    }, 60);
});

submitBtn.addEventListener('click', submitRegistration);

// ============================================
// 🛡️ DISABLE DEVTOOLS (optional)
// ============================================
document.addEventListener("contextmenu", e => e.preventDefault());
document.addEventListener("keydown", e => {
    if (e.key === "F12" || 
        (e.ctrlKey && e.shiftKey && (e.key === "I" || e.key === "J" || e.key === "C")) ||
        (e.ctrlKey && (e.key === "u" || e.key === "U"))) {
        e.preventDefault();
    }
});

console.log('%c⚡ PG Quota Portal – Ultra Fast Edition ⚡', 'color: #059669; font-size: 16px; font-weight: bold;');
