// ─── Safe localStorage wrapper ───────────────────────────────────────────────
const store = (() => {
    let mem = {};
    return {
        get(k) {
            try { const v = localStorage.getItem(k); return v !== null ? v : (mem[k] ?? null); }
            catch { return mem[k] ?? null; }
        },
        set(k, v) {
            mem[k] = v;
            try { localStorage.setItem(k, v); } catch {}
        },
        remove(k) {
            delete mem[k];
            try { localStorage.removeItem(k); } catch {}
        }
    };
})();

class TodoApp {
    constructor() {
        this.tasks             = [];
        this.currentSubtasks   = [];
        this.selectedTaskId    = null;
        this.isDarkMode        = false;
        this.activeFilter      = 'all';
        this.activeCategoryNav = null;

        // Load & sanitize persisted tasks — drop any entry missing required fields
        try {
            const raw = JSON.parse(store.get('tasks') || '[]');
            this.tasks = Array.isArray(raw)
                ? raw.filter(t =>
                    t &&
                    typeof t.id   !== 'undefined' &&
                    typeof t.text === 'string'     &&
                    t.text.trim() !== ''
                  )
                : [];
        } catch {
            this.tasks = [];
        }

        try { this.isDarkMode = store.get('darkMode') === 'true'; } catch {}

        this.init();
    }

    // ── Bootstrap ────────────────────────────────────────────────────────────
    init() {
        this.applyDarkMode();
        this.renderTasks();
        this.updateProgress();
        this.updateSidebarCounts();

        this.on('darkModeToggle', 'click',    () => this.toggleDarkMode());
        this.on('addTaskBtn',     'click',    () => this.addTask());
        this.on('newTask',        'keypress', e  => { if (e.key === 'Enter') this.addTask(); });
        this.on('addSubtaskBtn',  'click',    () => this.addSubtask());
        this.on('subtaskInput',   'keypress', e  => { if (e.key === 'Enter') { e.preventDefault(); this.addSubtask(); } });
        this.on('searchInput',    'input',    () => this.renderTasks());
        this.on('priorityFilter', 'change',   () => this.renderTasks());
        this.on('categoryFilter', 'change',   () => this.renderTasks());
        this.on('sortBy',         'change',   () => this.renderTasks());
        this.on('editTaskBtn',    'click',    () => this.editTask());
        this.on('markDoneBtn',    'click',    () => this.markAsDone());
        this.on('removeTaskBtn',  'click',    () => this.removeTask());
        this.on('deselectBtn',    'click',    () => this.deselectTask());

        document.querySelectorAll('.nav-item[data-filter]').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.activeFilter      = btn.dataset.filter;
                this.activeCategoryNav = null;
                this.renderTasks();
            });
        });

        document.querySelectorAll('.nav-item[data-category]').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.activeCategoryNav = btn.dataset.category;
                this.activeFilter      = null;
                this.renderTasks();
            });
        });

        this.checkDueDates();
        setInterval(() => this.checkDueDates(), 60000);
    }

    on(id, event, handler) {
        const el = document.getElementById(id);
        if (el) el.addEventListener(event, handler);
    }

    // ── Dark mode ────────────────────────────────────────────────────────────
    toggleDarkMode() {
        this.isDarkMode = !this.isDarkMode;
        store.set('darkMode', this.isDarkMode);
        this.applyDarkMode();
    }

    applyDarkMode() {
        document.documentElement.setAttribute('data-theme', this.isDarkMode ? 'dark' : 'light');
        const icon  = document.getElementById('themeIcon');
        const label = document.getElementById('themeLabel');
        if (icon)  icon.className    = this.isDarkMode ? 'fas fa-sun'  : 'fas fa-moon';
        if (label) label.textContent = this.isDarkMode ? 'Light mode'  : 'Dark mode';
    }

    // ── Subtasks (form) ──────────────────────────────────────────────────────
    addSubtask() {
        const input = document.getElementById('subtaskInput');
        if (!input) return;
        const text = input.value.trim();
        if (!text) return;
        this.currentSubtasks.push({ id: Date.now() + Math.random(), text, completed: false });
        input.value = '';
        this.renderSubtaskChips();
    }

    removeSubtask(id) {
        this.currentSubtasks = this.currentSubtasks.filter(s => s.id !== id);
        this.renderSubtaskChips();
    }

    renderSubtaskChips() {
        const list = document.getElementById('subtasksList');
        if (!list) return;
        list.innerHTML = '';
        this.currentSubtasks.forEach(s => {
            const chip = document.createElement('div');
            chip.className = 'subtask-chip';
            chip.innerHTML = `<span>${s.text}</span>
                <button type="button" onclick="todoApp.removeSubtask(${s.id})">
                    <i class="fas fa-xmark"></i>
                </button>`;
            list.appendChild(chip);
        });
    }

    // ── Add task ─────────────────────────────────────────────────────────────
    addTask() {
        const nameEl = document.getElementById('newTask');
        if (!nameEl) return;
        const text = nameEl.value.trim();
        if (!text) {
            this.showNotification('Please enter a task name.', 'error');
            return;
        }

        const task = {
            id:                Date.now() + Math.random(),
            text,
            dueDate:           document.getElementById('dueDate')?.value    || null,
            priority:          document.getElementById('priority')?.value   || 'low',
            category:          document.getElementById('category')?.value   || 'work',
            subtasks:          [...this.currentSubtasks],
            completed:         false,
            dateCreated:       new Date().toISOString(),
            completedSubtasks: 0
        };

        this.tasks.push(task);
        this.saveTasks();
        this.renderTasks();
        this.updateProgress();
        this.updateSidebarCounts();

        // Reset form
        nameEl.value = '';
        const due = document.getElementById('dueDate');      if (due)  due.value      = '';
        const pri = document.getElementById('priority');     if (pri)  pri.value      = 'low';
        const cat = document.getElementById('category');     if (cat)  cat.value      = 'work';
        this.currentSubtasks = [];
        this.renderSubtaskChips();

        this.showNotification('Task added!', 'success');
    }

    // ── Select / deselect ────────────────────────────────────────────────────
    selectTask(id) {
        if (this.selectedTaskId === id) { this.deselectTask(); return; }
        this.selectedTaskId = id;
        this.renderTasks();
        document.getElementById('actionBar')?.classList.add('visible');
    }

    deselectTask() {
        this.selectedTaskId = null;
        this.renderTasks();
        document.getElementById('actionBar')?.classList.remove('visible');
    }

    // ── Edit ─────────────────────────────────────────────────────────────────
    editTask() {
        if (!this.selectedTaskId) { this.showWarning(); return; }
        const task = this.tasks.find(t => t.id === this.selectedTaskId);
        if (!task) return;

        document.getElementById('newTask').value  = task.text;
        document.getElementById('dueDate').value  = task.dueDate  || '';
        document.getElementById('priority').value = task.priority;
        document.getElementById('category').value = task.category;
        this.currentSubtasks = [...(task.subtasks || [])];
        this.renderSubtaskChips();

        this.tasks = this.tasks.filter(t => t.id !== this.selectedTaskId);
        this.saveTasks();
        this.deselectTask();
        this.updateProgress();
        this.updateSidebarCounts();
        this.showNotification('Task loaded for editing. Click Add Task to save.', 'warning');
    }

    // ── Mark done ────────────────────────────────────────────────────────────
    markAsDone() {
        if (!this.selectedTaskId) { this.showWarning(); return; }
        const task = this.tasks.find(t => t.id === this.selectedTaskId);
        if (!task) return;
        task.completed = !task.completed;
        this.saveTasks();
        this.deselectTask();
        this.updateProgress();
        this.updateSidebarCounts();
        this.showNotification(task.completed ? 'Task completed! 🎉' : 'Task marked incomplete.', 'success');
    }

    // ── Remove ───────────────────────────────────────────────────────────────
    removeTask() {
        if (!this.selectedTaskId) { this.showWarning(); return; }
        this.tasks = this.tasks.filter(t => t.id !== this.selectedTaskId);
        this.saveTasks();
        this.deselectTask();
        this.updateProgress();
        this.updateSidebarCounts();
        this.showNotification('Task removed.', 'success');
    }

    // ── Toggle subtask checkbox ───────────────────────────────────────────────
    toggleSubtask(taskId, subtaskId) {
        const task = this.tasks.find(t => t.id === taskId);
        if (!task) return;
        const sub = task.subtasks.find(s => s.id === subtaskId);
        if (!sub) return;
        sub.completed = !sub.completed;
        task.completedSubtasks = task.subtasks.filter(s => s.completed).length;
        this.saveTasks();
        this.renderTasks();
    }

    // ── Filter / sort ─────────────────────────────────────────────────────────
    getFilteredTasks() {
        const search   = (document.getElementById('searchInput')?.value   || '').toLowerCase();
        const priority = document.getElementById('priorityFilter')?.value || 'all';
        const category = document.getElementById('categoryFilter')?.value || 'all';
        const sort     = document.getElementById('sortBy')?.value         || 'dateCreated';
        const now      = new Date();
        const today    = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        let list = this.tasks.filter(t => {
            // Guard: skip any task without a valid text field
            if (!t || typeof t.text !== 'string') return false;

            if (!t.text.toLowerCase().includes(search)) return false;
            if (priority !== 'all' && t.priority !== priority) return false;
            if (category !== 'all' && t.category !== category) return false;

            if (this.activeCategoryNav) return t.category === this.activeCategoryNav;
            if (this.activeFilter === 'completed') return t.completed;
            if (this.activeFilter === 'overdue')   return !t.completed && t.dueDate && new Date(t.dueDate) < today;
            if (this.activeFilter === 'today')     return t.dueDate && new Date(t.dueDate + 'T00:00:00').toDateString() === today.toDateString();
            return true;
        });

        list.sort((a, b) => {
            if (sort === 'dueDate') {
                if (!a.dueDate && !b.dueDate) return 0;
                if (!a.dueDate) return 1;
                if (!b.dueDate) return -1;
                return new Date(a.dueDate) - new Date(b.dueDate);
            }
            if (sort === 'priority') {
                const o = { high: 3, medium: 2, low: 1 };
                return (o[b.priority] || 0) - (o[a.priority] || 0);
            }
            if (sort === 'name')
            return (a.text ?? "").localeCompare(b.text ?? "");
            return new Date(b.dateCreated) - new Date(a.dateCreated);
        });

        return list;
    }

    // ── Render ────────────────────────────────────────────────────────────────
    renderTasks() {
        const taskList = document.getElementById('taskList');
        const noMsg    = document.getElementById('noTasksMessage');
        if (!taskList || !noMsg) return;

        const tasks = this.getFilteredTasks();
        const now   = new Date();
        taskList.innerHTML = '';

        if (tasks.length === 0) { noMsg.style.display = 'block'; return; }
        noMsg.style.display = 'none';

        const dots  = { high: '🔴', medium: '🟡', low: '🟢' };
        const icons = { work: '💼', personal: '👤', shopping: '🛍️', health: '❤️', other: '✨' };

        tasks.forEach(task => {
            const li = document.createElement('li');
            li.className = 'task'
                + (task.completed              ? ' done'     : '')
                + (task.id === this.selectedTaskId ? ' selected' : '');

            const dueText  = task.dueDate
                ? new Date(task.dueDate + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
                : null;
            const isOverdue = task.dueDate && new Date(task.dueDate + 'T23:59:59') < now && !task.completed;

            let subtasksHTML = '';
            if (task.subtasks && task.subtasks.length > 0) {
                const pct = ((task.completedSubtasks || 0) / task.subtasks.length) * 100;
                subtasksHTML = `
                    <div class="subtasks-container">
                        <div class="subtasks-header">
                            <span class="subtasks-title">Subtasks</span>
                            <span class="subtasks-count">${task.completedSubtasks || 0}/${task.subtasks.length}</span>
                        </div>
                        <div class="subtask-progress-track">
                            <div class="subtask-progress-fill" style="width:${pct}%"></div>
                        </div>
                        ${task.subtasks.map(s => `
                            <div class="subtask-row-item${s.completed ? ' completed' : ''}">
                                <input type="checkbox" ${s.completed ? 'checked' : ''}
                                    onclick="event.stopPropagation(); todoApp.toggleSubtask(${task.id}, ${s.id})">
                                <span>${s.text}</span>
                            </div>
                        `).join('')}
                    </div>`;
            }

            li.innerHTML = `
                <div class="task-header"><div>
                    <div class="task-title">${task.text}</div>
                    <div class="task-meta">
                        ${dueText ? `<span class="meta-item"><i class="fas fa-calendar-days"></i>${dueText}</span>` : ''}
                        <span class="priority-badge priority-${task.priority}">${dots[task.priority] || ''} ${task.priority}</span>
                        <span class="category-badge">${icons[task.category] || '✨'} ${task.category}</span>
                        ${isOverdue ? '<span class="overdue-badge"><i class="fas fa-fire"></i> Overdue</span>' : ''}
                    </div>
                </div></div>
                ${subtasksHTML}`;

            li.addEventListener('click', () => this.selectTask(task.id));
            taskList.appendChild(li);
        });
    }

    // ── Progress ──────────────────────────────────────────────────────────────
    updateProgress() {
        const total = this.tasks.length;
        const done  = this.tasks.filter(t => t.completed).length;
        const pct   = total > 0 ? Math.round((done / total) * 100) : 0;
        const g = id => document.getElementById(id);
        if (g('totalTasks'))      g('totalTasks').textContent      = total;
        if (g('completedTasks'))  g('completedTasks').textContent  = done;
        if (g('progressFill'))    g('progressFill').style.width    = pct + '%';
        if (g('progressPercent')) g('progressPercent').textContent = pct + '%';
    }

    // ── Sidebar counts ────────────────────────────────────────────────────────
    updateSidebarCounts() {
        const now   = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const g = id => document.getElementById(id);
        if (g('countAll'))     g('countAll').textContent     = this.tasks.length;
        if (g('countDone'))    g('countDone').textContent    = this.tasks.filter(t => t.completed).length;
        if (g('countOverdue')) g('countOverdue').textContent = this.tasks.filter(t =>
            !t.completed && t.dueDate && new Date(t.dueDate + 'T23:59:59') < now).length;
        if (g('countToday'))   g('countToday').textContent   = this.tasks.filter(t =>
            t.dueDate && new Date(t.dueDate + 'T00:00:00').toDateString() === today.toDateString()).length;
    }

    // ── Due date alerts ───────────────────────────────────────────────────────
    checkDueDates() {
        const now      = new Date();
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        this.tasks.forEach(task => {
            if (task.dueDate && !task.completed) {
                const due = new Date(task.dueDate);
                if (due < now)
                    this.showNotification(`"${task.text}" is overdue!`, 'error');
                else if (due.toDateString() === tomorrow.toDateString())
                    this.showNotification(`"${task.text}" is due tomorrow.`, 'warning');
            }
        });
    }

    // ── Toast notifications ───────────────────────────────────────────────────
    showNotification(message, type = 'success') {
        const container = document.getElementById('notificationContainer');
        if (!container) return;
        const el = document.createElement('div');
        el.className = 'notification ' + type;
        const iconMap = { success: 'fa-circle-check', warning: 'fa-triangle-exclamation', error: 'fa-circle-xmark' };
        el.innerHTML  = `<i class="fas ${iconMap[type] || 'fa-circle-check'}"></i><span>${message}</span>`;
        container.appendChild(el);
        setTimeout(() => el.remove(), 4500);
    }

    showWarning() {
        const w = document.getElementById('warningMessage');
        if (!w) return;
        w.style.display = 'flex';
        setTimeout(() => { w.style.display = 'none'; }, 3000);
    }

    // ── Persist ───────────────────────────────────────────────────────────────
    saveTasks() {
        store.set('tasks', JSON.stringify(this.tasks));
    }
}

// ─── Boot after DOM is ready ──────────────────────────────────────────────────
let todoApp;
document.addEventListener('DOMContentLoaded', () => {
    todoApp = new TodoApp();
});