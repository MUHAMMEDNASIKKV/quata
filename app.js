// ============================================
// PG WORKSHOP REGISTRATION PORTAL
// Frontend JavaScript (app.js)
// ============================================

// Configuration
// IMPORTANT: Replace with your actual Google Apps Script Web App URL
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwyTtKzqbiOQ3XYXP1nux_bn51O5mr-p_96pGko8e0kjHiKvJAAe6nzwjbzT_YKsGC3/exec";

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
let studentsData = [];        // array of objects { enrol, name, year, status }
let currentStudent = null;    // selected student object after enrolment lookup
let selectedWeek = null;       // week chosen by user
let isLoading = false;

// DOM Elements
const enrolInput = document.getElementById('enrolNo');
const studentNameField = document.getElementById('studentName');
const yearField = document.getElementById('yearField');
const weekContainer = document.getElementById('weekContainer');
const weekSlotInfo = document.getElementById('weekSlotInfo');
const submitBtn = document.getElementById('submitBtn');
const alertPopup = document.getElementById('alertPopup');
const enrolError = document.getElementById('enrolError');
const statusContainer = document.getElementById('statusContainer');
const statusDisplay = document.getElementById('statusDisplay');

// ============================================
// 🚀 INITIALIZATION
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
    await refreshStudentData();
    setupEventListeners();
    resetStudentUI();
});

function setupEventListeners() {
    // Debounced enrolment lookup
    let debounceTimeout;
    enrolInput.addEventListener('input', (e) => {
        clearTimeout(debounceTimeout);
        const val = e.target.value.trim();
        debounceTimeout = setTimeout(() => {
            if (val.length > 0) {
                lookupStudent(val);
            } else {
                resetStudentUI();
            }
        }, 400);
    });
    
    submitBtn.addEventListener('click', submitRegistration);
}

// ============================================
// 📥 DATA LOADING FROM GOOGLE SHEETS
// ============================================

async function fetchStudentsFromSheet() {
    try {
        const response = await fetch(`${APPS_SCRIPT_URL}?action=getAllStudents&t=${Date.now()}`);
        const data = await response.json();
        
        if (data.error) {
            console.error("Error loading students:", data.error);
            return [];
        }
        
        if (Array.isArray(data)) {
            return data;
        } else if (data.data && Array.isArray(data.data)) {
            return data.data;
        }
        return [];
    } catch (err) {
        console.error("Fetch error:", err);
        return [];
    }
}

async function refreshStudentData() {
    try {
        const data = await fetchStudentsFromSheet();
        if (data.length) {
            studentsData = data.map(s => ({
                enrol: String(s.enrol || s["enrol no"] || s["enrl no"] || "").trim(),
                name: s.name || "",
                year: s.year || "",
                status: s.status || ""
            }));
        }
    } catch(e) { 
        console.error(e); 
    }
}

// ============================================
// 🔍 STUDENT LOOKUP & YEAR DETECTION
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

async function lookupStudent(enrol) {
    if (!enrol || enrol.trim() === "") {
        resetStudentUI();
        return false;
    }
    
    // Refresh data from sheet
    await refreshStudentData();
    
    // Determine year from enrolment number
    const year = getYearFromEnrol(enrol);
    if (!year) {
        enrolError.textContent = "❌ Enrolment number not found in registry";
        enrolError.classList.remove("hidden");
        resetStudentUI();
        currentStudent = null;
        selectedWeek = null;
        renderWeekCards(null);
        return false;
    }
    
    enrolError.classList.add("hidden");
    
    // Find if student already has a status in the sheet
    const existingStudent = studentsData.find(s => String(s.enrol).trim() === String(enrol).trim());
    
    currentStudent = {
        enrol: String(enrol).trim(),
        name: existingStudent?.name || "Student Name Not Found",
        year: year,
        status: existingStudent?.status || ""
    };
    
    studentNameField.value = currentStudent.name;
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
    
    studentsData.forEach(student => {
        if (student.status && student.status !== "" && student.year) {
            const week = student.status;
            if (usage[student.year] && usage[student.year][week] !== undefined) {
                usage[student.year][week]++;
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
// 📤 SUBMIT REGISTRATION
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
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';
    
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
                name: currentStudent.name
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            // Update local data
            currentStudent.status = selectedWeek;
            const index = studentsData.findIndex(s => s.enrol === currentStudent.enrol);
            if (index !== -1) {
                studentsData[index].status = selectedWeek;
            } else {
                studentsData.push({
                    enrol: currentStudent.enrol,
                    name: currentStudent.name,
                    year: currentStudent.year,
                    status: selectedWeek
                });
            }
            
            showAlert(`✅ Success! You have registered for ${WEEK_DISPLAY_NAMES[selectedWeek]}.`, false);
            
            // Update UI to show status
            statusContainer.classList.remove("hidden");
            statusDisplay.innerHTML = `<span class="status-badge status-submitted"><i class="fas fa-check-circle mr-1"></i> Registered for ${WEEK_DISPLAY_NAMES[selectedWeek]}</span>`;
            renderWeekCards(currentStudent.year);
            submitBtn.disabled = true;
            submitBtn.style.opacity = "0.6";
            submitBtn.style.cursor = "not-allowed";
            
        } else {
            showAlert(`❌ Registration failed: ${result.error || "Unknown error"}`);
            await refreshStudentData();
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

console.log('%c🌙 PG Workshop Registration Portal Loaded 🌙', 'color: #059669; font-size: 16px; font-weight: bold;');
