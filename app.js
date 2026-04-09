// ============================================
// PG WORKSHOP REGISTRATION PORTAL
// Frontend JavaScript (app.js) - Optimized Fast Loading
// ============================================

// Configuration
// IMPORTANT: Replace with your actual Google Apps Script Web App URL
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyuEj2pySImGcHQvlcmW4tHxoUgZR7vU2uQEhxpUaT3EvenqARuO7wsxoFqweIqjC5b/exec";

// CSV URL for student data (name, mode)
const CSV_STUDENTS_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQoxIRr-axYhnWISr0bVPaTIhZK-aoBv3KZQZCdCJDlrCtgbFfw0F29IyxV6pyMIQRjb9UmRIPrOZRw/pub?gid=0&single=true&output=csv";

// Slot limits based on year
const SLOT_RULES = {
    "PG Second Year": {
        "week-1": 14,
        "week-2": 15,
        "week-3": 15
    },
    "PG First Year": {
        "week-1": 11,
        "week-2": 12,
        "week-3": 12
    }
};

const WEEKS = ["week-1", "week-2", "week-3"];
const WEEK_DISPLAY_NAMES = {
    "week-1": "Week 1",
    "week-2": "Week 2",
    "week-3": "Week 3"
};

// PG Second Year students list
const PG_SECOND_YEAR = [16074, 16075, 16077, 16078, 16082, 16110, 16122, 16128, 16138, 16146, 16148, 16150, 16156, 16158, 16160, 16172, 16176, 16178, 16179, 16185, 16187, 16194, 16207, 16215, 16219, 16222, 16227, 16232, 16234, 16245, 16248, 16262, 16271, 16273, 16274, 16279, 16297, 16300, 16308, 16334, 16382, 16383, 16552, 16612];

// PG First Year students list
const PG_FIRST_YEAR = [16620, 16622, 16628, 16635, 16648, 16649, 16651, 16663, 16666, 16668, 16678, 16683, 16691, 16696, 16701, 16709, 16715, 16739, 16751, 16770, 16784, 16798, 16807, 16821, 16823, 16835, 16846, 16855, 16875, 16889, 16960, 17028, 17047, 17106, 17195];

// Global state
let studentsDataFromCSV = new Map();  // Fast lookup: enrol -> { name, mode }
let registrationsData = [];            // registration data from sheet
let currentStudent = null;            // selected student object
let selectedWeek = null;              // week chosen by user
let csvLoaded = false;                // flag for CSV load status

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

// ============================================
// 🚀 OPTIMIZED INITIALIZATION (Parallel Loading)
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
    // Show loading indicator while fetching
    enrolInput.placeholder = "Loading data...";
    enrolInput.disabled = true;
    
    // Load CSV and registrations in PARALLEL for maximum speed
    await Promise.all([
        loadCSVDataFast(),
        loadRegistrationsData()
    ]);
    
    // Enable input after data loads
    enrolInput.disabled = false;
    enrolInput.placeholder = "Enter your enrolment number";
    
    setupEventListeners();
    resetStudentUI();
    
    console.log('✅ Portal ready - CSV and registrations loaded');
});

function setupEventListeners() {
    let debounceTimeout;
    enrolInput.addEventListener('input', (e) => {
        clearTimeout(debounceTimeout);
        const val = e.target.value.trim();
        debounceTimeout = setTimeout(() => {
            if (val.length > 0) {
                lookupStudentFast(val);
            } else {
                resetStudentUI();
            }
        }, 200); // Reduced from 400ms for faster response
    });
    
    submitBtn.addEventListener('click', submitRegistration);
}

// ============================================
// 📥 FAST CSV LOADING (Optimized)
// ============================================

async function loadCSVDataFast() {
    try {
        const response = await fetch(CSV_STUDENTS_URL);
        const csvText = await response.text();
        
        // Parse CSV efficiently
        const lines = csvText.split(/\r?\n/);
        if (lines.length < 2) return;
        
        // Parse header row
        const headers = lines[0].split(',').map(h => h.replace(/["']/g, '').trim().toLowerCase());
        const enrolIdx = headers.findIndex(h => h.includes('enrol') || h === 'enrl no');
        const nameIdx = headers.findIndex(h => h === 'name');
        const modeIdx = headers.findIndex(h => h === 'mode');
        
        // Clear and use Map for O(1) lookups
        studentsDataFromCSV.clear();
        
        // Fast parsing loop - skip empty lines
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            
            const values = fastCSVParse(line);
            
            const enrolNo = values[enrolIdx]?.trim() || '';
            const name = values[nameIdx]?.trim() || '';
            const mode = values[modeIdx]?.trim() || '';
            
            if (enrolNo && name) {
                studentsDataFromCSV.set(String(enrolNo).trim(), {
                    name: name,
                    mode: mode || 'Not Specified'
                });
            }
        }
        
        csvLoaded = true;
        console.log(`⚡ Fast-loaded ${studentsDataFromCSV.size} students from CSV (Map storage)`);
        
    } catch (err) {
        console.error("CSV fetch error:", err);
        showAlert("Failed to load student data. Please refresh.", true);
        csvLoaded = false;
    }
}

// Optimized CSV row parsing (faster than regex)
function fastCSVParse(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current.trim());
    return result;
}

// ============================================
// 📥 LOAD REGISTRATIONS (With Cache Buster)
// ============================================

async function loadRegistrationsData() {
    try {
        const response = await fetch(`${APPS_SCRIPT_URL}?action=getAllRegistrations&t=${Date.now()}`);
        const data = await response.json();
        
        if (data.error) {
            console.error("Error loading registrations:", data.error);
            registrationsData = [];
            return;
        }
        
        if (Array.isArray(data)) {
            registrationsData = data;
        } else if (data.data && Array.isArray(data.data)) {
            registrationsData = data.data;
        } else {
            registrationsData = [];
        }
        
        console.log(`📋 Loaded ${registrationsData.length} registrations`);
    } catch (err) {
        console.error("Fetch error:", err);
        registrationsData = [];
    }
}

// ============================================
// 🔍 FAST STUDENT LOOKUP & YEAR DETECTION
// ============================================

function getYearFromEnrol(enrol) {
    const enrolNum = parseInt(enrol);
    if (PG_SECOND_YEAR.includes(enrolNum)) {
        return "PG Second Year";
    } else if (PG_FIRST_YEAR.includes(enrolNum)) {
        return "PG First Year";
    }
    return null;
}

async function lookupStudentFast(enrol) {
    if (!enrol || enrol.trim() === "") {
        resetStudentUI();
        return false;
    }
    
    const cleanEnrol = String(enrol).trim();
    
    // Fast O(1) lookup from Map
    const csvStudent = studentsDataFromCSV.get(cleanEnrol);
    
    if (!csvStudent) {
        enrolError.textContent = "❌ Enrolment number not found in registry";
        enrolError.classList.remove("hidden");
        resetStudentUI();
        currentStudent = null;
        selectedWeek = null;
        renderWeekCards(null);
        return false;
    }
    
    enrolError.classList.add("hidden");
    
    // Determine year
    const year = getYearFromEnrol(enrol);
    if (!year) {
        enrolError.textContent = "❌ Enrolment number not recognized for year classification";
        enrolError.classList.remove("hidden");
        resetStudentUI();
        return false;
    }
    
    // Refresh registrations data to ensure up-to-date slot info
    await loadRegistrationsData();
    
    // Find existing registration (case-insensitive comparison)
    const existingRegistration = registrationsData.find(r => 
        String(r.enrol).trim().toLowerCase() === cleanEnrol.toLowerCase()
    );
    
    currentStudent = {
        enrol: cleanEnrol,
        name: csvStudent.name,
        mode: csvStudent.mode,
        year: year,
        status: existingRegistration?.status || ""
    };
    
    // Fast UI updates
    studentNameField.value = currentStudent.name;
    modeField.value = currentStudent.mode;
    yearField.value = currentStudent.year;
    
    // Show status if already registered
    if (currentStudent.status && currentStudent.status !== "") {
        statusContainer.classList.remove("hidden");
        const statusText = WEEK_DISPLAY_NAMES[currentStudent.status] || currentStudent.status;
        statusDisplay.innerHTML = `<span class="status-badge status-submitted"><i class="fas fa-check-circle mr-1"></i> Registered for ${statusText}</span>`;
        selectedWeek = null;
        submitBtn.disabled = true;
        submitBtn.style.opacity = "0.6";
        submitBtn.style.cursor = "not-allowed";
        showAlert(`ℹ️ You have already registered for ${statusText}. Registration cannot be changed.`, false);
    } else {
        statusContainer.classList.add("hidden");
        statusDisplay.innerHTML = "";
        selectedWeek = null;
        submitBtn.disabled = false;
        submitBtn.style.opacity = "1";
        submitBtn.style.cursor = "pointer";
    }
    
    renderWeekCards(currentStudent.year);
    return true;
}

function resetStudentUI() {
    studentNameField.value = '';
    modeField.value = '';
    yearField.value = '';
    currentStudent = null;
    selectedWeek = null;
    statusContainer.classList.add("hidden");
    statusDisplay.innerHTML = "";
    renderWeekCards(null);
    submitBtn.disabled = false;
    submitBtn.style.opacity = "1";
    submitBtn.style.cursor = "pointer";
}

// ============================================
// 🎨 RENDER WEEK CARDS & SLOT MANAGEMENT
// ============================================

function getSlotUsage() {
    const usage = {
        "PG Second Year": { "week-1": 0, "week-2": 0, "week-3": 0 },
        "PG First Year": { "week-1": 0, "week-2": 0, "week-3": 0 }
    };
    
    registrationsData.forEach(registration => {
        if (registration.status && registration.status !== "" && registration.year) {
            const week = registration.status;
            if (usage[registration.year] && usage[registration.year][week] !== undefined) {
                usage[registration.year][week]++;
            }
        }
    });
    
    return usage;
}

function isSlotAvailable(week, year) {
    const usage = getSlotUsage();
    const limit = SLOT_RULES[year]?.[week] || 0;
    const current = usage[year]?.[week] || 0;
    return current < limit;
}

function getRemainingSlots(week, year) {
    const usage = getSlotUsage();
    const limit = SLOT_RULES[year]?.[week] || 0;
    const current = usage[year]?.[week] || 0;
    return Math.max(0, limit - current);
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
    
    const usage = getSlotUsage();
    let cardsHtml = '';
    
    WEEKS.forEach(week => {
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
            clickHandler = `onclick="selectWeek('${week}')"`;
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
    });
    
    weekContainer.innerHTML = cardsHtml;
    
    // Update slot info summary
    const secondYearW1Remaining = getRemainingSlots("week-1", "PG Second Year");
    const secondYearW2Remaining = getRemainingSlots("week-2", "PG Second Year");
    const secondYearW3Remaining = getRemainingSlots("week-3", "PG Second Year");
    const firstYearW1Remaining = getRemainingSlots("week-1", "PG First Year");
    const firstYearW2Remaining = getRemainingSlots("week-2", "PG First Year");
    const firstYearW3Remaining = getRemainingSlots("week-3", "PG First Year");
    
    weekSlotInfo.innerHTML = `
        <div class="flex flex-wrap gap-3 justify-between w-full">
            <span class="bg-gray-100 px-3 py-1.5 rounded-full text-xs font-medium">
                <i class="fas fa-calendar-week text-emerald-600 mr-1"></i> PG Second Year: 
                W1(${secondYearW1Remaining}) | W2(${secondYearW2Remaining}) | W3(${secondYearW3Remaining})
            </span>
            <span class="bg-gray-100 px-3 py-1.5 rounded-full text-xs font-medium">
                <i class="fas fa-calendar-week text-emerald-600 mr-1"></i> PG First Year: 
                W1(${firstYearW1Remaining}) | W2(${firstYearW2Remaining}) | W3(${firstYearW3Remaining})
            </span>
        </div>
    `;
}

// Global function for week selection
window.selectWeek = function(week) {
    if (!currentStudent) {
        showAlert("Please enter a valid enrolment number first");
        return;
    }
    
    if (currentStudent.status && currentStudent.status !== "") {
        showAlert(`You have already registered for ${WEEK_DISPLAY_NAMES[currentStudent.status]}. Registration cannot be changed.`);
        return;
    }
    
    if (!isSlotAvailable(week, currentStudent.year)) {
        showAlert(`No available slots for ${WEEK_DISPLAY_NAMES[week]}. This week is full.`);
        renderWeekCards(currentStudent.year);
        return;
    }
    
    selectedWeek = week;
    renderWeekCards(currentStudent.year);
    showAlert(`Selected: ${WEEK_DISPLAY_NAMES[week]}`, false);
};

// ============================================
// 📤 SUBMIT REGISTRATION TO GOOGLE SHEET
// ============================================

async function submitRegistration() {
    if (!currentStudent) {
        showAlert("❌ Please enter a valid enrolment number first.");
        return;
    }
    
    if (currentStudent.status && currentStudent.status !== "") {
        showAlert(`⚠️ You have already registered for ${WEEK_DISPLAY_NAMES[currentStudent.status]}. Registration cannot be changed.`);
        return;
    }
    
    if (!selectedWeek) {
        showAlert("⚠️ Please select a week before submitting.");
        return;
    }
    
    // Double-check slot availability
    if (!isSlotAvailable(selectedWeek, currentStudent.year)) {
        showAlert(`❌ No available slots for ${WEEK_DISPLAY_NAMES[selectedWeek]}. Slots are full.`);
        renderWeekCards(currentStudent.year);
        return;
    }
    
    // Show loading state
    const originalBtnHtml = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<div class="loading-spinner"></div> Submitting...';
    
    try {
        const response = await fetch(APPS_SCRIPT_URL, {
            method: "POST",
            mode: "cors",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded"
            },
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
            // Update local state
            currentStudent.status = selectedWeek;
            
            // Update registrationsData
            const existingIndex = registrationsData.findIndex(r => r.enrol === currentStudent.enrol);
            if (existingIndex !== -1) {
                registrationsData[existingIndex].status = selectedWeek;
            } else {
                registrationsData.push({
                    enrol: currentStudent.enrol,
                    name: currentStudent.name,
                    year: currentStudent.year,
                    mode: currentStudent.mode,
                    status: selectedWeek,
                    submission_date: new Date().toISOString()
                });
            }
            
            showAlert(`✅ Success! You have registered for ${WEEK_DISPLAY_NAMES[selectedWeek]}.`, false);
            
            // Update UI
            statusContainer.classList.remove("hidden");
            statusDisplay.innerHTML = `<span class="status-badge status-submitted"><i class="fas fa-check-circle mr-1"></i> Registered for ${WEEK_DISPLAY_NAMES[selectedWeek]}</span>`;
            renderWeekCards(currentStudent.year);
            submitBtn.disabled = true;
            submitBtn.style.opacity = "0.6";
            submitBtn.style.cursor = "not-allowed";
            
        } else {
            showAlert(`❌ Registration failed: ${result.error || "Unknown error"}`);
            await loadRegistrationsData();
            renderWeekCards(currentStudent.year);
        }
        
    } catch (error) {
        console.error("Submit error:", error);
        showAlert("Network error: Could not register. Please try again later.");
    } finally {
        if (!currentStudent?.status) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnHtml;
        }
    }
}

// ============================================
// 🔔 UI HELPERS
// ============================================

function showAlert(message, isError = true) {
    alertPopup.textContent = message;
    alertPopup.style.background = isError ? "#dc2626" : "#059669";
    alertPopup.classList.add('show');
    setTimeout(() => {
        alertPopup.classList.remove('show');
    }, 3000);
}

// ============================================
// 🔒 SECURITY (Optional)
// ============================================

// Disable right-click
document.addEventListener("contextmenu", function(e) {
    e.preventDefault();
});

// Disable inspect shortcuts
document.addEventListener("keydown", function(e) {
    if (e.key === "F12" || 
        (e.ctrlKey && e.shiftKey && (e.key === "I" || e.key === "J" || e.key === "C")) ||
        (e.ctrlKey && (e.key === "u" || e.key === "U"))) {
        e.preventDefault();
    }
});

console.log('%c⚡ PG Workshop Registration Portal - Fast Load Edition ⚡', 'color: #059669; font-size: 16px; font-weight: bold;');
