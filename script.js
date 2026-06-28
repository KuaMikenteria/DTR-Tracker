// ---------- Helper utilities ----------
function toMinutes(hour, minute, ampm) {
  let h = parseInt(hour),
    m = parseInt(minute);
  if (isNaN(h)) h = 1;
  if (isNaN(m)) m = 0;
  if (ampm === "PM" && h !== 12) h += 12;
  if (ampm === "AM" && h === 12) h = 0;
  return h * 60 + m;
}
function formatHoursMinutes(minutes) {
  if (minutes === null || isNaN(minutes)) return "0h 0m";
  const hrs = Math.floor(minutes / 60),
    mins = minutes % 60;
  return `${hrs}h ${mins}m`;
}
function getWeekNumber(date) {
  const d = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return { year: d.getUTCFullYear(), week: weekNo };
}
function getWeekRange(date) {
  const d = new Date(date);
  const day = d.getDay() || 7;
  const diff = day === 1 ? 0 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return `${monday.toLocaleDateString("en-CA")} – ${sunday.toLocaleDateString("en-CA")}`;
}

// ---------- Data model ----------
let shifts = [];
let nextId = 1;
let editingId = null;
let highlightTimeout = null;
let modalEditingId = null;

function getTotalCompletedMinutes() {
  return shifts.reduce((sum, s) => sum + (s.totalMinutes || 0), 0);
}

function updateTargetAndStats() {
  const completedMins = getTotalCompletedMinutes();
  document.getElementById("completedHours").innerText =
    formatHoursMinutes(completedMins);
  const totalShifts = shifts.length;
  let avgDisplay = "0h 0m";
  if (totalShifts > 0) {
    const avgMinutes = completedMins / totalShifts;
    avgDisplay = formatHoursMinutes(avgMinutes);
  }
  document.getElementById("avgHoursDisplay").innerText = avgDisplay;
  document.getElementById("totalShiftsCount").innerText = totalShifts;
  const targetHrs =
    parseFloat(document.getElementById("targetHoursInput").value) || 0;
  const targetMinutes = targetHrs * 60;
  const remainingMinutes = Math.max(0, targetMinutes - completedMins);
  document.getElementById("hoursRemaining").innerText =
    formatHoursMinutes(remainingMinutes);
  let percent = targetHrs > 0 ? (completedMins / 60 / targetHrs) * 100 : 0;
  percent = Math.min(100, percent);
  document.getElementById("progressPercent").innerText =
    `${percent.toFixed(1)}%`;
  document.getElementById("progressFillBar").style.width = `${percent}%`;
}

function getSortedShifts() {
  const sortVal = document.getElementById("sortOrderSelect").value;
  const sorted = [...shifts];
  sorted.sort((a, b) => {
    if (sortVal === "newest") return new Date(b.date) - new Date(a.date);
    else return new Date(a.date) - new Date(b.date);
  });
  return sorted;
}

function groupShiftsByMonth(sortedShifts) {
  const groups = new Map();
  for (const shift of sortedShifts) {
    const date = new Date(shift.date);
    const year = date.getFullYear(),
      month = date.getMonth();
    const key = `${year}-${month}`;
    const monthNames = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];
    const monthName = `${monthNames[month]} ${year}`;
    if (!groups.has(key)) groups.set(key, { monthName, shifts: [] });
    groups.get(key).shifts.push(shift);
  }
  const sortedGroups = Array.from(groups.entries()).sort((a, b) =>
    a[0].localeCompare(b[0]),
  );
  return sortedGroups.map(([_, group]) => group);
}

function groupShiftsByWeek(sortedShifts) {
  const groups = new Map();
  for (const shift of sortedShifts) {
    const date = new Date(shift.date);
    const { year, week } = getWeekNumber(date);
    const key = `${year}-W${week}`;
    const weekRange = getWeekRange(date);
    if (!groups.has(key))
      groups.set(key, { weekNum: week, year, weekRange, shifts: [] });
    groups.get(key).shifts.push(shift);
  }
  const sortedGroups = Array.from(groups.entries()).sort((a, b) =>
    a[0].localeCompare(b[0]),
  );
  return sortedGroups.map(([_, group]) => group);
}

function renderShiftEntry(shift) {
  const totalF = formatHoursMinutes(shift.totalMinutes);
  const mornRange = shift.skipMorning
    ? "🌅 (skipped)"
    : `🌅 ${shift.morningStart.hour}:${String(shift.morningStart.minute).padStart(2, "0")}${shift.morningStart.ampm} → ${shift.morningEnd.hour}:${String(shift.morningEnd.minute).padStart(2, "0")}${shift.morningEnd.ampm}`;
  const afterRange = shift.skipAfternoon
    ? "☀️ (skipped)"
    : `☀️ ${shift.afternoonStart.hour}:${String(shift.afternoonStart.minute).padStart(2, "0")}${shift.afternoonStart.ampm} → ${shift.afternoonEnd.hour}:${String(shift.afternoonEnd.minute).padStart(2, "0")}${shift.afternoonEnd.ampm}`;
  let otText = "";
  if (shift.otEnabled && shift.otStart)
    otText = ` + OT ${shift.otStart.hour}:${String(shift.otStart.minute).padStart(2, "0")}${shift.otStart.ampm}→${shift.otEnd.hour}:${String(shift.otEnd.minute).padStart(2, "0")}${shift.otEnd.ampm}`;
  const highlightClass = shift._newHighlight ? "highlight-new" : "";
  return `<div class="entry-item ${highlightClass}" data-id="${shift.id}">
        <div class="entry-details">
          <span class="entry-date">📆 ${shift.date}</span>
          <span class="timespan">${mornRange}</span>
          <span class="timespan">${afterRange}</span>
          ${otText ? `<span class="timespan">${otText}</span>` : ""}
          <span class="entry-total">⌛ ${totalF}</span>
        </div>
        <div class="entry-actions">
          <button class="edit-btn" data-id="${shift.id}">✏️ Edit</button>
          <button class="delete-btn" data-id="${shift.id}">🗑️ Delete</button>
        </div>
      </div>`;
}

function renderShiftsList() {
  const groupBy = document.getElementById("groupBySelect").value;
  let sorted = getSortedShifts();
  if (sorted.length === 0) {
    document.getElementById("shiftsContainer").innerHTML =
      '<div style="text-align:center; padding:2rem;">📭 No shifts logged. Add your first shift.</div>';
    updateTargetAndStats();
    return;
  }
  let html = "";
  if (groupBy === "month") {
    const monthGroups = groupShiftsByMonth(sorted);
    for (const group of monthGroups) {
      html += `<div class="group-header">📅 ${group.monthName}</div>`;
      for (const s of group.shifts) html += renderShiftEntry(s);
    }
  } else if (groupBy === "week") {
    const weekGroups = groupShiftsByWeek(sorted);
    for (const group of weekGroups) {
      html += `<div class="group-header">🗓️ Week ${group.weekNum}, ${group.year} <span class="week-range">(${group.weekRange})</span></div>`;
      for (const s of group.shifts) html += renderShiftEntry(s);
    }
  } else {
    for (const s of sorted) html += renderShiftEntry(s);
  }
  document.getElementById("shiftsContainer").innerHTML = html;
  document.querySelectorAll(".edit-btn").forEach((btn) =>
    btn.addEventListener("click", (e) => {
      const id = parseInt(btn.dataset.id);
      editShift(id);
    }),
  );
  document.querySelectorAll(".delete-btn").forEach((btn) =>
    btn.addEventListener("click", (e) => {
      const id = parseInt(btn.dataset.id);
      deleteShift(id);
    }),
  );
  updateTargetAndStats();
}

function applyHighlightToShift(shiftId) {
  setTimeout(() => {
    const entry = document.querySelector(`.entry-item[data-id="${shiftId}"]`);
    if (entry) {
      entry.classList.add("highlight-new");
      if (highlightTimeout) clearTimeout(highlightTimeout);
      highlightTimeout = setTimeout(() => {
        document
          .querySelectorAll(".entry-item")
          .forEach((el) => el.classList.remove("highlight-new"));
      }, 2800);
    }
  }, 60);
}

// ---------- Form helpers ----------
function getCurrentFormShiftObject() {
  const date = document.getElementById("shiftDate").value;
  if (!date) return null;
  const skipMorning = document.getElementById("skipMorning").checked;
  const skipAfternoon = document.getElementById("skipAfternoon").checked;
  const morningStart = {
    hour: document.getElementById("morningStartHour").value,
    minute: document.getElementById("morningStartMinute").value,
    ampm: document.getElementById("morningStartAmPm").value,
  };
  const morningEnd = {
    hour: document.getElementById("morningEndHour").value,
    minute: document.getElementById("morningEndMinute").value,
    ampm: document.getElementById("morningEndAmPm").value,
  };
  const afternoonStart = {
    hour: document.getElementById("afternoonStartHour").value,
    minute: document.getElementById("afternoonStartMinute").value,
    ampm: document.getElementById("afternoonStartAmPm").value,
  };
  const afternoonEnd = {
    hour: document.getElementById("afternoonEndHour").value,
    minute: document.getElementById("afternoonEndMinute").value,
    ampm: document.getElementById("afternoonEndAmPm").value,
  };
  const otEnabled = document.getElementById("enableOvertimeCheckbox").checked;
  let otStart = null,
    otEnd = null;
  if (otEnabled) {
    otStart = {
      hour: document.getElementById("otStartHour").value,
      minute: document.getElementById("otStartMinute").value,
      ampm: document.getElementById("otStartAmPm").value,
    };
    otEnd = {
      hour: document.getElementById("otEndHour").value,
      minute: document.getElementById("otEndMinute").value,
      ampm: document.getElementById("otEndAmPm").value,
    };
  }
  let total = 0;
  if (!skipMorning) {
    const startM = toMinutes(
      morningStart.hour,
      morningStart.minute,
      morningStart.ampm,
    );
    const endM = toMinutes(morningEnd.hour, morningEnd.minute, morningEnd.ampm);
    if (endM <= startM) return null;
    total += endM - startM;
  }
  if (!skipAfternoon) {
    const startM = toMinutes(
      afternoonStart.hour,
      afternoonStart.minute,
      afternoonStart.ampm,
    );
    const endM = toMinutes(
      afternoonEnd.hour,
      afternoonEnd.minute,
      afternoonEnd.ampm,
    );
    if (endM <= startM) return null;
    total += endM - startM;
  }
  if (otEnabled && otStart) {
    const startM = toMinutes(otStart.hour, otStart.minute, otStart.ampm);
    const endM = toMinutes(otEnd.hour, otEnd.minute, otEnd.ampm);
    if (endM <= startM) return null;
    total += endM - startM;
  }
  return {
    date,
    skipMorning,
    skipAfternoon,
    morningStart,
    morningEnd,
    afternoonStart,
    afternoonEnd,
    otEnabled,
    otStart,
    otEnd,
    totalMinutes: total,
  };
}

function addOrUpdateShift() {
  const shiftData = getCurrentFormShiftObject();
  if (!shiftData) {
    document.getElementById("formErrorMsg").style.display = "block";
    document.getElementById("formErrorMsg").innerText =
      "❌ Invalid times: active sessions must have end after start.";
    return;
  }
  let addedId = null;
  if (editingId !== null) {
    const index = shifts.findIndex((s) => s.id === editingId);
    if (index !== -1) shifts[index] = { id: editingId, ...shiftData };
    addedId = editingId;
    editingId = null;
    document.getElementById("cancelEditBtn").style.display = "none";
    document.getElementById("addShiftBtn").innerHTML = "➕ Add / Update Shift";
  } else {
    const newId = nextId++;
    shifts.push({ id: newId, ...shiftData });
    addedId = newId;
  }
  shifts.forEach((s) => delete s._newHighlight);
  if (addedId) {
    const target = shifts.find((s) => s.id === addedId);
    if (target) target._newHighlight = true;
  }
  renderShiftsList();
  if (addedId) applyHighlightToShift(addedId);
  resetFormToDefault();
  updateLivePreview();
}

function resetFormToDefault() {
  document.getElementById("skipMorning").checked = false;
  document.getElementById("skipAfternoon").checked = false;
  toggleMorningFields();
  toggleAfternoonFields();
  document.getElementById("morningStartHour").value = 8;
  document.getElementById("morningStartMinute").value = 0;
  document.getElementById("morningStartAmPm").value = "AM";
  document.getElementById("morningEndHour").value = 12;
  document.getElementById("morningEndMinute").value = 0;
  document.getElementById("morningEndAmPm").value = "PM";
  document.getElementById("afternoonStartHour").value = 1;
  document.getElementById("afternoonStartMinute").value = 0;
  document.getElementById("afternoonStartAmPm").value = "PM";
  document.getElementById("afternoonEndHour").value = 5;
  document.getElementById("afternoonEndMinute").value = 0;
  document.getElementById("afternoonEndAmPm").value = "PM";
  document.getElementById("enableOvertimeCheckbox").checked = false;
  document.getElementById("overtimeFields").style.display = "none";
  document.getElementById("shiftDate").value = new Date()
    .toISOString()
    .slice(0, 10);
  editingId = null;
  document.getElementById("cancelEditBtn").style.display = "none";
  document.getElementById("addShiftBtn").innerHTML = "➕ Add / Update Shift";
  updateLivePreview();
}

function deleteShift(id) {
  if (!confirm("Delete this shift permanently?")) return;
  shifts = shifts.filter((s) => s.id !== id);
  if (editingId === id) resetFormToDefault();
  renderShiftsList();
}

// ---------- Modal-based edit ----------
function editShift(id) {
  const shift = shifts.find((s) => s.id === id);
  if (!shift) return;
  modalEditingId = id;
  document.getElementById("modalDate").value = shift.date;
  document.getElementById("modalSkipMorning").checked = shift.skipMorning;
  document.getElementById("modalSkipAfternoon").checked = shift.skipAfternoon;
  document.getElementById("modalMStartHour").value = shift.morningStart.hour;
  document.getElementById("modalMStartMin").value = shift.morningStart.minute;
  document.getElementById("modalMStartAmPm").value = shift.morningStart.ampm;
  document.getElementById("modalMEndHour").value = shift.morningEnd.hour;
  document.getElementById("modalMEndMin").value = shift.morningEnd.minute;
  document.getElementById("modalMEndAmPm").value = shift.morningEnd.ampm;
  document.getElementById("modalAStartHour").value = shift.afternoonStart.hour;
  document.getElementById("modalAStartMin").value = shift.afternoonStart.minute;
  document.getElementById("modalAStartAmPm").value = shift.afternoonStart.ampm;
  document.getElementById("modalAEndHour").value = shift.afternoonEnd.hour;
  document.getElementById("modalAEndMin").value = shift.afternoonEnd.minute;
  document.getElementById("modalAEndAmPm").value = shift.afternoonEnd.ampm;
  const otEn = shift.otEnabled || false;
  document.getElementById("modalEnableOT").checked = otEn;
  document.getElementById("modalOTFields").classList.toggle("open", otEn);
  if (otEn && shift.otStart) {
    document.getElementById("modalOTStartHour").value = shift.otStart.hour;
    document.getElementById("modalOTStartMin").value = shift.otStart.minute;
    document.getElementById("modalOTStartAmPm").value = shift.otStart.ampm;
    document.getElementById("modalOTEndHour").value = shift.otEnd.hour;
    document.getElementById("modalOTEndMin").value = shift.otEnd.minute;
    document.getElementById("modalOTEndAmPm").value = shift.otEnd.ampm;
  } else {
    document.getElementById("modalOTStartHour").value = 5;
    document.getElementById("modalOTStartMin").value = 30;
    document.getElementById("modalOTStartAmPm").value = "PM";
    document.getElementById("modalOTEndHour").value = 7;
    document.getElementById("modalOTEndMin").value = 0;
    document.getElementById("modalOTEndAmPm").value = "PM";
  }
  document.getElementById("modalErrorMsg").style.display = "none";
  updateModalPreview();
  document.getElementById("editModal").classList.add("active");
  document.body.style.overflow = "hidden";
}

function getModalShiftObject() {
  const date = document.getElementById("modalDate").value;
  if (!date) return null;
  const skipMorning = document.getElementById("modalSkipMorning").checked;
  const skipAfternoon = document.getElementById("modalSkipAfternoon").checked;
  const ms = {
    hour: document.getElementById("modalMStartHour").value,
    minute: document.getElementById("modalMStartMin").value,
    ampm: document.getElementById("modalMStartAmPm").value,
  };
  const me = {
    hour: document.getElementById("modalMEndHour").value,
    minute: document.getElementById("modalMEndMin").value,
    ampm: document.getElementById("modalMEndAmPm").value,
  };
  const as = {
    hour: document.getElementById("modalAStartHour").value,
    minute: document.getElementById("modalAStartMin").value,
    ampm: document.getElementById("modalAStartAmPm").value,
  };
  const ae = {
    hour: document.getElementById("modalAEndHour").value,
    minute: document.getElementById("modalAEndMin").value,
    ampm: document.getElementById("modalAEndAmPm").value,
  };
  const otEnabled = document.getElementById("modalEnableOT").checked;
  let otStart = null,
    otEnd = null;
  if (otEnabled) {
    otStart = {
      hour: document.getElementById("modalOTStartHour").value,
      minute: document.getElementById("modalOTStartMin").value,
      ampm: document.getElementById("modalOTStartAmPm").value,
    };
    otEnd = {
      hour: document.getElementById("modalOTEndHour").value,
      minute: document.getElementById("modalOTEndMin").value,
      ampm: document.getElementById("modalOTEndAmPm").value,
    };
  }
  let total = 0;
  if (!skipMorning) {
    const s = toMinutes(ms.hour, ms.minute, ms.ampm);
    const e = toMinutes(me.hour, me.minute, me.ampm);
    if (e <= s) return null;
    total += e - s;
  }
  if (!skipAfternoon) {
    const s = toMinutes(as.hour, as.minute, as.ampm);
    const e = toMinutes(ae.hour, ae.minute, ae.ampm);
    if (e <= s) return null;
    total += e - s;
  }
  if (otEnabled && otStart) {
    const s = toMinutes(otStart.hour, otStart.minute, otStart.ampm);
    const e = toMinutes(otEnd.hour, otEnd.minute, otEnd.ampm);
    if (e <= s) return null;
    total += e - s;
  }
  return {
    date,
    skipMorning,
    skipAfternoon,
    morningStart: ms,
    morningEnd: me,
    afternoonStart: as,
    afternoonEnd: ae,
    otEnabled,
    otStart,
    otEnd,
    totalMinutes: total,
  };
}

function computeModalTotal() {
  const shift = getModalShiftObject();
  if (!shift) return null;
  return shift.totalMinutes;
}

function updateModalPreview() {
  const mins = computeModalTotal();
  if (mins === null) {
    document.getElementById("modalTotalPreview").innerHTML =
      "⚠️ Invalid times: end after start for active sessions.";
    return false;
  }
  document.getElementById("modalTotalPreview").innerHTML =
    `⏲️ Current shift total: ${formatHoursMinutes(mins)}`;
  return true;
}

function showModalError(msg) {
  const errDiv = document.getElementById("modalErrorMsg");
  errDiv.style.display = "block";
  errDiv.innerText = msg;
}

function closeModal() {
  document.getElementById("editModal").classList.remove("active");
  document.body.style.overflow = "";
  modalEditingId = null;
}

function saveModalEdit() {
  const shiftData = getModalShiftObject();
  if (!shiftData) {
    showModalError("❌ Please select a date and ensure times are valid.");
    return;
  }
  const index = shifts.findIndex((s) => s.id === modalEditingId);
  if (index === -1) {
    showModalError("❌ Shift not found.");
    return;
  }
  shifts[index] = { id: modalEditingId, ...shiftData };
  shifts.forEach((s) => delete s._newHighlight);
  const target = shifts.find((s) => s.id === modalEditingId);
  if (target) target._newHighlight = true;
  renderShiftsList();
  if (target) applyHighlightToShift(target.id);
  closeModal();
  showToast("✅ Your changes have been saved successfully.", "success", 3500);
}

// ---------- Toast ----------
function showToast(message, type = "success", duration = 3000) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.className = type;
  toast.classList.add("show");
  clearTimeout(toast._hideTimer);
  toast._hideTimer = setTimeout(() => {
    toast.classList.remove("show");
  }, duration);
}

// ---------- Other helpers ----------
function computeCurrentTotalMinutes() {
  const skipM = document.getElementById("skipMorning").checked;
  const skipA = document.getElementById("skipAfternoon").checked;
  let total = 0;
  if (!skipM) {
    const dur = getDurFromIds(
      "morningStartHour",
      "morningStartMinute",
      "morningStartAmPm",
      "morningEndHour",
      "morningEndMinute",
      "morningEndAmPm",
    );
    if (dur === null) return null;
    total += dur;
  }
  if (!skipA) {
    const dur = getDurFromIds(
      "afternoonStartHour",
      "afternoonStartMinute",
      "afternoonStartAmPm",
      "afternoonEndHour",
      "afternoonEndMinute",
      "afternoonEndAmPm",
    );
    if (dur === null) return null;
    total += dur;
  }
  if (document.getElementById("enableOvertimeCheckbox").checked) {
    const dur = getDurFromIds(
      "otStartHour",
      "otStartMinute",
      "otStartAmPm",
      "otEndHour",
      "otEndMinute",
      "otEndAmPm",
    );
    if (dur === null) return null;
    total += dur;
  }
  return total;
}

function getDurFromIds(sH, sM, sA, eH, eM, eA) {
  const start = toMinutes(
    document.getElementById(sH).value,
    document.getElementById(sM).value,
    document.getElementById(sA).value,
  );
  const end = toMinutes(
    document.getElementById(eH).value,
    document.getElementById(eM).value,
    document.getElementById(eA).value,
  );
  if (end <= start) return null;
  return end - start;
}

function updateLivePreview() {
  const totalMins = computeCurrentTotalMinutes();
  if (totalMins === null) {
    document.getElementById("liveTotalPreview").innerHTML =
      "⚠️ Invalid times: end after start for active sessions.";
    return false;
  } else {
    document.getElementById("liveTotalPreview").innerHTML =
      `⏲️ Current shift total: ${formatHoursMinutes(totalMins)}`;
    return true;
  }
}

function toggleMorningFields() {
  const skip = document.getElementById("skipMorning").checked;
  [
    "morningStartHour",
    "morningStartMinute",
    "morningStartAmPm",
    "morningEndHour",
    "morningEndMinute",
    "morningEndAmPm",
  ].forEach((id) => {
    document.getElementById(id).classList.toggle("disabled-input", skip);
  });
  updateLivePreview();
}
function toggleAfternoonFields() {
  const skip = document.getElementById("skipAfternoon").checked;
  [
    "afternoonStartHour",
    "afternoonStartMinute",
    "afternoonStartAmPm",
    "afternoonEndHour",
    "afternoonEndMinute",
    "afternoonEndAmPm",
  ].forEach((id) => {
    document.getElementById(id).classList.toggle("disabled-input", skip);
  });
  updateLivePreview();
}

function loadSampleEntries() {
  if (
    shifts.length > 0 &&
    !confirm("Load sample data? This will replace existing records.")
  )
    return;
  const s1 = {
    id: nextId++,
    date: "2026-01-29",
    skipMorning: false,
    skipAfternoon: false,
    morningStart: { hour: 6, minute: 51, ampm: "AM" },
    morningEnd: { hour: 11, minute: 59, ampm: "AM" },
    afternoonStart: { hour: 1, minute: 28, ampm: "PM" },
    afternoonEnd: { hour: 5, minute: 8, ampm: "PM" },
    otEnabled: false,
    totalMinutes:
      toMinutes(11, 59, "AM") -
      toMinutes(6, 51, "AM") +
      (toMinutes(17, 8, "PM") - toMinutes(13, 28, "PM")),
  };
  const s2 = {
    id: nextId++,
    date: "2026-02-12",
    skipMorning: false,
    skipAfternoon: false,
    morningStart: { hour: 7, minute: 30, ampm: "AM" },
    morningEnd: { hour: 11, minute: 42, ampm: "AM" },
    afternoonStart: { hour: 1, minute: 1, ampm: "PM" },
    afternoonEnd: { hour: 5, minute: 10, ampm: "PM" },
    otEnabled: false,
    totalMinutes:
      toMinutes(11, 42, "AM") -
      toMinutes(7, 30, "AM") +
      (toMinutes(17, 10, "PM") - toMinutes(13, 1, "PM")),
  };
  const s3 = {
    id: nextId++,
    date: "2026-04-15",
    skipMorning: false,
    skipAfternoon: false,
    morningStart: { hour: 8, minute: 13, ampm: "AM" },
    morningEnd: { hour: 11, minute: 42, ampm: "AM" },
    afternoonStart: { hour: 1, minute: 1, ampm: "PM" },
    afternoonEnd: { hour: 4, minute: 43, ampm: "PM" },
    otEnabled: false,
    totalMinutes:
      toMinutes(11, 42, "AM") -
      toMinutes(8, 13, "AM") +
      (toMinutes(16, 43, "PM") - toMinutes(13, 1, "PM")),
  };
  const s4 = {
    id: nextId++,
    date: "2026-05-08",
    skipMorning: false,
    skipAfternoon: false,
    morningStart: { hour: 8, minute: 0, ampm: "AM" },
    morningEnd: { hour: 12, minute: 0, ampm: "PM" },
    afternoonStart: { hour: 1, minute: 0, ampm: "PM" },
    afternoonEnd: { hour: 5, minute: 30, ampm: "PM" },
    otEnabled: true,
    otStart: { hour: 5, minute: 30, ampm: "PM" },
    otEnd: { hour: 7, minute: 0, ampm: "PM" },
    totalMinutes: 240 + 270 + 90,
  };
  shifts = [s1, s2, s3, s4];
  renderShiftsList();
  resetFormToDefault();
}

// ---------- Event listeners ----------
document.addEventListener("DOMContentLoaded", function () {
  document
    .getElementById("addShiftBtn")
    .addEventListener("click", addOrUpdateShift);
  document
    .getElementById("cancelEditBtn")
    .addEventListener("click", resetFormToDefault);
  document
    .getElementById("loadSampleBtn")
    .addEventListener("click", loadSampleEntries);
  document
    .getElementById("enableOvertimeCheckbox")
    .addEventListener("change", (e) => {
      document.getElementById("overtimeFields").style.display = e.target.checked
        ? "flex"
        : "none";
      updateLivePreview();
    });
  document.getElementById("skipMorning").addEventListener("change", () => {
    toggleMorningFields();
    updateLivePreview();
  });
  document.getElementById("skipAfternoon").addEventListener("change", () => {
    toggleAfternoonFields();
    updateLivePreview();
  });
  document
    .getElementById("groupBySelect")
    .addEventListener("change", renderShiftsList);
  document
    .getElementById("sortOrderSelect")
    .addEventListener("change", renderShiftsList);
  document
    .getElementById("targetHoursInput")
    .addEventListener("input", updateTargetAndStats);
  document
    .querySelectorAll("input.time-num, select")
    .forEach((el) => el.addEventListener("input", updateLivePreview));

  // Modal event listeners
  document
    .getElementById("modalCloseBtn")
    .addEventListener("click", closeModal);
  document
    .getElementById("modalCancelBtn")
    .addEventListener("click", closeModal);
  document
    .getElementById("modalSaveBtn")
    .addEventListener("click", saveModalEdit);
  document.getElementById("editModal").addEventListener("click", (e) => {
    if (e.target === document.getElementById("editModal")) closeModal();
  });
  document.addEventListener("keydown", (e) => {
    if (
      e.key === "Escape" &&
      document.getElementById("editModal").classList.contains("active")
    )
      closeModal();
  });

  document.getElementById("modalEnableOT").addEventListener("change", (e) => {
    document
      .getElementById("modalOTFields")
      .classList.toggle("open", e.target.checked);
    updateModalPreview();
  });
  document
    .querySelectorAll("#editModal input, #editModal select")
    .forEach((el) => {
      el.addEventListener("input", updateModalPreview);
      el.addEventListener("change", updateModalPreview);
    });

  document.getElementById("darkModeToggle").addEventListener("click", () => {
    document.body.classList.toggle("dark");
    document.getElementById("darkModeToggle").innerText =
      document.body.classList.contains("dark")
        ? "☀️ Light mode"
        : "🌙 Dark mode";
  });

  // Initial render
  toggleMorningFields();
  toggleAfternoonFields();
  updateLivePreview();
  resetFormToDefault();
  renderShiftsList();
});
