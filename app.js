// =====================
// STATE
// =====================
let questions = [];
let current = 0;
let selected = new Set();
let answered = []; // 'correct' | 'wrong' | null per question
let userAnswers = []; // the actual keys the user picked per question
let submitted = false;

// =====================
// INIT — load manifest
// =====================
async function init() {
  try {
    const res = await fetch("exams.json");
    const manifest = await res.json();
    renderHomepage(manifest);
  } catch (e) {
    document.getElementById("categories").innerHTML =
      '<div class="loading-placeholder">Failed to load exams.json</div>';
  }
}

// =====================
// HOME PAGE
// =====================
function renderHomepage(manifest) {
  const container = document.getElementById("categories");
  container.innerHTML = "";

  manifest.forEach((category) => {
    const block = document.createElement("div");
    block.className = "category-block";
    block.innerHTML = `
      <div class="category-header">
        <span class="category-icon">${category.icon}</span>
        <span class="category-name">${category.category}</span>
        <span class="category-count">${category.exams.length} exam${category.exams.length !== 1 ? "s" : ""}</span>
      </div>
      <div class="exam-list"></div>
    `;
    container.appendChild(block);

    const list = block.querySelector(".exam-list");
    category.exams.forEach((exam) => {
      const card = document.createElement("div");
      card.className = "exam-card";
      card.innerHTML = `
        <div class="exam-card-title">${exam.title}</div>
        <div class="exam-card-meta">Loading…</div>
        <div class="exam-card-arrow">→</div>
      `;
      card.onclick = () => loadAndStartExam(exam);
      list.appendChild(card);

      // Preload question count in background
      fetch(exam.file)
        .then((r) => r.json())
        .then((data) => {
          exam._cached = data;
          card.querySelector(".exam-card-meta").textContent =
            `${data.length} questions`;
        })
        .catch(() => {
          card.querySelector(".exam-card-meta").textContent = "unavailable";
          card.style.opacity = "0.4";
          card.style.pointerEvents = "none";
        });
    });
  });
}

async function loadAndStartExam(exam) {
  try {
    const data = exam._cached || (await fetch(exam.file).then((r) => r.json()));
    exam._cached = data;
    startExam(data);
  } catch (e) {
    alert("Could not load: " + exam.file);
  }
}

function goHome() {
  showPage("home-page");
}

// =====================
// PAGE SWITCHER
// =====================
function showPage(id) {
  ["home-page", "exam-page", "results-page"].forEach((p) => {
    const el = document.getElementById(p);
    el.style.display = "none";
  });
  const target = document.getElementById(id);
  target.style.display =
    id === "home-page" ? "flex" : id === "results-page" ? "flex" : "block";
}

// =====================
// EXAM ENGINE
// =====================
function startExam(data) {
  questions = data;
  current = 0;
  selected.clear();
  answered = new Array(questions.length).fill(null);
  userAnswers = new Array(questions.length).fill(null);
  submitted = false;

  document.getElementById("counter-total").textContent = questions.length;
  showPage("exam-page");
  buildBreadcrumbs();
  renderQuestion();
}

function buildBreadcrumbs() {
  const track = document.getElementById("breadcrumb-track");
  track.innerHTML = "";
  questions.forEach((_, i) => {
    const crumb = document.createElement("div");
    crumb.className = "crumb" + (i === current ? " current" : "");
    crumb.title = `Question ${i + 1}`;
    crumb.onclick = () => {
      if (answered[i] !== null) jumpTo(i);
    };
    track.appendChild(crumb);
  });
}

function updateBreadcrumbs() {
  document.querySelectorAll(".crumb").forEach((c, i) => {
    c.className = "crumb";
    if (i === current) c.classList.add("current");
    else if (answered[i] === "correct") c.classList.add("done");
    else if (answered[i] === "wrong") c.classList.add("wrong");
  });
}

function jumpTo(i) {
  current = i;
  renderQuestion();
}

function renderQuestion() {
  const q = questions[current];
  submitted = false;
  selected.clear();

  document.getElementById("q-number").textContent =
    `Question ${String(current + 1).padStart(2, "0")}`;
  document.getElementById("counter-current").textContent = current + 1;

  const isMulti = q.question_type === "multiple_answers";
  const badge = document.getElementById("q-type-badge");
  badge.className = "q-type-badge " + (isMulti ? "multi" : "single");
  badge.textContent = isMulti ? "Select all that apply" : "Single answer";

  const qText = q.question
    .replace(/\n+Choose only ONE best answer\.?$/i, "")
    .replace(/\n+Choose all that apply\.?$/i, "")
    .trim();
  document.getElementById("question-text").textContent = qText;

  const list = document.getElementById("options-list");
  list.innerHTML = "";

  Object.entries(q.options).forEach(([key, text]) => {
    const item = document.createElement("div");
    item.className = "option-item" + (isMulti ? " checkbox" : "");
    item.dataset.key = key;
    item.onclick = () => toggleOption(key, isMulti, item);

    const control = document.createElement("div");
    control.className = "option-control";
    const dot = document.createElement("div");
    dot.className = "option-dot";
    const check = document.createElement("div");
    check.className = "option-check";
    control.appendChild(dot);
    control.appendChild(check);

    const keyEl = document.createElement("span");
    keyEl.className = "option-key";
    keyEl.textContent = key + ".";

    const textEl = document.createElement("span");
    textEl.className = "option-text";
    textEl.textContent = text;

    item.appendChild(control);
    item.appendChild(keyEl);
    item.appendChild(textEl);
    list.appendChild(item);
  });

  document.getElementById("result-banner").style.display = "none";
  document.getElementById("explanation-box").style.display = "none";
  document.getElementById("submit-btn").style.display = "inline-flex";
  document.getElementById("submit-btn").disabled = true;
  document.getElementById("next-btn").style.display = "none";

  document.getElementById("progress-fill").style.width =
    (current / questions.length) * 100 + "%";
  updateBreadcrumbs();
  window.scrollTo(0, 0);
}

function toggleOption(key, isMulti, itemEl) {
  if (submitted) return;
  if (!isMulti) {
    selected.clear();
    document
      .querySelectorAll(".option-item")
      .forEach((el) => el.classList.remove("selected"));
  }
  if (selected.has(key) && isMulti) {
    selected.delete(key);
    itemEl.classList.remove("selected");
  } else {
    selected.add(key);
    itemEl.classList.add("selected");
  }
  document.getElementById("submit-btn").disabled = selected.size === 0;
}

function submitAnswer() {
  if (selected.size === 0) return;
  submitted = true;

  const q = questions[current];
  const correctAnswers = q.correct_answer.split(",").map((a) => a.trim());
  const selectedArr = Array.from(selected).sort();
  const isCorrect =
    selectedArr.length === correctAnswers.length &&
    selectedArr.every((a) => correctAnswers.includes(a));

  answered[current] = isCorrect ? "correct" : "wrong";
  userAnswers[current] = [...selectedArr];

  document.querySelectorAll(".option-item").forEach((item) => {
    const key = item.dataset.key;
    item.classList.add("disabled");
    const check = item.querySelector(".option-check");

    if (correctAnswers.includes(key) && selected.has(key)) {
      item.classList.remove("selected");
      item.classList.add("correct");
      check.textContent = "✓";
    } else if (selected.has(key) && !correctAnswers.includes(key)) {
      item.classList.remove("selected");
      item.classList.add("wrong");
      check.textContent = "✗";
    } else if (correctAnswers.includes(key) && !selected.has(key)) {
      item.classList.add("missed");
      check.textContent = "↑";
    }
  });

  const banner = document.getElementById("result-banner");
  banner.className = "result-banner " + (isCorrect ? "correct" : "incorrect");
  banner.style.display = "block";
  document.getElementById("result-label").innerHTML = isCorrect
    ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Correct!'
    : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> Incorrect';
  document.getElementById("result-correct-ans").textContent = !isCorrect
    ? "Correct answer: " + correctAnswers.join(", ")
    : "";

  document.getElementById("explanation-text").textContent = q.explanation;
  document.getElementById("explanation-box").style.display = "block";
  document.getElementById("submit-btn").style.display = "none";

  const nextBtn = document.getElementById("next-btn");
  nextBtn.style.display = "inline-flex";
  nextBtn.innerHTML =
    current < questions.length - 1
      ? 'Next <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>'
      : "📊 View Results";

  updateBreadcrumbs();
}

function nextQuestion() {
  if (current === questions.length - 1) {
    showResults();
    return;
  }
  current++;
  renderQuestion();
}

// =====================
// RESULTS PAGE
// =====================
function showResults() {
  const total = questions.length;
  const correct = answered.filter((a) => a === "correct").length;
  const wrong = total - correct;
  const pct = Math.round((correct / total) * 100);

  // Score ring
  const radius = 65;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;
  const ringColor =
    pct >= 70 ? "var(--green)" : pct >= 50 ? "var(--yellow)" : "var(--red)";

  document.getElementById("score-pct").textContent = pct + "%";
  document.getElementById("score-sub").textContent = `${correct} / ${total}`;

  const fill = document.getElementById("score-ring-fill");
  fill.style.stroke = ringColor;
  fill.style.strokeDasharray = circumference;
  fill.style.strokeDashoffset = circumference; // start at 0
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      fill.style.strokeDashoffset = offset;
    });
  });

  // Stats
  document.getElementById("rstat-correct").textContent = correct;
  document.getElementById("rstat-wrong").textContent = wrong;
  document.getElementById("rstat-total").textContent = total;

  // Grade message
  let grade = "";
  if (pct >= 80) grade = "Excellent work! 🎉";
  else if (pct >= 70) grade = "Good effort! Keep studying.";
  else if (pct >= 50) grade = "Getting there — review the mistakes below.";
  else grade = "Keep practicing — you'll get there.";
  document.getElementById("results-grade").textContent = grade;

  // Wrong answers list
  const wrongList = document.getElementById("wrong-answers-list");
  wrongList.innerHTML = "";

  const wrongQuestions = questions
    .map((q, i) => ({ q, i, result: answered[i], picked: userAnswers[i] }))
    .filter((x) => x.result === "wrong");

  if (wrongQuestions.length === 0) {
    wrongList.innerHTML =
      '<div class="loading-placeholder" style="color:var(--green)">🎯 Perfect score — no wrong answers!</div>';
  } else {
    wrongQuestions.forEach(({ q, i, picked }) => {
      const correctAnswers = q.correct_answer.split(",").map((a) => a.trim());
      const qText = q.question
        .replace(/\n+Choose only ONE best answer\.?$/i, "")
        .replace(/\n+Choose all that apply\.?$/i, "")
        .trim();

      const item = document.createElement("div");
      item.className = "wrong-item";
      item.innerHTML = `
        <div class="wrong-item-header" onclick="toggleWrongItem(this)">
          <span class="wrong-q-num">Q${String(i + 1).padStart(2, "0")}</span>
          <span class="wrong-q-text">${qText}</span>
          <svg class="wrong-item-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
        </div>
        <div class="wrong-item-body">
          <div class="wrong-answers-row">
            <div class="wrong-ans-block">
              <span class="wrong-ans-label">Your answer</span>
              <span class="wrong-ans-val your">${picked ? picked.join(", ") : "—"}</span>
            </div>
            <div class="wrong-ans-block">
              <span class="wrong-ans-label">Correct answer</span>
              <span class="wrong-ans-val correct">${correctAnswers.join(", ")}</span>
            </div>
          </div>
          <div class="wrong-explanation">${q.explanation}</div>
        </div>
      `;
      wrongList.appendChild(item);
    });
  }

  showPage("results-page");
  window.scrollTo(0, 0);
}

function toggleWrongItem(header) {
  const item = header.closest(".wrong-item");
  item.classList.toggle("open");
}

// =====================
// BOOT
// =====================
init();
