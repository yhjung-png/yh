const STORAGE_KEY = "fulfillment2_team2_attendance_config_v1";
const TODAY_KEY = "fulfillment2_team2_attendance_today_v1";

const DEFAULT_CONFIG = {
  teamTitle: "풀필먼트2팀 운영2팀",
  companies: [
    {
      name: "FB",
      people: [
        { name: "유기상" },
        { name: "홍귀순" },
        { name: "김예빈" },
        { name: "진나윤" },
        { name: "강혜원" },
        { name: "이지훈" }
      ]
    },
    {
      name: "고은로지스탭",
      people: [
        { name: "차은미" },
        { name: "김미진" },
        { name: "이소연" },
        { name: "최진혁", note: "지게차" }
      ]
    },
    {
      name: "포래인",
      people: [
        { name: "박선민" }
      ]
    },
    {
      name: "더블유파트너스",
      people: [
        { name: "윤민경" },
        { name: "김진주" },
        { name: "정용운" }
      ]
    }
  ]
};

const REASON_OPTIONS = [
  "휴무",
  "오전 반차",
  "오후 반차",
  "연차",
  "병가",
  "교육",
  "출장",
  "기타"
];

let config = loadConfig();
let state = loadTodayState();

const $ = (selector) => document.querySelector(selector);

function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function loadConfig() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : clone(DEFAULT_CONFIG);
  } catch {
    return clone(DEFAULT_CONFIG);
  }
}

function saveConfig() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function loadTodayState() {
  try {
    const saved = JSON.parse(localStorage.getItem(TODAY_KEY) || "null");
    if (!saved || saved.date !== todayKey()) {
      return freshState();
    }
    return saved;
  } catch {
    return freshState();
  }
}

function freshState() {
  return {
    date: todayKey(),
    attendance: {},
    newPeople: [],
    reasons: []
  };
}

function saveTodayState() {
  state.date = todayKey();
  localStorage.setItem(TODAY_KEY, JSON.stringify(state));
}

function personId(companyIndex, personIndex) {
  return `${companyIndex}:${personIndex}`;
}

function splitNewNames(value) {
  // 신규인원은 쉼표(,) 또는 모든 종류의 공백(스페이스/엔터/전각 공백)으로 구분합니다.
  // 예: "커피 카피 코피" / "커피,카피,코피" / "커피, 카피 코피" -> 모두 3명
  return String(value ?? "")
    .replace(/[，、]/g, ",")
    .replace(/\u00A0/g, " ")
    .trim()
    .split(/[\s,]+/u)
    .map(name => name.trim())
    .filter(Boolean);
}

function totalPeople() {
  const configuredTotal = config.companies.reduce((sum, c) => sum + c.people.length, 0);
  const newPeopleTotal = state.newPeople.reduce((sum, item) => {
    return sum + splitNewNames(item?.name).length;
  }, 0);
  return configuredTotal + newPeopleTotal;
}

function isPresent(id) {
  return state.attendance[id] === "present";
}

function isAbsent(id) {
  return state.attendance[id] === "absent";
}

function render() {
  renderDate();
  renderCompanies();
  renderNewPeople();
  renderReasons();
  updateSummary();
  updatePreview();
}

function renderDate() {
  const d = new Date();
  const days = ["일","월","화","수","목","금","토"];
  $("#todayText").textContent =
    `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,"0")}.${String(d.getDate()).padStart(2,"0")} (${days[d.getDay()]})`;
}

function renderCompanies() {
  const container = $("#companyList");
  container.innerHTML = "";

  config.companies.forEach((company, ci) => {
    const card = document.createElement("section");
    card.className = "company-card";

    const present = company.people.filter((_, pi) => isPresent(personId(ci, pi))).length;
    const absent = company.people.filter((_, pi) => isAbsent(personId(ci, pi))).length;

    const head = document.createElement("div");
    head.className = "company-head";
    head.innerHTML = `
      <div class="company-name">${escapeHtml(company.name)}</div>
      <div class="company-count">${company.people.length}명 · 현 ${present} · 결 ${absent}</div>
    `;
    card.appendChild(head);

    const grid = document.createElement("div");
    grid.className = "people-grid";

    company.people.forEach((person, pi) => {
      const id = personId(ci, pi);
      const btn = document.createElement("button");
      btn.className = "person-btn " + (isPresent(id) ? "present" : isAbsent(id) ? "absent" : "");
      btn.dataset.id = id;

      let status = "미선택";
      if (isPresent(id)) status = "✓ 출근";
      if (isAbsent(id)) status = "× 결원";

      btn.innerHTML = `
        <span>${escapeHtml(person.name)}</span>
        <span class="person-extra">${escapeHtml(person.note || "")}</span>
        <span class="status-dot">${status}</span>
      `;

      btn.addEventListener("click", () => cycleAttendance(id));
      grid.appendChild(btn);
    });

    card.appendChild(grid);
    container.appendChild(card);
  });
}

function cycleAttendance(id) {
  const current = state.attendance[id];
  if (!current) state.attendance[id] = "present";
  else if (current === "present") state.attendance[id] = "absent";
  else delete state.attendance[id];

  saveTodayState();
  render();
}

function renderNewPeople() {
  const container = $("#newPeopleList");
  container.innerHTML = "";

  if (!state.newPeople.length) {
    container.innerHTML = `<div class="empty-text">추가된 신규인원이 없습니다.</div>`;
    return;
  }

  const companyOptions = config.companies
    .filter(c => c.name.trim())
    .map(c => `<option value="${escapeAttr(c.name)}">${escapeHtml(c.name)}</option>`)
    .join("");

  state.newPeople.forEach((item, index) => {
    const row = document.createElement("div");
    row.className = "new-row";

    row.innerHTML = `
      <select class="select company-select">
        <option value="">업체 선택</option>
        ${companyOptions}
      </select>
      <input class="input" type="text" placeholder="이름" value="${escapeAttr(item.name)}">
      <button class="delete-row" aria-label="삭제">×</button>
    `;

    const companySelect = row.querySelector(".company-select");
    const nameInput = row.querySelector("input");

    companySelect.value = item.company || "";

    companySelect.addEventListener("change", e => {
      state.newPeople[index].company = e.target.value;
      saveTodayState();
      updatePreview();
    });

    nameInput.addEventListener("input", e => {
      // 입력 중에는 쉼표를 그대로 허용합니다.
      // 여러 명 입력은 입력을 마친 뒤 포커스가 빠질 때(blur) 분리합니다.
      state.newPeople[index].name = e.target.value;
      saveTodayState();
      // 입력 중에도 공백/쉼표 기준 신규인원 수를 즉시 다시 계산합니다.
      updateSummary();
      updatePreview();
    });

    const commitMultipleNames = () => {
      // 입력값을 여러 행으로 재구성하지 않습니다.
      // state에는 원문을 그대로 보관하고, 인원수/보고서에서 splitNewNames()로 계산합니다.
      // 이렇게 해야 "커피 카피 코피"가 절대 1명으로 저장되지 않습니다.
      const value = nameInput.value.trim();
      state.newPeople[index].name = value;
      saveTodayState();
      updateSummary();
      updatePreview();
    };

    nameInput.addEventListener("blur", commitMultipleNames);
    nameInput.addEventListener("keydown", e => {
      if (e.key === "Enter") {
        e.preventDefault();
        commitMultipleNames();
        nameInput.blur();
      }
    });

    row.querySelector(".delete-row").addEventListener("click", () => {
      state.newPeople.splice(index, 1);
      saveTodayState();
      renderNewPeople();
      updatePreview();
    });

    container.appendChild(row);
  });
}
function renderReasons() {
  const container = $("#reasonList");
  container.innerHTML = "";

  const absentPeople = getAbsentPeople();

  if (!absentPeople.length) {
    container.innerHTML = `<div class="empty-text">현재 결원으로 선택된 인원이 없습니다.</div>`;
    return;
  }

  absentPeople.forEach((person) => {
    const existing = state.reasons.find(r => r.id === person.id);
    if (!existing) {
      state.reasons.push({
        id: person.id,
        company: person.company,
        name: person.name,
        reason: "휴무"
      });
    }
  });

  state.reasons = state.reasons.filter(r => absentPeople.some(p => p.id === r.id));

  absentPeople.forEach((person) => {
    const reason = state.reasons.find(r => r.id === person.id);
    const row = document.createElement("div");
    row.className = "reason-row";

    row.innerHTML = `
      <input class="input" type="text" value="${escapeAttr(person.company + " : " + person.name)}" readonly>
      <select class="select">
        ${REASON_OPTIONS.map(x => `<option ${x === reason.reason ? "selected" : ""}>${escapeHtml(x)}</option>`).join("")}
      </select>
      <button class="delete-row" aria-label="삭제">×</button>
    `;

    row.querySelector("select").addEventListener("change", e => {
      reason.reason = e.target.value;
      saveTodayState();
      updatePreview();
    });

    row.querySelector(".delete-row").addEventListener("click", () => {
      state.reasons = state.reasons.filter(r => r.id !== person.id);
      saveTodayState();
      updatePreview();
    });

    container.appendChild(row);
  });

  saveTodayState();
}

function getAbsentPeople() {
  const result = [];
  config.companies.forEach((company, ci) => {
    company.people.forEach((person, pi) => {
      const id = personId(ci, pi);
      if (isAbsent(id)) {
        result.push({
          id,
          company: company.name,
          name: person.name,
          note: person.note || ""
        });
      }
    });
  });
  return result;
}

function updateSummary() {
  const total = totalPeople();
  const absent = getAbsentPeople().length;
  const present = total - absent;

  $("#totalCount").textContent = total;
  $("#presentCount").textContent = present;
  $("#absentCount").textContent = absent;
}

function buildReport() {
  const lines = [];
  lines.push(`#${config.teamTitle} 인원보고`);
  lines.push("");

  config.companies.forEach((company) => {
    lines.push(`- ${company.name} (${company.people.length}명)`);
    const names = company.people.map(p => `${p.name}${p.note ? `(${p.note})` : ""}`);
    lines.push(names.join(" "));
    lines.push("");
  });

  const validNewPeople = state.newPeople
    .flatMap(x => splitNewNames(x.name).map(name => ({ company: x.company, name })));
  if (validNewPeople.length) {
    lines.push(`-신규인원 (${validNewPeople.length}명)`);

    const newGroups = new Map();
    validNewPeople.forEach(x => {
      const company = (x.company || "").trim() || "미지정";
      const name = x.name.trim();
      if (!newGroups.has(company)) newGroups.set(company, []);
      newGroups.get(company).push(name);
    });

    newGroups.forEach((names, company) => {
      lines.push(`${company} : ${names.join(", ")}`);
    });
    lines.push("");
  }

  const absent = getAbsentPeople();
  lines.push("*결원사유 이유");
  lines.push("");

  if (absent.length) {
    // 업체 + 결원사유가 같은 사람들을 하나의 줄로 묶습니다.
    // 예: FB : 이지훈, 김예빈 (휴무)
    // 사유가 다르면 같은 업체라도 별도의 줄로 표시합니다.
    const reasonGroups = new Map();

    absent.forEach(person => {
      const reasonRecord = state.reasons.find(r => r.id === person.id);
      const reason = (reasonRecord?.reason || "휴무").trim();
      const key = `${person.company}\u0000${reason}`;

      if (!reasonGroups.has(key)) {
        reasonGroups.set(key, {
          company: person.company,
          reason,
          names: []
        });
      }
      reasonGroups.get(key).names.push(person.name);
    });

    reasonGroups.forEach(group => {
      lines.push(`${group.company} : ${group.names.join(", ")} (${group.reason})`);
    });
  } else {
    lines.push("결원 없음");
  }

  lines.push("");
  const total = totalPeople();
  const absentCount = absent.length;
  const present = total - absentCount;
  lines.push(`- 총 ${total}명 / 현 ${present}명 / 결 ${absentCount}명`);

  return lines.join("\n");
}

function updatePreview() {
  // 미리보기 영역이 열려 있을 때만 화면 내용을 갱신합니다.
  // 복사 기능은 이 값에 의존하지 않고 buildReport()를 직접 호출합니다.
  const area = $("#previewArea");
  if (!area.classList.contains("hidden")) {
    $("#previewText").value = buildReport();
  }
}

function togglePreview() {
  const area = $("#previewArea");
  const button = $("#previewBtn");

  area.classList.toggle("hidden");

  if (area.classList.contains("hidden")) {
    button.textContent = "👁 미리보기";
  } else {
    $("#previewText").value = buildReport();
    button.textContent = "▲ 미리보기 닫기";
  }
}

function addNewPerson() {
  state.newPeople.push({
    company: config.companies[0]?.name || "",
    name: ""
  });
  saveTodayState();
  renderNewPeople();
  updatePreview();

  setTimeout(() => {
    const inputs = document.querySelectorAll("#newPeopleList input");
    inputs[inputs.length - 1]?.focus();
  }, 50);
}

function addReason() {
  // 결원사유는 결원 선택과 자동 연동되므로 버튼을 누르면 안내
  const absent = getAbsentPeople();
  if (!absent.length) {
    showMessage("먼저 출석 화면에서 결원자를 선택하세요.");
    return;
  }
  $("#reasonList").scrollIntoView({ behavior: "smooth", block: "center" });
}

function openSettings() {
  renderSettings();
  $("#settingsModal").classList.remove("hidden");
}

function closeSettings() {
  $("#settingsModal").classList.add("hidden");
}

function renderSettings() {
  const container = $("#settingsCompanies");
  container.innerHTML = "";

  config.companies.forEach((company, ci) => {
    const box = document.createElement("div");
    box.className = "settings-company";

    const head = document.createElement("div");
    head.className = "settings-company-head";
    head.innerHTML = `
      <input type="text" value="${escapeAttr(company.name)}" placeholder="업체명">
      <button class="remove-btn" title="업체 삭제">×</button>
    `;

    head.querySelector("input").addEventListener("input", e => {
      company.name = e.target.value;
    });

    head.querySelector(".remove-btn").addEventListener("click", () => {
      if (config.companies.length <= 1) {
        showMessage("업체는 최소 1개가 필요합니다.");
        return;
      }
      config.companies.splice(ci, 1);
      renderSettings();
    });

    box.appendChild(head);

    const people = document.createElement("div");
    people.className = "settings-people";

    company.people.forEach((person, pi) => {
      const row = document.createElement("div");
      row.className = "settings-person";
      row.innerHTML = `
        <input type="text" value="${escapeAttr(person.name)}" placeholder="이름">
        <button class="remove-btn" title="인원 삭제">×</button>
      `;

      row.querySelector("input").addEventListener("input", e => {
        person.name = e.target.value;
      });

      row.querySelector(".remove-btn").addEventListener("click", () => {
        company.people.splice(pi, 1);
        renderSettings();
      });

      people.appendChild(row);
    });

    const addPerson = document.createElement("button");
    addPerson.className = "add-person-btn";
    addPerson.textContent = "＋ 인원 추가";
    addPerson.addEventListener("click", () => {
      company.people.push({ name: "", note: "" });
      renderSettings();
    });

    box.appendChild(people);
    box.appendChild(addPerson);
    container.appendChild(box);
  });
}

function addCompany() {
  config.companies.push({
    name: "",
    people: [{ name: "", note: "" }]
  });
  renderSettings();

  setTimeout(() => {
    const boxes = document.querySelectorAll(".settings-company");
    boxes[boxes.length - 1]?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, 50);
}

function saveSettingsAndClose() {
  config.companies = config.companies
    .map(c => ({
      name: c.name.trim(),
      people: c.people
        .map(p => ({ name: p.name.trim(), note: p.note || "" }))
        .filter(p => p.name)
    }))
    .filter(c => c.name);

  if (!config.companies.length) {
    config = clone(DEFAULT_CONFIG);
  }

  saveConfig();
  closeSettings();
  render();
  showMessage("설정이 저장되었습니다.");
}

function restoreDefaults() {
  openConfirm(
    "기본값 복원",
    "현재 업체/인원 설정을 처음 제공된 예시 값으로 되돌릴까요?",
    () => {
      config = clone(DEFAULT_CONFIG);
      saveConfig();
      renderSettings();
      render();
      showMessage("기본값으로 복원했습니다.");
    }
  );
}

function resetToday() {
  openConfirm(
    "오늘 입력 초기화",
    "오늘 선택한 출석, 신규인원, 결원사유를 모두 초기화할까요?",
    () => {
      state = freshState();
      saveTodayState();
      render();
      showMessage("오늘 입력을 초기화했습니다.");
    }
  );
}

async function copyReport() {
  // 화면의 미리보기 textarea를 절대로 복사하지 않습니다.
  // 현재 출석/신규인원/결원사유 데이터를 기준으로 매번 새로 생성합니다.
  const text = buildReport();

  try {
    await navigator.clipboard.writeText(text);
    showCopySuccess();
  } catch {
    // Clipboard API가 차단된 환경을 위한 fallback
    const textarea = $("#previewText");
    const wasHidden = $("#previewArea").classList.contains("hidden");

    if (wasHidden) {
      $("#previewArea").classList.remove("hidden");
    }

    textarea.value = text;
    textarea.removeAttribute("readonly");
    textarea.focus();
    textarea.select();
    document.execCommand("copy");
    textarea.setAttribute("readonly", "");

    if (wasHidden) {
      $("#previewArea").classList.add("hidden");
    }

    showCopySuccess();
  }
}
function showCopySuccess() {
  const btn = $("#copyBtn");
  btn.textContent = "✓ 복사 완료";
  btn.classList.add("copied");
  $("#copyMessage").textContent = "보고내용이 클립보드에 복사되었습니다.";

  setTimeout(() => {
    btn.textContent = "📋 내용 복사";
    btn.classList.remove("copied");
    $("#copyMessage").textContent = "";
  }, 1800);
}

function showMessage(message) {
  $("#copyMessage").textContent = message;
  setTimeout(() => {
    $("#copyMessage").textContent = "";
  }, 2200);
}

let confirmCallback = null;

function openConfirm(title, text, callback) {
  $("#confirmTitle").textContent = title;
  $("#confirmText").textContent = text;
  confirmCallback = callback;
  $("#confirmModal").classList.remove("hidden");
}

function closeConfirm() {
  $("#confirmModal").classList.add("hidden");
  confirmCallback = null;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value);
}

$("#settingsBtn").addEventListener("click", openSettings);
$("#previewBtn").addEventListener("click", togglePreview);
$("#addNewBtn").addEventListener("click", addNewPerson);
$("#addReasonBtn").addEventListener("click", addReason);
$("#copyBtn").addEventListener("click", copyReport);
$("#resetBtn").addEventListener("click", resetToday);
$("#addCompanyBtn").addEventListener("click", addCompany);
$("#saveSettingsBtn").addEventListener("click", saveSettingsAndClose);
$("#restoreDefaultsBtn").addEventListener("click", restoreDefaults);

document.querySelectorAll("[data-close='settings']").forEach(el => {
  el.addEventListener("click", closeSettings);
});

$("#confirmCancel").addEventListener("click", closeConfirm);
$("#confirmOk").addEventListener("click", () => {
  if (typeof confirmCallback === "function") confirmCallback();
  closeConfirm();
});

render();
