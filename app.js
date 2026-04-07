// ============================================
// PG WORKSHOP REGISTRATION PORTAL - ULTRA FAST
// Zero lag, aggressive caching, parallel loading
// ============================================

// Configuration
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyuEj2pySImGcHQvlcmW4tHxoUgZR7vU2uQEhxpUaT3EvenqARuO7wsxoFqweIqjC5b/exec";
const CSV_STUDENTS_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQoxIRr-axYhnWISr0bVPaTIhZK-aoBv3KZQZCdCJDlrCtgbFfw0F29IyxV6pyMIQRjb9UmRIPrOZRw/pub?gid=0&single=true&output=csv";

// Slot limits based on year
const SLOT_RULES = {
    "PG Second Year": { "week-1": 14, "week-2": 15, "week-3": 15 },
    "PG First Year": { "week-1": 11, "week-2": 12, "week-3": 12 }
};

const WEEKS = ["week-1", "week-2", "week-3"];
const WEEK_DISPLAY_NAMES = { "week-1": "Week 1", "week-2": "Week 2", "week-3": "Week 3" };

// Student lists (fast inline for O(1) lookup)
const PG_SECOND_YEAR_SET = new Set([16074,16075,16077,16078,16082,16110,16122,16128,16138,16146,16148,16150,16156,16158,16160,16172,16176,16178,16179,16185,16187,16194,16207,16215,16219,16222,16227,16232,16234,16245,16248,16262,16271,16273,16274,16279,16297,16300,16308,16334,16382,16383,16552,16612]);
const PG_FIRST_YEAR_SET = new Set([16620,16622,16628,16635,16648,16649,16651,16663,16666,16668,16678,16683,16691,16696,16701,16709,16715,16739,16751,16770,16784,16798,16807,16821,16823,16835,16846,16855,16875,16889,16960,17028,17047,17106,17195]);

// ---------- CACHE SYSTEM (eliminates redundant network calls) ----------
let cache = {
    studentsMap: null,          // Map enrol -> {name, mode}
    registrations: null,        // { data: [], timestamp, slotUsage }
    lastRegFetch: 0,
    lastCsvFetch: 0
};

const CACHE_TTL = 30000; // 30 seconds cache for registrations (fast enough, but reduces lag)
const CSV_CACHE_TTL = 60000; // 1 min for student data (rarely changes)

// DOM Elements
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

// Global state
let currentStudent = null;
let selectedWeek = null;
let isSubmitting = false;

// ============================================
// 🚀 INIT - LOAD EVERYTHING IN PARALLEL
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
    // Show skeleton loading state
    showSkeletonCards();
    
    // Load both CSV and registrations in parallel (fastest possible)
    await Promise.all([
        loadCSVDataFast(),
        loadRegistrationsFast()
    ]);
    
    setupEventListeners();
    resetStudentUI(); // will show proper week cards if any student pre-filled? no enrol yet.
    hideSkeletonCards();
});

function showSkeletonCards() {
    weekContainer.innerHTML = `
        <div class="skeleton-card"></div>
        <div class="skeleton-card"></div>
        <div class="skeleton-card"></div>
    `;
}

function hideSkeletonCards() {
    if (currentStudent?.year) {
        renderWeekCardsInstant(currentStudent.year);
    } else if (!currentStudent) {
        weekContainer.innerHTML = `
            <div class="col-span-3 text-center text-gray-400 py-8">
                <i class="fas fa-search text-3xl mb-2"></i>
                <p>Enter your enrolment number to see available weeks</p>
            </div>
        `;
        weekSlotInfo.innerHTML = '';
    }
}

// ============================================
// 📥 FAST CACHED CSV LOADER (Indexed Map)
// ============================================
async function loadCSVDataFast() {
    const now = Date.now();
    if (cache.studentsMap && (now - cache.lastCsvFetch) < CSV_CACHE_TTL) {
        console.log("📦 Using cached student data");
        return;
    }
    
    try {
        const response = await fetch(CSV_STUDENTS_URL + "?t=" + now);
        const csvText = await response.text();
        const rows = csvText.split(/\r?\n/).filter(row => row.trim().length > 0);
        if (rows.length < 2) return;
        
        const headers = rows[0].split(',').map(h => h.replace(/["']/g, '').trim().toLowerCase());
        const enrolIdx = headers.findIndex(h => h.includes('enrol') || h === 'enrl no');
        const nameIdx = headers.findIndex(h => h === 'name');
        const modeIdx = headers.findIndex(h => h === 'mode');
        
        const studentsMap = new Map(); // O(1) lookups
        
        for (let i = 1; i < rows.length; i++) {
            const values = parseCSVRowFast(rows[i]);
            const enrolNo = values[enrolIdx] ? values[enrolIdx].trim() : '';
            const name = values[nameIdx] ? values[nameIdx].trim() : '';
            const mode = values[modeIdx] ? values[modeIdx].trim() : '';
            if (enrolNo && name) {
                studentsMap.set(String(enrolNo).trim(), { name, mode: mode || 'Not Specified' });
            }
        }
        
        cache.studentsMap = studentsMap;
        cache.lastCsvFetch = now;
        console.log(`✅ Loaded ${studentsMap.size} students into Map (fast lookup)`);
    } catch (err) {
        console.error("CSV load error:", err);
        if (!cache.studentsMap) showAlert("Failed to load student data. Refresh page.", true);
    }
}

// Ultra-fast CSV row parser (avoids regex overhead)
function parseCSVRowFast(rowStr) {
    const result = [];
    let inQuote = false;
    let current = '';
    for (let i = 0; i < rowStr.length; i++) {
        const ch = rowStr[i];
        if (ch === '"') {
            inQuote = !inQuote;
        } else if (ch === ',' && !inQuote) {
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
// 📥 FAST REGISTRATIONS + SLOT USAGE CACHE
// ============================================
async function loadRegistrationsFast(forceRefresh = false) {
    const now = Date.now();
    if (!forceRefresh && cache.registrations && (now - cache.lastRegFetch) < CACHE_TTL) {
        console.log("📦 Using cached registrations");
        return cache.registrations;
    }
    
    try {
        const response = await fetch(`${APPS_SCRIPT_URL}?action=getAllRegistrations&t=${now}`);
        const data = await response.json();
        
        let registrationsArray = [];
        if (Array.isArray(data)) registrationsArray = data;
        else if (data.data && Array.isArray(data.data)) registrationsArray = data.data;
        else registrationsArray = [];
        
        // Precompute slot usage for instant availability checks
        const slotUsage = {
            "PG Second Year": { "week-1": 0, "week-2": 0, "week-3": 0 },
            "PG First Year": { "week-1": 0, "week-2": 0, "week-3": 0 }
        };
        
        for (const reg of registrationsArray) {
            if (reg.status && reg.status !== "" && reg.year) {
                const year = reg.year;
                const week = reg.status;
                if (slotUsage[year] && slotUsage[year][week] !== undefined) {
                    slotUsage[year][week]++;
                }
            }
        }
        
        cache.registrations = { data: registrationsArray, slotUsage };
        cache.lastRegFetch = now;
        console.log(`✅ Loaded ${registrationsArray.length} registrations, slot usage computed`);
        return cache.registrations;
    } catch (err) {
        console.error("Reg fetch error:", err);
        if (!cache.registrations) cache.registrations = { data: [], slotUsage: null };
        return cache.registrations;
    }
}

// ============================================
// ⚡ INSTANT YEAR DETECTION (Set O(1))
// ============================================
function getYearFromEnrolFast(enrolNum) {
    const num = parseInt(enrolNum, 10);
    if (PG_SECOND_YEAR_SET.has(num)) return "PG Second Year";
    if (PG_FIRST_YEAR_SET.has(num)) return "PG First Year";
    return null;
}

// ============================================
// 🔍 STUDENT LOOKUP (ZERO LAG, NO REDUNDANT FETCH)
// ============================================
let lastLookupEnrol = "";
async function lookupStudent(enrol) {
    if (!enrol || enrol.trim() === "") {
        resetStudentUI();
        return false;
    }
    
    const trimmedEnrol = String(enrol).trim();
    if (lastLookupEnrol === trimmedEnrol && currentStudent && currentStudent.enrol === trimmedEnrol) {
        // Already loaded same student, just re-render if needed
        if (currentStudent.status) renderWeekCardsInstant(currentStudent.year);
        return true;
    }
    lastLookupEnrol = trimmedEnrol;
    
    // Ensure data is loaded (should already be from init, but just in case)
    if (!cache.studentsMap) await loadCSVDataFast();
    if (!cache.registrations) await loadRegistrationsFast();
    
    const studentInfo = cache.studentsMap.get(trimmedEnrol);
    if (!studentInfo) {
        enrolError.textContent = "❌ Enrolment number not found in registry";
        enrolError.classList.remove("hidden");
        resetStudentUI();
        currentStudent = null;
        selectedWeek = null;
        renderEmptyWeekMessage();
        return false;
    }
    enrolError.classList.add("hidden");
    
    const year = getYearFromEnrolFast(trimmedEnrol);
    if (!year) {
        enrolError.textContent = "❌ Enrolment number not recognized for year classification";
        enrolError.classList.remove("hidden");
        resetStudentUI();
        return false;
    }
    
    // Find existing registration from cache
    const existingReg = cache.registrations.data.find(r => String(r.enrol).trim() === trimmedEnrol);
    const status = existingReg?.status || "";
    
    currentStudent = {
        enrol: trimmedEnrol,
        name: studentInfo.name,
        mode: studentInfo.mode,
        year: year,
        status: status
    };
    
    // Update form fields instantly
    studentNameField.value = currentStudent.name;
    modeField.value = currentStudent.mode;
    yearField.value = currentStudent.year;
    
    if (currentStudent.status && currentStudent.status !== "") {
        statusContainer.classList.remove("hidden");
        const statusText = WEEK_DISPLAY_NAMES[currentStudent.status] || currentStudent.status;
        statusDisplay.innerHTML = `<span class="status-badge status-submitted"><i class="fas fa-check-circle mr-1"></i> Registered for ${statusText}</span>`;
        submitBtn.disabled = true;
        submitBtn.style.opacity = "0.6";
        submitBtn.style.cursor = "not-allowed";
        selectedWeek = null;
        showAlert(`ℹ️ Already registered for ${statusText}. Cannot change.`, false);
    } else {
        statusContainer.classList.add("hidden");
        submitBtn.disabled = false;
        submitBtn.style.opacity = "1";
        submitBtn.style.cursor = "pointer";
        selectedWeek = null;
    }
    
    // Render week cards instantly using cached slot usage
    renderWeekCardsInstant(currentStudent.year);
    return true;
}

function resetStudentUI() {
    studentNameField.value = '';
    modeField.value = '';
    yearField.value = '';
    currentStudent = null;
    selectedWeek = null;
    statusContainer.classList.add("hidden");
    submitBtn.disabled = false;
    submitBtn.style.opacity = "1";
    submitBtn.style.cursor = "pointer";
    renderEmptyWeekMessage();
}

function renderEmptyWeekMessage() {
    weekContainer.innerHTML = `
        <div class="col-span-3 text-center text-gray-400 py-8">
            <i class="fas fa-search text-3xl mb-2"></i>
            <p>Enter your enrolment number to see available weeks</p>
        </div>
    `;
    weekSlotInfo.innerHTML = '';
}

// ============================================
// 🎨 INSTANT RENDER (NO RECALCULATION LAG)
// ============================================
function getSlotUsageCached() {
    return cache.registrations?.slotUsage || {
        "PG Second Year": { "week-1": 0, "week-2": 0, "week-3": 0 },
        "PG First Year": { "week-1": 0, "week-2": 0, "week-3": 0 }
    };
}

function isSlotAvailableFast(week, year) {
    const usage = getSlotUsageCached();
    const limit = SLOT_RULES[year]?.[week] || 0;
    const current = usage[year]?.[week] || 0;
    return current < limit;
}

function getRemainingSlotsFast(week, year) {
    const usage = getSlotUsageCached();
    const limit = SLOT_RULES[year]?.[week] || 0;
    const current = usage[year]?.[week] || 0;
    return Math.max(0, limit - current);
}

function renderWeekCardsInstant(year) {
    if (!year) {
        renderEmptyWeekMessage();
        return;
    }
    
    const usage = getSlotUsageCached();
    let cardsHtml = '';
    
    for (const week of WEEKS) {
        const limit = SLOT_RULES[year]?.[week] || 0;
        const current = usage[year]?.[week] || 0;
        const available = current < limit;
        const remaining = limit - current;
        const isSelected = (selectedWeek === week);
        const isAlreadyRegistered = currentStudent?.status && currentStudent.status !== "";
        
        let disabledClass = '';
        let clickHandler = '';
        
        if (!available || isAlreadyRegistered) {
            disabledClass = 'week-card disabled';
            clickHandler = '';
        } else {
            disabledClass = 'week-card cursor-pointer hover:shadow-md transition-all';
            clickHandler = `onclick="selectWeekFast('${week}')"`;
        }
        
        const selectedClass = isSelected ? 'selected' : '';
        
        cardsHtml += `
            <div class="${disabledClass} ${selectedClass}" ${clickHandler} data-week="${week}">
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
    
    weekContainer.innerHTML = cardsHtml;
    
    // Update summary badges instantly
    const secW1 = getRemainingSlotsFast("week-1", "PG Second Year");
    const secW2 = getRemainingSlotsFast("week-2", "PG Second Year");
    const secW3 = getRemainingSlotsFast("week-3", "PG Second Year");
    const frW1 = getRemainingSlotsFast("week-1", "PG First Year");
    const frW2 = getRemainingSlotsFast("week-2", "PG First Year");
    const frW3 = getRemainingSlotsFast("week-3", "PG First Year");
    
    weekSlotInfo.innerHTML = `
        <div class="flex flex-wrap gap-3 justify-between w-full">
            <span class="bg-gray-100 px-3 py-1.5 rounded-full text-xs font-medium">
                <i class="fas fa-calendar-week text-emerald-600 mr-1"></i> PG Second Year: 
                W1(${secW1}) | W2(${secW2}) | W3(${secW3})
            </span>
            <span class="bg-gray-100 px-3 py-1.5 rounded-full text-xs font-medium">
                <i class="fas fa-calendar-week text-emerald-600 mr-1"></i> PG First Year: 
                W1(${frW1}) | W2(${frW2}) | W3(${frW3})
            </span>
        </div>
    `;
}

// Global fast week selector
window.selectWeekFast = function(week) {
    if (!currentStudent) {
        showAlert("Please enter a valid enrolment number first");
        return;
    }
    if (currentStudent.status && currentStudent.status !== "") {
        showAlert(`Already registered for ${WEEK_DISPLAY_NAMES[currentStudent.status]}.`);
        return;
    }
    if (!isSlotAvailableFast(week, currentStudent.year)) {
        showAlert(`No available slots for ${WEEK_DISPLAY_NAMES[week]}. This week is full.`);
        renderWeekCardsInstant(currentStudent.year);
        return;
    }
    selectedWeek = week;
    renderWeekCardsInstant(currentStudent.year);
    showAlert(`✓ Selected: ${WEEK_DISPLAY_NAMES[week]}`, false);
};

// ============================================
// 📤 SUBMIT (WITH OPTIMISTIC UI & REFRESH)
// ============================================
async function submitRegistration() {
    if (isSubmitting) return;
    if (!currentStudent) {
        showAlert("❌ Please enter a valid enrolment number.");
        return;
    }
    if (currentStudent.status && currentStudent.status !== "") {
        showAlert(`⚠️ Already registered for ${WEEK_DISPLAY_NAMES[currentStudent.status]}.`);
        return;
    }
    if (!selectedWeek) {
        showAlert("⚠️ Please select a week before submitting.");
        return;
    }
    if (!isSlotAvailableFast(selectedWeek, currentStudent.year)) {
        showAlert(`❌ Slots full for ${WEEK_DISPLAY_NAMES[selectedWeek]}.`);
        await loadRegistrationsFast(true); // force refresh slot usage
        renderWeekCardsInstant(currentStudent.year);
        return;
    }
    
    isSubmitting = true;
    const originalHtml = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<div class="loading-spinner"></div> Submitting...';
    
    try {
        const response = await fetch(APPS_SCRIPT_URL, {
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
        
        const result = await response.json();
        
        if (result.success) {
            // Force refresh registrations cache to get latest counts
            await loadRegistrationsFast(true);
            
            // Update current student status
            currentStudent.status = selectedWeek;
            
            // Update UI instantly
            statusContainer.classList.remove("hidden");
            const statusText = WEEK_DISPLAY_NAMES[selectedWeek];
            statusDisplay.innerHTML = `<span class="status-badge status-submitted"><i class="fas fa-check-circle mr-1"></i> Registered for ${statusText}</span>`;
            submitBtn.disabled = true;
            submitBtn.style.opacity = "0.6";
            submitBtn.style.cursor = "not-allowed";
            renderWeekCardsInstant(currentStudent.year);
            showAlert(`✅ Success! Registered for ${statusText}.`, false);
            selectedWeek = null;
        } else {
            showAlert(`❌ Registration failed: ${result.error || "Unknown error"}`);
            await loadRegistrationsFast(true);
            renderWeekCardsInstant(currentStudent.year);
        }
    } catch (error) {
        console.error("Submit error:", error);
        showAlert("Network error: Could not register. Please try again.");
    } finally {
        isSubmitting = false;
        if (!currentStudent?.status) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalHtml;
        }
    }
}

// ============================================
// 🔔 EVENT LISTENERS (DEBOUNCED FOR SMOOTH TYPING)
// ============================================
let debounceTimer;
function setupEventListeners() {
    enrolInput.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        const val = e.target.value.trim();
        debounceTimer = setTimeout(() => {
            if (val.length > 0) lookupStudent(val);
            else resetStudentUI();
        }, 200); // 200ms debounce for smooth feel
    });
    
    submitBtn.addEventListener('click', submitRegistration);
}

function showAlert(message, isError = true) {
    alertPopup.textContent = message;
    alertPopup.style.background = isError ? "#dc2626" : "#059669";
    alertPopup.classList.add('show');
    setTimeout(() => alertPopup.classList.remove('show'), 2800);
}

// ============================================
// 🛡️ LIGHT SECURITY (prevents basic inspect)
// ============================================
document.addEventListener("contextmenu", (e) => e.preventDefault());
document.addEventListener("keydown", (e) => {
    if (e.key === "F12" || (e.ctrlKey && e.shiftKey && (e.key === "I" || e.key === "J" || e.key === "C")) || (e.ctrlKey && (e.key === "u" || e.key === "U"))) {
        e.preventDefault();
    }
});

console.log('⚡ PG Workshop Portal - ULTRA FAST MODE ACTIVE ⚡');
