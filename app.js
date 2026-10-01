(function () {
  "use strict";

  // ---------------------------------------------------------------------------
  // 상수
  // ---------------------------------------------------------------------------

  const STORAGE_KEYS = {
    todos: "todo-app:v1:todos",
    settings: "todo-app:v1:settings",
  };

  const CATEGORIES = {
    work: "업무",
    personal: "개인",
    study: "공부",
  };

  const FILTERS = ["all", "work", "personal", "study"];
  const MAX_LENGTH = 100;
  const DEFAULT_SETTINGS = { filter: "all", lastCategory: "work" };

  const els = {
    form: document.getElementById("add-form"),
    input: document.getElementById("new-todo-text"),
    category: document.getElementById("new-todo-category"),
    filters: document.getElementById("filters"),
    list: document.getElementById("todo-list"),
    empty: document.getElementById("empty-state"),
    percent: document.getElementById("progress-percent"),
    count: document.getElementById("progress-count"),
    bar: document.getElementById("progress-bar"),
    fill: document.getElementById("progress-fill"),
  };

  // ---------------------------------------------------------------------------
  // 상태
  // ---------------------------------------------------------------------------

  let todos = loadTodos();
  let settings = loadSettings();
  let editingId = null;
  // 다음 render() 뒤에 포커스를 줄 대상. { id, action } 또는 { input: true }
  let pendingFocus = null;
  // 한글 입력(IME) 조합 중에 Enter가 눌려 중복 처리되는 것을 막는다.
  let isComposing = false;

  // ---------------------------------------------------------------------------
  // 저장소 (localStorage)
  // ---------------------------------------------------------------------------

  function readStorage(key) {
    let raw;
    try {
      raw = localStorage.getItem(key);
    } catch (err) {
      console.warn(`[todo-app] localStorage를 읽을 수 없습니다 (${key})`, err);
      return null;
    }
    if (raw === null) return null;
    try {
      return JSON.parse(raw);
    } catch (err) {
      console.warn(`[todo-app] 저장된 데이터가 손상되어 무시합니다 (${key})`, err);
      return null;
    }
  }

  function writeStorage(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (err) {
      console.warn(`[todo-app] localStorage에 저장할 수 없습니다 (${key})`, err);
    }
  }

  function isCategory(value) {
    return Object.prototype.hasOwnProperty.call(CATEGORIES, value);
  }

  function isValidTodo(item) {
    return (
      item !== null &&
      typeof item === "object" &&
      typeof item.id === "string" &&
      item.id !== "" &&
      typeof item.text === "string" &&
      item.text.trim() !== "" &&
      isCategory(item.category)
    );
  }

  function normalizeTodo(item) {
    const completed = item.completed === true;
    return {
      id: item.id,
      text: cleanText(item.text),
      category: item.category,
      completed,
      createdAt: Number.isFinite(item.createdAt) ? item.createdAt : 0,
      completedAt: completed && Number.isFinite(item.completedAt) ? item.completedAt : null,
    };
  }

  function loadTodos() {
    const data = readStorage(STORAGE_KEYS.todos);
    if (data === null) return [];
    if (!Array.isArray(data)) {
      console.warn("[todo-app] 저장된 할 일 목록의 형식이 올바르지 않아 빈 목록으로 시작합니다.");
      return [];
    }
    const valid = data.filter(isValidTodo).map(normalizeTodo);
    if (valid.length !== data.length) {
      console.warn(`[todo-app] 형식이 잘못된 할 일 ${data.length - valid.length}개를 건너뛰었습니다.`);
    }
    return valid;
  }

  function saveTodos(list) {
    writeStorage(STORAGE_KEYS.todos, list);
  }

  function loadSettings() {
    const data = readStorage(STORAGE_KEYS.settings);
    const result = { ...DEFAULT_SETTINGS };
    if (data !== null && typeof data === "object") {
      if (FILTERS.includes(data.filter)) result.filter = data.filter;
      if (isCategory(data.lastCategory)) result.lastCategory = data.lastCategory;
    }
    return result;
  }

  function saveSettings(value) {
    writeStorage(STORAGE_KEYS.settings, value);
  }

  // ---------------------------------------------------------------------------
  // 상태 변경 — 모든 변경은 updateTodos()를 거쳐 저장 → 렌더링한다.
  // ---------------------------------------------------------------------------

  function updateTodos(newTodos) {
    todos = newTodos;
    saveTodos(todos);
    render();
  }

  function updateSettings(changes) {
    settings = { ...settings, ...changes };
    saveSettings(settings);
  }

  function createId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function cleanText(text) {
    return String(text).trim().slice(0, MAX_LENGTH);
  }

  function addTodo(text, category) {
    const clean = cleanText(text);
    if (clean === "" || !isCategory(category)) return false;
    updateTodos([
      ...todos,
      {
        id: createId(),
        text: clean,
        category,
        completed: false,
        createdAt: Date.now(),
        completedAt: null,
      },
    ]);
    return true;
  }

  function updateTodo(id, changes) {
    updateTodos(todos.map((todo) => (todo.id === id ? { ...todo, ...changes } : todo)));
  }

  function toggleTodo(id) {
    updateTodos(
      todos.map((todo) => {
        if (todo.id !== id) return todo;
        const completed = !todo.completed;
        return { ...todo, completed, completedAt: completed ? Date.now() : null };
      })
    );
  }

  function deleteTodo(id) {
    updateTodos(todos.filter((todo) => todo.id !== id));
  }

  // ---------------------------------------------------------------------------
  // 조회
  // ---------------------------------------------------------------------------

  function getProgress(list) {
    const total = list.length;
    const done = list.filter((todo) => todo.completed).length;
    const percent = total === 0 ? 0 : Math.round((done / total) * 100);
    return { done, total, percent };
  }

  function filterByCategory(list, filter) {
    return filter === "all" ? list : list.filter((todo) => todo.category === filter);
  }

  // 미완료가 위, 완료가 아래. 같은 그룹 안에서는 생성(배열) 순서를 유지한다.
  function getVisibleTodos() {
    return filterByCategory(todos, settings.filter)
      .slice()
      .sort((a, b) => Number(a.completed) - Number(b.completed));
  }

  function findTodo(id) {
    return todos.find((todo) => todo.id === id);
  }

  // ---------------------------------------------------------------------------
  // 렌더링
  // ---------------------------------------------------------------------------

  function render() {
    const focusTarget = pendingFocus || getCurrentFocus();
    pendingFocus = null;

    renderProgress();
    renderFilters();
    renderList();

    restoreFocus(focusTarget);
  }

  function renderProgress() {
    const { done, total, percent } = getProgress(todos);
    els.percent.textContent = `${percent}%`;
    els.count.textContent = `(${done}/${total} 완료)`;
    els.fill.style.width = `${percent}%`;
    els.bar.setAttribute("aria-valuenow", String(percent));
    els.bar.setAttribute("aria-valuetext", `${percent}%, ${total}개 중 ${done}개 완료`);
  }

  function renderFilters() {
    els.filters.querySelectorAll("[data-filter]").forEach((tab) => {
      const filter = tab.dataset.filter;
      const { done, total } = getProgress(filterByCategory(todos, filter));
      tab.querySelector(".filter-count").textContent = `${done}/${total}`;
      tab.setAttribute("aria-pressed", String(filter === settings.filter));
    });
  }

  function renderList() {
    const visible = getVisibleTodos();
    els.list.replaceChildren(
      ...visible.map((todo) => (todo.id === editingId ? createEditItem(todo) : createTodoItem(todo)))
    );

    if (todos.length === 0) {
      els.empty.textContent = "할 일을 추가해 보세요";
      els.empty.hidden = false;
    } else if (visible.length === 0) {
      els.empty.textContent = "이 카테고리에는 할 일이 없어요";
      els.empty.hidden = false;
    } else {
      els.empty.hidden = true;
    }
  }

  function createElement(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    // 사용자 입력은 항상 textContent로 넣는다 (XSS 방지).
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function createButton(label, action, ariaLabel, className = "btn") {
    const button = createElement("button", className, label);
    button.type = "button";
    button.dataset.action = action;
    if (ariaLabel) button.setAttribute("aria-label", ariaLabel);
    return button;
  }

  function createBadge(category) {
    return createElement("span", `badge badge--${category}`, CATEGORIES[category]);
  }

  function createCategorySelect(selected) {
    const select = createElement("select", "category-select edit-category");
    select.setAttribute("aria-label", "카테고리");
    Object.entries(CATEGORIES).forEach(([value, label]) => {
      const option = createElement("option", "", label);
      option.value = value;
      select.append(option);
    });
    select.value = selected;
    return select;
  }

  function createTodoItem(todo) {
    const item = createElement("li", todo.completed ? "todo-item is-completed" : "todo-item");
    item.dataset.id = todo.id;

    const checkbox = createElement("input", "todo-toggle");
    checkbox.type = "checkbox";
    checkbox.checked = todo.completed;
    checkbox.dataset.action = "toggle";
    checkbox.setAttribute("aria-label", `${todo.text} 완료`);

    const text = createElement("span", "todo-text", todo.text);
    text.dataset.action = "edit-text";
    text.title = "더블클릭해서 수정";

    const actions = createElement("div", "todo-actions");
    actions.append(
      createButton("수정", "edit", `${todo.text} 수정`),
      createButton("삭제", "delete", `${todo.text} 삭제`, "btn btn-danger")
    );

    item.append(checkbox, createBadge(todo.category), text, actions);
    return item;
  }

  function createEditItem(todo) {
    const item = createElement("li", "todo-item is-editing");
    item.dataset.id = todo.id;

    const form = createElement("form", "edit-form");

    const input = createElement("input", "edit-input");
    input.type = "text";
    input.maxLength = MAX_LENGTH;
    input.value = todo.text;
    input.dataset.action = "edit-input";
    input.setAttribute("aria-label", "할 일 내용 수정");

    const save = createElement("button", "btn btn-primary", "저장");
    save.type = "submit";
    save.dataset.action = "save";

    form.append(input, createCategorySelect(todo.category), save, createButton("취소", "cancel"));
    item.append(form);
    return item;
  }

  // 렌더링 전후로 같은 할 일의 같은 컨트롤에 포커스를 유지한다.
  function getCurrentFocus() {
    const active = document.activeElement;
    if (!active || !els.list.contains(active)) return null;
    const item = active.closest("[data-id]");
    return item ? { id: item.dataset.id, action: active.dataset.action } : null;
  }

  function findItem(id) {
    return Array.from(els.list.children).find((item) => item.dataset.id === id) || null;
  }

  function restoreFocus(target) {
    if (!target) return;
    if (target.input) {
      els.input.focus();
      return;
    }
    const item = findItem(target.id);
    const control = item && target.action && item.querySelector(`[data-action="${target.action}"]`);
    if (control) {
      control.focus();
    } else {
      // 필터 때문에 항목이 사라진 경우 등에는 입력창으로 보낸다.
      els.input.focus();
    }
  }

  // ---------------------------------------------------------------------------
  // 수정 (편집 모드)
  // ---------------------------------------------------------------------------

  function startEdit(id) {
    if (editingId === id) return;
    if (editingId !== null) commitEdit(null);
    if (!findTodo(id)) return;

    editingId = id;
    pendingFocus = { id, action: "edit-input" };
    render();

    const input = els.list.querySelector(".edit-input");
    if (input) input.setSelectionRange(input.value.length, input.value.length);
  }

  // focusAfter: 저장 후 포커스 대상. 생략하면 해당 항목의 수정 버튼으로 돌아간다.
  function commitEdit(focusAfter) {
    if (editingId === null) return;
    const id = editingId;
    const item = findItem(id);
    editingId = null;
    pendingFocus = focusAfter === undefined ? { id, action: "edit" } : focusAfter;

    if (!item) {
      render();
      return;
    }

    const text = cleanText(item.querySelector(".edit-input").value);
    const category = item.querySelector(".edit-category").value;
    if (text !== "" && isCategory(category)) {
      updateTodo(id, { text, category });
    } else {
      // 내용을 모두 지운 경우에는 이전 내용을 유지한다.
      render();
    }
  }

  function cancelEdit() {
    if (editingId === null) return;
    const id = editingId;
    editingId = null;
    pendingFocus = { id, action: "edit" };
    render();
  }

  // ---------------------------------------------------------------------------
  // 삭제
  // ---------------------------------------------------------------------------

  function handleDelete(id) {
    const todo = findTodo(id);
    if (!todo) return;
    if (!window.confirm(`"${todo.text}" 할 일을 삭제할까요?`)) return;

    const visible = getVisibleTodos();
    const index = visible.findIndex((t) => t.id === id);
    const neighbor = visible[index + 1] || visible[index - 1];
    pendingFocus = neighbor ? { id: neighbor.id, action: "delete" } : { input: true };
    deleteTodo(id);
  }

  // ---------------------------------------------------------------------------
  // 이벤트
  // ---------------------------------------------------------------------------

  document.addEventListener("compositionstart", () => {
    isComposing = true;
  });
  document.addEventListener("compositionend", () => {
    isComposing = false;
  });

  els.form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (isComposing) return;
    addTodo(els.input.value, els.category.value);
    // 추가에 성공했거나 공백만 입력한 경우 모두 입력창을 비운다.
    els.input.value = "";
    els.input.focus();
  });

  els.category.addEventListener("change", () => {
    updateSettings({ lastCategory: els.category.value });
  });

  els.filters.addEventListener("click", (event) => {
    const tab = event.target.closest("[data-filter]");
    if (!tab) return;
    updateSettings({ filter: tab.dataset.filter });
    render();
  });

  els.list.addEventListener("change", (event) => {
    if (event.target.dataset.action !== "toggle") return;
    const item = event.target.closest("[data-id]");
    if (item) toggleTodo(item.dataset.id);
  });

  els.list.addEventListener("click", (event) => {
    const control = event.target.closest("[data-action]");
    const item = event.target.closest("[data-id]");
    if (!control || !item) return;

    switch (control.dataset.action) {
      case "edit":
        startEdit(item.dataset.id);
        break;
      case "delete":
        handleDelete(item.dataset.id);
        break;
      case "cancel":
        cancelEdit();
        break;
      default:
        break;
    }
  });

  els.list.addEventListener("dblclick", (event) => {
    if (event.target.dataset.action !== "edit-text") return;
    const item = event.target.closest("[data-id]");
    if (item) startEdit(item.dataset.id);
  });

  // 저장/취소 버튼을 누를 때 입력창의 포커스를 유지한다.
  // (Safari는 버튼 클릭 시 포커스를 옮기지 않아, blur 저장이 먼저 일어나 취소가 무시될 수 있다.)
  els.list.addEventListener("mousedown", (event) => {
    if (event.target.closest('[data-action="save"], [data-action="cancel"]')) {
      event.preventDefault();
    }
  });

  els.list.addEventListener("submit", (event) => {
    event.preventDefault();
    if (isComposing) return;
    commitEdit();
  });

  els.list.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || editingId === null) return;
    if (event.isComposing || isComposing) return;
    event.preventDefault();
    cancelEdit();
  });

  // 편집 중인 항목 밖으로 포커스가 나가면 저장한다.
  els.list.addEventListener("focusout", (event) => {
    if (editingId === null) return;
    const item = event.target.closest(".is-editing");
    if (!item || item.contains(event.relatedTarget)) return;
    commitEdit(getFocusDescriptor(event.relatedTarget));
  });

  function getFocusDescriptor(node) {
    if (!node || !els.list.contains(node)) return null;
    const item = node.closest("[data-id]");
    return item ? { id: item.dataset.id, action: node.dataset.action } : null;
  }

  // ---------------------------------------------------------------------------
  // 시작
  // ---------------------------------------------------------------------------

  els.input.maxLength = MAX_LENGTH;
  els.category.value = settings.lastCategory;
  render();
})();
