// Переменная для хранения задач
let tasks = [];

// Dynamically loaded assets from API
let loadedAssets = {};

// Category to asset folder mapping
const CATEGORY_ASSET_MAP = {
    1: 'mandatory_yellow',
    2: 'security_blue',
    3: 'simple_joys_green',
    4: 'ego_joys_red',
    5: 'accessibility_joys_light_blue'
};

// Load assets from static manifest or API fallback
async function loadAssets() {
    try {
        const response = await fetch('/assets-manifest.json', { cache: 'force-cache' });
        if (response.ok) {
            loadedAssets = await response.json();
            console.log('Assets loaded successfully from manifest');
        } else {
            console.warn('Failed to load manifest, trying API');
            await loadAssetsFromApi();
        }
    } catch (e) {
        console.warn('Failed to load manifest, trying API:', e.message);
        await loadAssetsFromApi();
    }

    if (!loadedAssets || Object.keys(loadedAssets).length === 0) {
        console.error('Failed to load any assets');
        return;
    }

    // Pre-cache all asset images for offline support
    if ('caches' in window && 'serviceWorker' in navigator) {
        try {
            const cache = await caches.open('korobochka-assets-v5');
            for (const category in loadedAssets) {
                const images = loadedAssets[category];
                for (const imagePath of images) {
                    cache.add(imagePath).catch(err => {
                        console.debug(`Could not cache ${imagePath}:`, err.message);
                    });
                }
            }
            console.log('Asset images cached for offline support');
        } catch (cacheErr) {
            console.debug('Could not access cache:', cacheErr.message);
        }
    }
}

// Fallback: try loading assets from API
async function loadAssetsFromApi() {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const response = await fetch('/api/assets/list', { signal: controller.signal });
        clearTimeout(timeoutId);

        if (response.ok) {
            loadedAssets = await response.json();
            console.log('Assets loaded successfully from API');
        }
    } catch (e) {
        console.error('Failed to load assets from API:', e.message);
    }
}

// Get random background for a given category
function getRandomBackgroundForCategory(category) {
    const assetFolder = CATEGORY_ASSET_MAP[category];
    if (!assetFolder) {
        console.warn(`No asset folder mapping for category ${category}`);
        return null;
    }
    if (!loadedAssets[assetFolder]) {
        console.warn(`No images loaded for category ${category} (folder: ${assetFolder})`);
        return null;
    }
    const images = loadedAssets[assetFolder];
    if (images.length === 0) {
        console.warn(`No images found in ${assetFolder}`);
        return null;
    }
    const randomIndex = Math.floor(Math.random() * images.length);
    const selectedImage = images[randomIndex];
    console.log(`Selected image for category ${category}: ${selectedImage}`);
    return selectedImage;
}

// Legacy function wrappers for backwards compatibility
function getRandomSecurityBackground() {
    return getRandomBackgroundForCategory(2);
}

function getRandomMandatoryBackground() {
    return getRandomBackgroundForCategory(1);
}

function getRandomJoysBackground() {
    return getRandomBackgroundForCategory(3);
}

function getRandomAccessibilityJoysBackground() {
    return getRandomBackgroundForCategory(5);
}

function getRandomEgoJoysBackground() {
    return getRandomBackgroundForCategory(4);
}

// Функции для работы с localStorage
function sanitizeStoredText(s) {
    if (typeof s !== 'string') return s;
    let t = s.replace(/\uFFFD/g, '');
    t = t.replace(/&shy;|&#173;|\u00AD/g, '');
    t = t.replace(/\u200B/g, '');
    t = t.replace(/[\r\n]+/g, ' ');
    t = t.replace(/\s{2,}/g, ' ').trim();
    return t;
}

async function loadTasks() {
    try { await (window.DB && DB.init ? DB.init() : Promise.resolve()); } catch (_) {}

    // Prefer IndexedDB
    try {
        const fromDb = (window.DB && DB.getAllTasks) ? await DB.getAllTasks() : [];
        if (Array.isArray(fromDb) && fromDb.length) {
            tasks = fromDb;
        } else {
            const tasksJSON = localStorage.getItem('tasks');
            tasks = tasksJSON ? JSON.parse(tasksJSON) : [];
        }
    } catch (_) {
        const tasksJSON = localStorage.getItem('tasks');
        tasks = tasksJSON ? JSON.parse(tasksJSON) : [];
    }

    // sanitize stored texts
    tasks = tasks.map(t => ({ ...t, text: sanitizeStoredText(t.text) }));
    // sanitize categories: force invalid/missing to 0 (Категория не определена)
    const valid = new Set([0,1,2,3,4,5]);
    tasks = tasks.map(t => {
        const n = parseInt(t.category);
        const category = (Number.isFinite(n) && valid.has(n)) ? n : 0;
        const active = (typeof t.active === 'boolean') ? t.active : true;
        return { ...t, category, active };
    });

    // sanitize custom subcategories if any
    try {
        const customSubsRaw = localStorage.getItem('customSubcategories');
        if (customSubsRaw) {
            const cs = JSON.parse(customSubsRaw);
            Object.keys(cs).forEach(k => {
                cs[k] = cs[k].map(v => sanitizeStoredText(v));
            });
            const c1 = cs['1'] || cs[1];
            if (Array.isArray(c1)) {
                const filtered = [];
                const seen = new Set();
                c1.forEach(v => {
                    const tag = String(v).trim().toLowerCase();
                    if (!tag) return;
                    if (!seen.has(tag)) { seen.add(tag); filtered.push(v); }
                });
                cs[1] = filtered;
            }
            localStorage.setItem('customSubcategories', JSON.stringify(cs));
        }
    } catch (e) {}

    // Normalize existing tasks subcategory names for category 1 then persist to DB
    try {
        tasks = tasks.map(t => {
            if (t && t.category === 1 && typeof t.subcategory === 'string' && t.subcategory.trim()) {
                const norm = normalizeSubcategoryName(1, t.subcategory);
                if (norm) return { ...t, subcategory: norm };
                const { subcategory, ...rest } = t; return rest;
            }
            return t;
        });
        saveTasks();
    } catch (e) {}
    return tasks;
}

function saveTasks() {
    try { if (window.DB && DB.saveAllTasks) DB.saveAllTasks(tasks); } catch (_) {}
    try { localStorage.setItem('tasks', JSON.stringify(tasks)); } catch (_) {}
}

function getNextId() {
    let maxId = 0;
    tasks.forEach(task => {
        if (task.id > maxId) maxId = task.id;
    });
    return maxId + 1;
}

// Helpers for subcategory normalization/localization
function normalizeSubcategoryName(category, name) {
    if (!name || typeof name !== 'string') return null;
    const n = name.trim().toLowerCase();
    if (String(category) === '1') {
        if (['work','работа','rabota'].includes(n)) return 'work';
        if (['home','дом','doma'].includes(n)) return 'home';
    }
    return name.trim();
}
function getSubcategoryLabel(category, key) {
    if (!key) return '';
    if (String(category) === '1') {
        if (key === 'work') return 'Работа';
        if (key === 'home') return 'Дом';
        if (key.toLowerCase() === 'работа') return 'Работа';
        if (key.toLowerCase() === 'дом') return 'Дом';
    }
    return key;
}

// Add multiple lines as tasks helper
function addLinesAsTasks(lines, category = 0, selectedSub = null) {
    if (!Array.isArray(lines) || lines.length === 0) return 0;
    let added = 0;
    lines.forEach(raw => {
        const text = (typeof raw === 'string') ? raw.trim() : String(raw);
        if (!text) return;
        const newTask = {
            id: getNextId(),
            text,
            category: typeof category === 'number' ? category : parseInt(category) || 0,
            completed: false,
            active: true,
            statusChangedAt: Date.now()
        };
        if (selectedSub && typeof selectedSub === 'string' && selectedSub.trim()) {
            const norm = normalizeSubcategoryName(newTask.category, selectedSub);
            if (norm) newTask.subcategory = norm;
        }
        tasks.push(newTask);
        added += 1;
    });
    saveTasks();
    // clear modal textarea if present
    if (modalTaskText) { modalTaskText.value = ''; setTimeout(() => modalTaskText.focus(), 30); }
    // keep add modal open to allow adding more tasks/subcategories
    // refresh UI
    displayTasks();
    return added;
}

// Переменнные состояния
let currentTask = null;
let timerInterval = null;
let timerTime = 15 * 60; // 15 мину в секундах
let timerRunning = false;
let selectedTaskId = null;
let activeDropdown = null;
let wakeLock = null; // экраны не засыают во время таймера (где поддержвается)

// Новые переменные для точного таймера
let timerStartTime = 0;
let timerPausedTime = 0;
let timerAnimationFrame = null;
let timerWorker = null;
let timerEndAt = 0;
let timerEndTimeoutId = null;
let timerSoundEnabled = true;

// ежим отображеия архива ыолненных задач
let showArchive = false;
let quickAddContext = { active: false, resumeTimer: false };

// Элемнты DOM
const sections = document.querySelectorAll('.section');

// Глобальный обработчик для закрытия откытого выпадающего меню категорий
document.addEventListener('click', function(e) {
    if (activeDropdown && !e.target.closest('.category-selector') && !e.target.closest('.add-category-selector')) {
        activeDropdown.classList.remove('show');
        if (activeDropdown.parentElement) activeDropdown.parentElement.style.zIndex = '';
        activeDropdown = null;
    }
});
const showTasksBtn = document.getElementById('showTasksBtn');
const addMultipleBtn = document.getElementById('addMultipleBtn');
const addSingleBtn = document.getElementById('addSingleBtn');
const archiveBtn = document.getElementById('archiveBtn');
const exportTasksBtn = document.getElementById('exportTasksBtn');
const taskList = document.getElementById('taskList');
const tasksContainer = document.getElementById('tasksContainer');
const taskText = document.getElementById('taskText');
const taskCategory = document.getElementById('taskCategory');
const addTaskBtn = document.getElementById('addTaskBtn');
const hideTasksBtn = document.getElementById('hideTasksBtn');
const timerScreen = document.getElementById('timerScreen');
const timerTaskText = document.getElementById('timerTaskText');
const timerCategoryInfo = document.getElementById('timerCategoryInfo');
const timerDisplay = document.getElementById('timerDisplay');
const timerMinutes = document.getElementById('timerMinutes');
const startTimerBtn = document.getElementById('startTimerBtn');
const pauseTimerBtn = document.getElementById('pauseTimerBtn');
const resetTimerBtn = document.getElementById('resetTimerBtn');
const completeTaskBtn = document.getElementById('completeTaskBtn');
const returnTaskBtn = document.getElementById('returnTaskBtn');
const closeTimerBtn = document.getElementById('closeTimerBtn');
const soundToggleBtn = document.getElementById('soundToggleBtn');
const completeNowBtn = document.getElementById('completeNowBtn');
const importFile = document.getElementById('importFile');
const notification = document.getElementById('notification');
const timerCompleteOptions = document.getElementById('timerCompleteOptions');
const notifyBanner = document.getElementById('notifyBanner');
const enableNotifyBtn = document.getElementById('enableNotifyBtn');
const notifyToggleBtn = document.getElementById('notifyToggleBtn');
const timerQuickAdd = document.getElementById('timerQuickAdd');
const quickAddTaskBtn = document.getElementById('quickAddTaskBtn');

function applyCategoryVisualToSelect() {
    if (!taskCategory) return;
    const val = parseInt(taskCategory.value) || 0;
    const badge = document.querySelector('.add-category-badge');
    if (badge) {
        const label = getCategoryName(val);
        badge.textContent = label;
        badge.setAttribute('data-category', String(val));
    }
}

function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

async function ensurePushSubscribed() {
    if (!('serviceWorker' in navigator)) return false;
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
        const keyRes = await fetch('/api/push/public-key');
        const { publicKey } = await keyRes.json();
        sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(publicKey)
        });
    }
    await fetch('/api/push/subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(sub) });
    return true;
}

function setNotifyBannerVisible(visible) {
    if (notifyBanner) notifyBanner.style.display = visible ? 'flex' : 'none';
}

function refreshNotifyBanner() {
    if (!('Notification' in window)) {
        setNotifyBannerVisible(false);
    }
}

function updateNotifyToggle() {
    if (!notifyToggleBtn || !('Notification' in window)) {
        if (notifyToggleBtn) notifyToggleBtn.style.display = 'none';
        return;
    }
    notifyToggleBtn.style.display = 'inline-flex';
    const icon = notifyToggleBtn.querySelector('i');
    if (Notification.permission === 'granted') {
        if (icon) icon.className = 'fas fa-bell';
    } else {
        if (icon) icon.className = 'fas fa-bell-slash';
    }
}

// Функция для получения названия категории по номеру
function getCategoryName(category) {
    const categories = {
        0: "Категория не определена",
        1: "Обязательные",
        2: "Безопасность",
        3: "Простые радости",
        4: "Эго-радости",
        5: "Доступность простых радостей"
    };
    return categories[Number(category)] ?? "Категория не определена";
}

// Escape HTML to avoid injection when inserting task text into innerHTML
function escapeHtml(unsafe) {
    if (!unsafe) return '';
    return unsafe.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

// Prevent single-letter words from being pushed to the next line by replacing the space before them with a non-breaking space
function fixOrphans(text) {
    if (!text) return '';
    // Prefer non-breaking space after single-letter prepositions: replace 'x ' where x is single letter with 'x\u00A0'
    // Handle both Latin and Cyrillic letters
    const afterSingleRegex = /(^|\s)([A-Za-zА-Яа-яЁё])\s+/g;
    let res = text.replace(afterSingleRegex, function(m, p1, p2) { return p1 + p2 + '\u00A0'; });
    // Also ensure that occurrences of ' space single-letter space ' are normalized (rare)
    const isolatedSingle = /\s([A-Za-zА-Яа-яЁё])\s/g;
    res = res.replace(isolatedSingle, function(m,p1){ return '\u00A0' + p1 + ' '; });
    return res;
}

// Функция отображения всех заач
function displayTasks() {
    tasksContainer.innerHTML = '';

    const titleEl = taskList.querySelector('h2');
    if (titleEl) titleEl.textContent = showArchive ? 'Выполненные' : 'Все задачи';

    // hide import/export controls when viewing archive
    const importExportEl = document.querySelector('.import-export');
    if (importExportEl) importExportEl.style.display = showArchive ? 'none' : 'flex';

    const isMobile = window.matchMedia('(max-width: 480px)').matches;
    tasksContainer.classList.remove('sticker-grid');
    tasksContainer.classList.toggle('mobile-compact', isMobile);

    const groups = new Map();
    const source = tasks.filter(t => showArchive ? t.completed : !t.completed);
    source.forEach(t => {
        const cat = Number.isFinite(Number(t.category)) ? Number(t.category) : 0;
        const arr = groups.get(cat) || [];
        arr.push({ ...t, category: cat });
        groups.set(cat, arr);
    });

    const categories = Array.from(groups.keys()).map(Number).sort((a, b) => a - b);

    const collapsedRaw = localStorage.getItem('collapsedCategories');
    const collapsedCategories = new Set(collapsedRaw ? JSON.parse(collapsedRaw) : []);

    // Загружаем сохранённе пользовательске подкатегории
    const customSubsRaw = localStorage.getItem('customSubcategories');
    const customSubs = customSubsRaw ? JSON.parse(customSubsRaw) : {};

    categories.forEach(cat => {
        const group = document.createElement('div');
        group.className = `category-group category-${cat}`;
        group.dataset.category = String(cat);

        const title = document.createElement('div');
        title.className = 'category-title';
        title.innerHTML = `<div class=\"category-title-left\"><i class=\"fas fa-folder folder-before-title\"></i><span class=\"category-heading\">${getCategoryName(cat)}</span></div><button type=\"button\" class=\"category-add-btn\" data-cat=\"${cat}\" title=\"Добавить задачу в категории\"><i class=\"fas fa-plus\"></i></button>`;

        const grid = document.createElement('div');
        grid.className = 'group-grid';

        if (collapsedCategories.has(cat)) {
            group.classList.add('collapsed');
        }

        group.appendChild(title);
        group.appendChild(grid);
        tasksContainer.appendChild(group);

        // Клик по названию категории — сворачивание/разворачивание группы
        const headSpan = title.querySelector('.category-heading');
        if (headSpan) {
            headSpan.style.cursor = 'pointer';
            headSpan.addEventListener('click', (e) => {
                e.stopPropagation();
                const c = parseInt(group.dataset.category);
                if (group.classList.contains('collapsed')) {
                    group.classList.remove('collapsed');
                    collapsedCategories.delete(c);
                } else {
                    group.classList.add('collapsed');
                    collapsedCategories.add(c);
                }
                localStorage.setItem('collapsedCategories', JSON.stringify(Array.from(collapsedCategories)));
            });
        }

        // Клик по иконке папки — сврачивание/разворачивание
        const folderIcon = title.querySelector('.folder-before-title');
        if (folderIcon) {
            folderIcon.style.cursor = 'pointer';
            folderIcon.addEventListener('click', (e) => {
                e.stopPropagation();
                const c = parseInt(group.dataset.category);
                if (group.classList.contains('collapsed')) {
                    group.classList.remove('collapsed');
                    collapsedCategories.delete(c);
                } else {
                    group.classList.add('collapsed');
                    collapsedCategories.add(c);
                }
                localStorage.setItem('collapsedCategories', JSON.stringify(Array.from(collapsedCategories)));
            });
        }

        const list = groups.get(cat) || [];
        list.sort((a, b) => {
            if (a.active !== b.active) return a.active ? -1 : 1;
            const ta = a.statusChangedAt || 0;
            const tb = b.statusChangedAt || 0;
            if (!a.active && !b.active) return tb - ta;
            if (ta !== tb) return ta - tb;
            return a.id - b.id;
        });


        list.forEach(task => {
            const taskElement = document.createElement('div');
            taskElement.className = `task category-${task.category} ${task.active ? '' : 'inactive'}`;
            taskElement.dataset.id = task.id;
            if (task.subcategory) {
                taskElement.dataset.subcategory = task.subcategory;
            }

            const categoryDisplay = `<i class=\"fas fa-folder move-task-icon\" data-id=\"${task.id}\" style=\"cursor:pointer;\" title=\"Перенести в другую категорию\"></i><span class=\"category-name\">${getCategoryName(task.category)}</span>`;

            // sanitize raw text: remove replacement chars, soft-hyphens and zero-width spaces
            let raw = String(task.text || '');
            raw = raw.replace(/\uFFFD/g, '');
            // remove soft hyphens and common HTML soft-hyphen entities
            raw = raw.replace(/&shy;|&#173;|\u00AD/g, '');
            raw = raw.replace(/\u200B/g, '');
            // merge letters split by explicit newlines (e.g. 'Разобрат\nь' -> 'Разобрать')
            raw = raw.replace(/([A-Za-zА-Яа-яЁё])\s*[\r\n]+\s*([A-Za-zА-Яа-яЁё])/g, '$1$2');
            // Replace remaining explicit newlines with spaces (users may paste multi-line text)
            raw = raw.replace(/[\r\n]+/g, ' ');
            // collapse multiple spaces
            raw = raw.replace(/\s{2,}/g, ' ').trim();
            const safeText = escapeHtml(raw);
            const displayText = fixOrphans(safeText);
            taskElement.innerHTML = `
                <div class=\"task-content\">
                    <div class=\"task-text\">${displayText}</div>
                    <div class=\"category-selector\">
                        <div class=\"task-top-actions\">
                            <div class=\"category-badge\" data-id=\"${task.id}\">
                                ${categoryDisplay}
                                <i class=\"fas fa-caret-down\"></i>
                            </div>
                            <button class=\"task-control-btn complete-task-btn\" data-id=\"${task.id}\" title=\"Отметить выполненной\">
                                <i class=\"fas fa-check\"></i>
                            </button>
                        </div>
                        <div class=\"category-dropdown\" id=\"dropdown-${task.id}\">
                            <button class=\"category-option\" data-category=\"0\">Без категории</button>
                            <div class=\"category-option-group\">
                                <button class=\"category-option\" data-category=\"1\">Обязательные</button>
                            </div>
                            <button class=\"category-option\" data-category=\"2\">Безопасность</button>
                            <button class=\"category-option\" data-category=\"5\">Доступность простых радостей</button>
                            <button class=\"category-option\" data-category=\"3\">Простые радости</button>
                            <button class=\"category-option\" data-category=\"4\">Эго-радости</button>
                        </div>
                    </div>
                </div>
                <div class=\"task-controls\">
                    <button class=\"task-control-btn start-timer-btn\" data-id=\"${task.id}\" title=\"Запустить таймер\">
                        <i class=\"fas fa-play\"></i>
                    </button>
                    <button class=\"task-control-btn toggle-active-btn\" data-id=\"${task.id}\">
                        <i class=\"fas ${task.active ? 'fa-eye-slash' : 'fa-eye'}\"></i>
                    </button>
                    <button class=\"task-control-btn delete-task-btn\" data-id=\"${task.id}\">
                        <i class=\"fas fa-trash\"></i>
                    </button>
                </div>
            `;
            // If task is completed, adjust UI: strike-through, remove edit controls, add return button
            if (task.completed) {
                taskElement.classList.add('completed');
                const ttxt = taskElement.querySelector('.task-text');
                if (ttxt) ttxt.style.textDecoration = 'line-through';
                // remove dropdown caret if present
                const caret = taskElement.querySelector('.category-badge .fa-caret-down');
                if (caret) caret.remove();
                // remove start-timer, complete and toggle buttons
                const timerBtn = taskElement.querySelector('.start-timer-btn'); if (timerBtn) timerBtn.remove();
                const completeBtn = taskElement.querySelector('.complete-task-btn'); if (completeBtn) completeBtn.remove();
                const toggleBtn = taskElement.querySelector('.toggle-active-btn'); if (toggleBtn) toggleBtn.remove();
                // ensure delete button remains available for completed tasks and add return button
                const controls = taskElement.querySelector('.task-controls');
                if (controls) {
                    controls.innerHTML = '';

                    // Add kebab menu button for completed tasks
                    const menuBtn = document.createElement('button');
                    menuBtn.className = 'task-kebab-menu-btn';
                    menuBtn.dataset.id = String(task.id);
                    menuBtn.title = 'Действия с задачей';
                    menuBtn.setAttribute('aria-label', 'Действия с задачей');
                    menuBtn.innerHTML = '<i class="fas fa-ellipsis-v"></i>';
                    controls.appendChild(menuBtn);

                    const ret = document.createElement('button');
                    ret.className = 'task-control-btn return-task-btn';
                    ret.dataset.id = String(task.id);
                    ret.title = 'Вернуть в активные';
                    ret.innerHTML = '<i class="fas fa-undo"></i>';
                    controls.appendChild(ret);
                }
                // remove folder icon from category badge for completed tasks
                const folderIcon = taskElement.querySelector('.category-badge i.fa-folder');
                if (folderIcon) folderIcon.remove();
            }

            // Переставяем элменты для мобильного: папка сверху справа, ниже сразу глаз и урна
            const contentWrap = taskElement.querySelector('.task-content');
            if (contentWrap) {
                const txt = contentWrap.querySelector('.task-text');
                const sel = contentWrap.querySelector('.category-selector');
                if (isMobile && txt && sel && sel.nextElementSibling !== txt) {
                    contentWrap.insertBefore(sel, txt);
                }
                if (isMobile) {
                    const controls = taskElement.querySelector('.task-controls');
                    if (controls && txt) {
                        contentWrap.insertBefore(controls, txt);
                    }
                }
            }
            if (isMobile && task.text.length > 44) {
                taskElement.classList.add('sticker-wide');
            }
            grid.appendChild(taskElement);


            // If this task belongs to security-related categories (2 or 5), render subcategory selector in the dropdown
            if (!task.completed && task.category !== 0) {
                populateTaskSubcategoryDropdown(task);
            } else if (!task.completed) {
                // task.category === 0 -> leave full category selection (default HTML)
            }
        });

        // Динамическая группировка задач по подкатегориям для текущей категории (учитываем сохранённные подкатегории)
        {
            const nodes = [...grid.querySelectorAll(':scope > .task')];
            const noneTasks = nodes.filter(el => !el.dataset.subcategory);
            const bySub = new Map();
            nodes.forEach(el => {
                const sub = el.dataset.subcategory || '';
                if (!sub) return;
                const arr = bySub.get(sub) || [];
                arr.push(el);
                bySub.set(sub, arr);
            });
            const frag = document.createDocumentFragment();
            noneTasks.forEach(el => frag.appendChild(el));
            const saved = Array.isArray(customSubs[cat]) ? customSubs[cat] : [];
            const normMap = new Map();
            const addKey = (key) => {
                const norm = normalizeSubcategoryName(cat, key) || key;
                if (!normMap.has(norm)) normMap.set(norm, key);
            };
            bySub.forEach((arr, key) => addKey(key));
            saved.forEach(key => addKey(key));
            const subNames = Array.from(normMap.keys()).sort((a,b)=>a.localeCompare(b,'ru'));
            subNames.forEach(normKey => {
                const display = getSubcategoryLabel(cat, normKey);
                const titleEl = document.createElement('div');
                titleEl.className = 'category-title subcategory-title';
                const leftWrap = document.createElement('div');
                leftWrap.className = 'subcategory-title-left';

                const menuBtn = document.createElement('button');
                menuBtn.className = 'subcategory-menu-btn';
                menuBtn.type = 'button';
                menuBtn.setAttribute('aria-label','Меню подкатегории');
                menuBtn.innerHTML = '<i class="fas fa-ellipsis-v"></i>';
                menuBtn.addEventListener('click', (e) => { e.stopPropagation(); openSubcategoryActions(cat, normKey); });
                leftWrap.appendChild(menuBtn);

                const headingSpan = document.createElement('span');
                headingSpan.className = 'category-heading';
                headingSpan.textContent = display;
                leftWrap.appendChild(headingSpan);
                titleEl.appendChild(leftWrap);

                // Добавляем кнопку-глаз для массового скрытия/показа задач подкатегории только в категории "Обязательные"
                if (Number(cat) === 1 && !showArchive) {
                    const eyeBtn = document.createElement('button');
                    eyeBtn.className = 'task-control-btn subcategory-toggle-all';
                    eyeBtn.type = 'button';
                    eyeBtn.setAttribute('aria-label','Скрыть/показать все задачи подкатегории');
                    const hasActive = tasks.some(t => t.category === cat && (normalizeSubcategoryName(cat, t.subcategory) === normKey) && t.active && !t.completed);
                    eyeBtn.innerHTML = `<i class=\"fas ${hasActive ? 'fa-eye-slash' : 'fa-eye'}\"></i>`;
                    eyeBtn.addEventListener('click', (e) => { e.stopPropagation(); toggleSubcategoryActiveByName(cat, normKey); });
                    titleEl.appendChild(eyeBtn);
                }
                frag.appendChild(titleEl);
                const arr = bySub.get(normMap.get(normKey)) || [];
                arr.forEach(el => {
                    frag.appendChild(el);
                });
            });
            grid.innerHTML = '';
            grid.appendChild(frag);

            // Check for text overflow and apply marquee animation
            setTimeout(() => {
                const isMobile = window.matchMedia('(max-width: 480px)').matches;
                if (isMobile) {
                    grid.querySelectorAll('.subcategory-title-left .category-heading').forEach(heading => {
                        const container = heading.closest('.subcategory-title-left');
                        if (container && heading.scrollWidth > container.offsetWidth) {
                            heading.classList.add('marquee');
                        } else {
                            heading.classList.remove('marquee');
                        }
                    });
                }
            }, 0);
        }

        // Обработчик сворачивания переннсён на иконку папки выше
    });

    // After rendering groups, remove subcategory toggles inside security groups (category 2 and 5)
    document.querySelectorAll('.category-group').forEach(groupEl => {
        const catNum = parseInt(groupEl.dataset.category);
        if (catNum === 2 || catNum === 5) {
            groupEl.querySelectorAll('.subcategory-toggle-all').forEach(btn => btn.remove());
        }
    });

    // Добавяем обработчики событий для новых элементов
    document.querySelectorAll('.move-task-icon').forEach(icon => {
        icon.addEventListener('click', (e) => {
            e.stopPropagation();
            const taskId = parseInt(icon.getAttribute('data-id'));
            openMoveTaskModal(taskId);
        });
    });

    document.querySelectorAll('.category-badge').forEach(badge => {
        // category-name inside task badge should not prompt for subcategory anymore
        const nameEl = badge.querySelector('.category-name');
        if (nameEl) {
            nameEl.style.cursor = 'default';
        }
        badge.addEventListener('click', function(e) {
            e.stopPropagation();
            const id = parseInt(badge.getAttribute('data-id'));
            const idx = tasks.findIndex(t => t.id === id);
            if (idx !== -1 && tasks[idx].completed) return; // don't open dropdown for completed tasks
            const dropdown = this.closest('.category-selector').querySelector('.category-dropdown');
            if (activeDropdown && activeDropdown !== dropdown) {
                activeDropdown.classList.remove('show');
                if (activeDropdown.parentElement) activeDropdown.parentElement.style.zIndex = '';
            }
            /* dropdown is resolved above */
            dropdown.classList.toggle('show');
            activeDropdown = dropdown;
            if (dropdown.classList.contains('show')) {
                if (dropdown.parentElement) dropdown.parentElement.style.zIndex = '9000';
                const isMobile = window.matchMedia('(max-width: 480px)').matches;
                const vw = window.innerWidth || document.documentElement.clientWidth;
                const vh = window.innerHeight || document.documentElement.clientHeight;
                // Base styles
                dropdown.style.maxWidth = 'calc(100vw - 16px)';
                dropdown.style.left = '';
                dropdown.style.right = '';
                dropdown.style.top = '100%';
                dropdown.style.bottom = 'auto';
                if (isMobile) {
                    // Use fixed positioning to avoid clipping by overflow on mobile
                    const anchor = badge.getBoundingClientRect();
                    dropdown.style.position = 'fixed';
                    dropdown.style.zIndex = '11000';
                    // Measure after showing
                    const rectNow = dropdown.getBoundingClientRect();
                    const width = Math.min(rectNow.width, vw - 16);
                    const spaceBelow = vh - anchor.bottom - 8;
                    const spaceAbove = anchor.top - 8;
                    let left = Math.min(vw - width - 8, Math.max(8, anchor.left));
                    dropdown.style.left = left + 'px';
                    if (spaceBelow >= rectNow.height) {
                        dropdown.style.top = (Math.min(anchor.bottom + 4, vh - rectNow.height - 8)) + 'px';
                        dropdown.style.bottom = 'auto';
                    } else if (spaceAbove >= rectNow.height) {
                        dropdown.style.top = (Math.max(anchor.top - rectNow.height - 4, 8)) + 'px';
                        dropdown.style.bottom = 'auto';
                    } else {
                        // Fallback: pin to viewport with small margins
                        dropdown.style.top = '8px';
                        dropdown.style.bottom = '8px';
                        dropdown.style.overflowY = 'auto';
                    }
                } else {
                    // Desktop/tablet: keep absolute but clamp into viewport
                    const rect = dropdown.getBoundingClientRect();
                    if (rect.bottom > vh - 8) { dropdown.style.top = 'auto'; dropdown.style.bottom = '100%'; }
                    if (rect.right > vw - 8) { dropdown.style.left = 'auto'; dropdown.style.right = '0'; }
                    if (rect.left < 8) { dropdown.style.left = '0'; dropdown.style.right = 'auto'; }
                }
            } else {
                // Reset any temporary styles
                dropdown.style.position = '';
                dropdown.style.zIndex = '';
                dropdown.style.top = '';
                dropdown.style.bottom = '';
                dropdown.style.left = '';
                dropdown.style.right = '';
                dropdown.style.maxWidth = '';
                dropdown.style.overflowY = '';
                if (dropdown.parentElement) dropdown.parentElement.style.zIndex = '';
            }
        });
    });

    document.querySelectorAll('.category-dropdown .category-option[data-category]').forEach(option => {
        // attach + button on category titles and task badges to open add modal (handled below)
    });

    // attach handlers for category-add buttons (open modal restricted to this category)
    document.querySelectorAll('.category-add-btn').forEach(btn => {
        if (showArchive) {
            // hide add buttons when viewing completed tasks
            btn.style.display = 'none';
            return;
        }
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const cat = btn.dataset.cat ? parseInt(btn.dataset.cat) : null;
            openAddModal(undefined, { restrict: 'section', sectionCats: String(cat) });
        });
    });

    // continue with category-option bindings
    // Handle clicks only on category options that actually change category
    document.querySelectorAll('.category-dropdown .category-option[data-category]').forEach(option => {
        option.addEventListener('click', function() {
            const badge = this.closest('.category-selector').querySelector('.category-badge');
            const taskId = parseInt(badge.dataset.id);
            const idx = tasks.findIndex(t => t.id === taskId);
            if (idx !== -1 && tasks[idx].completed) {
                return;
            }
            const newCategory = parseInt(this.dataset.category);
            if (!Number.isFinite(newCategory)) return;
            changeTaskCategory(taskId, newCategory, null);
            const dd = this.closest('.category-dropdown');
            dd.classList.remove('show');
            if (dd && dd.parentElement) dd.parentElement.style.zIndex = '';
            activeDropdown = null;
        });
    });

    document.querySelectorAll('.toggle-active-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = parseInt(e.target.closest('.toggle-active-btn').dataset.id);
            toggleTaskActive(id);
        });
    });

    document.querySelectorAll('.delete-task-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = parseInt(e.target.closest('.delete-task-btn').dataset.id);
            deleteTask(id);
        });
    });

    document.querySelectorAll('.task-kebab-menu-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = parseInt(btn.dataset.id);
            openTaskActionsModal(id);
        });
    });

    document.querySelectorAll('.start-timer-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = parseInt(e.currentTarget.dataset.id);
            const task = tasks.find(t => t.id === id);
            if (task && !task.completed) {
                showTimer(task);
            }
        });
    });

    document.querySelectorAll('.complete-task-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = parseInt(e.currentTarget.dataset.id);
            const idx = tasks.findIndex(t => t.id === id);
            if (idx !== -1) {
                tasks[idx].completed = true;
                tasks[idx].active = false;
                tasks[idx].statusChangedAt = Date.now();
                saveTasks();
                displayTasks();
            }
        });
    });

    // Return completed task back to active
    document.querySelectorAll('.return-task-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = parseInt(e.currentTarget.dataset.id);
            const idx = tasks.findIndex(t => t.id === id);
            if (idx !== -1) {
                tasks[idx].completed = false;
                tasks[idx].active = true;
                tasks[idx].statusChangedAt = Date.now();
                delete tasks[idx].completedAt;
                delete tasks[idx].duration;
                delete tasks[idx].completedDate;
                saveTasks();
                displayTasks();
            }
        });
    });

    document.querySelectorAll('.task-text').forEach(el => {
        el.addEventListener('click', (e) => {
            e.stopPropagation();
            const taskEl = el.closest('.task');
            if (!taskEl) return;
            const id = parseInt(taskEl.dataset.id);
            const orig = el.textContent || '';
            const input = document.createElement('textarea');
            input.className = 'task-edit';
            input.value = orig;
            el.style.display = 'none';
            el.insertAdjacentElement('afterend', input);
            input.focus();
            input.setSelectionRange(input.value.length, input.value.length);
            const commit = () => {
                const val = input.value.trim();
                input.removeEventListener('keydown', onKey);
                input.removeEventListener('blur', onBlur);
                if (val && val !== orig) {
                    const idx = tasks.findIndex(t => t.id === id);
                    if (idx !== -1) {
                        tasks[idx].text = val;
                        saveTasks();
                        displayTasks();
                        return;
                    }
                }
                input.remove();
                el.style.display = '';
            };
            const cancel = () => {
                input.removeEventListener('keydown', onKey);
                input.removeEventListener('blur', onBlur);
                input.remove();
                el.style.display = '';
            };
            const onKey = (ev) => {
                if (ev.key === 'Enter' && !ev.shiftKey) {
                    ev.preventDefault();
                    commit();
                } else if (ev.key === 'Escape') {
                    ev.preventDefault();
                    cancel();
                }
            };
            const onBlur = () => commit();
            input.addEventListener('keydown', onKey);
            input.addEventListener('blur', onBlur);
        });
    });

    updateSectionTaskCounts();
}

// Функция для изеения категории задачи
function changeTaskCategory(taskId, newCategory, newSubcategory = null) {
    const taskIndex = tasks.findIndex(t => t.id === taskId);
    if (taskIndex === -1) return;
    const prev = tasks[taskIndex];
    const wasActive = !!prev.active;
    const prevCategory = Number(prev.category);

    // Build updated task
    let updated = { ...prev, category: newCategory };

    // If explicitly provided a subcategory, keep it; otherwise, when moving across categories, drop subcategory
    if (typeof newSubcategory === 'string' && newSubcategory.trim()) {
        updated.subcategory = newSubcategory.trim();
    } else if (prevCategory !== Number(newCategory)) {
        delete updated.subcategory;
    }

    // Auto-activate when moving from undefined category to a defined one
    if (prevCategory === 0 && !prev.active && newCategory !== 0) {
        updated.active = true;
    }
    if (!wasActive && updated.active === true) {
        updated.statusChangedAt = Date.now();
    }

    tasks[taskIndex] = updated;
    saveTasks();
    displayTasks();
}

// Функция для переключения активности задачи
function toggleTaskActive(taskId) {
    const taskIndex = tasks.findIndex(t => t.id === taskId);
    if (taskIndex === -1) return;

    const newActive = !tasks[taskIndex].active;
    tasks[taskIndex].active = newActive;
    tasks[taskIndex].statusChangedAt = Date.now();

    saveTasks();
    displayTasks();
}

// Переключение активности всех задач внутри категории
function toggleCategoryActive(category) {
    const hasActive = tasks.some(t => t.category === category && t.active);
    const newActive = !hasActive;
    tasks = tasks.map(t => t.category === category ? { ...t, active: newActive, statusChangedAt: Date.now() } : t);
    saveTasks();
    displayTasks();
}

function getSubcategorySnapshotKey(category, subName) {
    return `cat:${category}|sub:${subName}`;
}

function loadSubcategoryActiveSnapshots() {
    try {
        const raw = localStorage.getItem('subcategoryActiveSnapshots');
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        return (parsed && typeof parsed === 'object') ? parsed : {};
    } catch (_) {
        return {};
    }
}


function saveSubcategoryActiveSnapshots(store) {
    try {
        localStorage.setItem('subcategoryActiveSnapshots', JSON.stringify(store));
    } catch (_) {}
}

function taskMatchesSubcategory(task, category, normalizedName) {
    if (!task || task.category !== category) return false;
    const raw = normalizeSubcategoryName(category, task.subcategory);
    const candidate = raw || (typeof task.subcategory === 'string' ? task.subcategory.trim() : '');
    return candidate === normalizedName;
}

// Переключние активности подкатегоии по имени для указанной категрии
function toggleSubcategoryActiveByName(category, subName) {
    const normalizedName = normalizeSubcategoryName(category, subName) || (typeof subName === 'string' ? subName.trim() : '');
    if (!normalizedName) return;

    const store = loadSubcategoryActiveSnapshots();
    const key = getSubcategorySnapshotKey(category, normalizedName);
    const relevantTasks = tasks.filter(t => taskMatchesSubcategory(t, category, normalizedName) && !t.completed);

    if (relevantTasks.length === 0) {
        if (store[key]) {
            delete store[key];
            saveSubcategoryActiveSnapshots(store);
        }
        return;
    }

    const now = Date.now();
    const hasActive = relevantTasks.some(t => t.active);

    if (hasActive) {
        store[key] = relevantTasks.filter(t => t.active).map(t => t.id);
        tasks = tasks.map(t => {
            if (!taskMatchesSubcategory(t, category, normalizedName) || t.completed || !t.active) {
                return t;
            }
            return { ...t, active: false, statusChangedAt: now };
        });
    } else {
        const savedIds = Array.isArray(store[key]) ? store[key].filter(id => relevantTasks.some(t => t.id === id)) : [];
        const fallbackIds = savedIds.length ? savedIds : relevantTasks.map(t => t.id);
        const restoreSet = new Set(fallbackIds);
        store[key] = Array.from(restoreSet);
        tasks = tasks.map(t => {
            if (!taskMatchesSubcategory(t, category, normalizedName) || t.completed) {
                return t;
            }
            const shouldBeActive = restoreSet.has(t.id);
            if (t.active === shouldBeActive) {
                return t;
            }
            return { ...t, active: shouldBeActive, statusChangedAt: now };
        });
    }

    saveSubcategoryActiveSnapshots(store);
    saveTasks();
    displayTasks();
}

// Функця для удаления задачи
function deleteTask(taskId) {
    openConfirmModal({
        title: 'Удаление задачи',
        message: 'Удалить эту задачу?',
        confirmText: 'Удалить',
        cancelText: 'Отмена',
        requireCheck: false,
        compact: true,
        onConfirm: () => {
            tasks = tasks.filter(t => t.id !== taskId);
            saveTasks();
            displayTasks();
        }
    });
}

// Функция для экспорта задач в файл
function exportTasks() {
    const dataStr = JSON.stringify(tasks, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);

    // Генерируем имя файла с датой и временем
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');

    const exportFileDefaultName = `коробочка-задачи-${year}-${month}-${day}-${hours}-${minutes}-${seconds}.json`;

    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
}

// Функция дл импорта задач из файла
function importTasks(file) {
    const reader = new FileReader();
    
    reader.onload = function(e) {
        try {
            const importedTasks = JSON.parse(e.target.result);
            
            if (!Array.isArray(importedTasks)) {
                openInfoModal('Ошибка: файл должен содержать массив задач');
                return;
            }
            
            // Проверяем структуру задач
            for (const task of importedTasks) {
                if (!task.text || typeof task.category === 'undefined') {
                    openInfoModal('Ошибка: неправильный формат файла');
                    return;
                }
            }
            
            // Добавлям задачи в базу данных
            tasks = importedTasks;
            saveTasks();
            openInfoModal(`Успешно импортировано ${importedTasks.length} задач`, 'Импорт завершён');
            displayTasks();
            
        } catch (error) {
            openInfoModal('Ошибка при чтении файла: ' + error.message);
        }
    };
    
    reader.readAsText(file);
}

function setQuickAddVisible(visible) {
    if (!timerQuickAdd) return;
    timerQuickAdd.style.display = visible ? 'flex' : 'none';
}

// Функция для подсчёта активных задач по категориям
function countActiveTasks(categories) {
    const categoryArray = categories.split(',').map(Number);
    return tasks.filter(task =>
        categoryArray.includes(task.category) && task.active && !task.completed
    ).length;
}

// Функция для обновления количества активных задач на стикерах
function updateSectionTaskCounts() {
    document.querySelectorAll('.section').forEach(section => {
        const categories = section.dataset.category;
        const count = countActiveTasks(categories);
        let countBadge = section.querySelector('.section-task-count');

        if (!countBadge) {
            countBadge = document.createElement('div');
            countBadge.className = 'section-task-count';
            const h2 = section.querySelector('h2');
            if (h2) {
                h2.insertAdjacentElement('afterend', countBadge);
            }
        }

        countBadge.textContent = 'Активных: ' + count;
    });
}

// Функция для выбора случайной задачи из категории
function getRandomTask(categories) {
    // Преоразуем строку категорий в масив чисел
    const categoryArray = categories.split(',').map(Number);

    // Получаем все активные задачи из указанных категорий, исключая выполненные
    const filteredTasks = tasks.filter(task =>
        categoryArray.includes(task.category) && task.active && !task.completed
    );

    if (filteredTasks.length === 0) {
        openInfoModal('Нет активных задач в этой категории!');
        return null;
    }

    const randomIndex = Math.floor(Math.random() * filteredTasks.length);
    return filteredTasks[randomIndex];
}

// Функция для отобажения таймера
function showTimer(task) {
    currentTask = task;
    timerTaskText.textContent = task.text;
    try { timerTaskText.style.backgroundColor = getCategoryColor(task.category); } catch (e) {}

    // Display category and subcategory
    if (timerCategoryInfo) {
        timerCategoryInfo.innerHTML = '';
        const categoryName = getCategoryName(task.category);
        if (categoryName) {
            const categoryBadge = document.createElement('div');
            categoryBadge.className = 'timer-category-badge';
            categoryBadge.textContent = categoryName;
            categoryBadge.style.backgroundColor = getCategoryColor(task.category);
            categoryBadge.style.color = '#333';
            timerCategoryInfo.appendChild(categoryBadge);
        }

        if (task.subcategory && task.subcategory.trim()) {
            const subcategoryBadge = document.createElement('div');
            subcategoryBadge.className = 'timer-subcategory-badge';
            subcategoryBadge.textContent = getSubcategoryLabel(task.category, task.subcategory);
            subcategoryBadge.style.backgroundColor = lightenHex(getCategoryColor(task.category), 0.7);
            subcategoryBadge.style.color = '#333';
            timerCategoryInfo.appendChild(subcategoryBadge);
        }
    }

    // Set timer-content background to match category
    const timerContent = document.querySelector('.timer-content');
    if (timerContent) {
        timerContent.style.color = '#333';

        // Apply random background image based on category
        const backgroundImage = getRandomBackgroundForCategory(task.category);

        if (backgroundImage) {
            // Apply background image with light overlay to ensure text readability while showing the image
            timerContent.style.backgroundImage = `linear-gradient(to bottom, rgba(255, 255, 255, 0.4), rgba(255, 255, 255, 0.5)), url('${backgroundImage}')`;
            timerContent.style.backgroundSize = 'cover';
            timerContent.style.backgroundPosition = 'center center';
            timerContent.style.backgroundRepeat = 'no-repeat';
            timerContent.style.backgroundAttachment = 'scroll';
            timerContent.style.backgroundColor = 'rgba(255, 255, 255, 0.5)';
        } else {
            timerContent.style.backgroundImage = 'none';
            const bgColor = getCategoryGroupBg(task.category);
            timerContent.style.backgroundColor = bgColor;
        }
    }

    // по умолчанию при новом таймере звук включён
    timerSoundEnabled = true;
    updateSoundToggleUI();
    updateTimerControlsForViewport();

    // Полный сбос состояния таймера перед новым запуском
    if (timerEndTimeoutId) {
        clearTimeout(timerEndTimeoutId);
        timerEndTimeoutId = null;
    }
    timerRunning = false;
    timerPausedTime = 0;
    timerEndAt = 0;

    timerTime = Math.max(1, parseInt(timerMinutes.value)) * 60;
    updateTimerDisplay();
    setQuickAddVisible(false);
    timerScreen.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    // Close any open dropdown to avoid it appearing above overlay
    try {
        if (activeDropdown) {
            activeDropdown.classList.remove('show');
            if (activeDropdown.parentElement) activeDropdown.parentElement.style.zIndex = '';
            activeDropdown = null;
        }
    } catch (_) {}

    // Скрываем опции завершения и показываем управление аймером
    timerCompleteOptions.style.display = 'none';
    document.querySelector('.timer-controls').style.display = 'flex';
}

function updateSoundToggleUI() {
    if (!soundToggleBtn) return;
    soundToggleBtn.setAttribute('aria-pressed', String(timerSoundEnabled));
    soundToggleBtn.title = timerSoundEnabled ? 'Звук включён' : 'Звук выключен';
    soundToggleBtn.setAttribute('aria-label', timerSoundEnabled ? 'Звук включён' : 'Звук выключен');
    soundToggleBtn.innerHTML = timerSoundEnabled ? '<i class="fas fa-volume-up"></i>' : '<i class="fas fa-volume-xmark"></i>';
    if (timerSoundEnabled) {
        soundToggleBtn.classList.remove('is-muted');
    } else {
        soundToggleBtn.classList.add('is-muted');
    }
}

if (soundToggleBtn) {
    soundToggleBtn.addEventListener('click', () => {
        timerSoundEnabled = !timerSoundEnabled;
        updateSoundToggleUI();
    });
}

function updateTimerControlsForViewport() {
    const isMobile = window.matchMedia('(max-width: 480px)').matches;
    if (!startTimerBtn || !pauseTimerBtn || !resetTimerBtn) return;
    if (isMobile) {
        startTimerBtn.classList.add('icon-only');
        pauseTimerBtn.classList.add('icon-only');
        resetTimerBtn.classList.add('icon-only');
        startTimerBtn.innerHTML = '<i class="fas fa-play"></i>';
        startTimerBtn.setAttribute('aria-label','Старт');
        startTimerBtn.title = 'Старт';
        pauseTimerBtn.innerHTML = '<i class="fas fa-pause"></i>';
        pauseTimerBtn.setAttribute('aria-label','Пауза');
        pauseTimerBtn.title = 'Пауза';
        resetTimerBtn.innerHTML = '<i class="fas fa-rotate-left"></i>';
        resetTimerBtn.setAttribute('aria-label','Сброс');
        resetTimerBtn.title = 'Сброс';
    } else {
        startTimerBtn.classList.remove('icon-only');
        pauseTimerBtn.classList.remove('icon-only');
        resetTimerBtn.classList.remove('icon-only');
        startTimerBtn.textContent = 'Старт';
        pauseTimerBtn.textContent = 'Пауза';
        resetTimerBtn.textContent = 'Сброс';
    }
}

function checkSubcategoryMarquee() {
    const isMobile = window.matchMedia('(max-width: 480px)').matches;
    if (isMobile) {
        document.querySelectorAll('.subcategory-title-left .category-heading').forEach(heading => {
            const container = heading.closest('.subcategory-title-left');
            if (container && heading.scrollWidth > container.offsetWidth) {
                heading.classList.add('marquee');
            } else {
                heading.classList.remove('marquee');
            }
        });
    }
}

window.addEventListener('resize', updateTimerControlsForViewport);
window.addEventListener('resize', checkSubcategoryMarquee);

// Функция для скрытия таймера
function hideTimer() {
    timerScreen.style.display = 'none';
    document.body.style.overflow = 'auto'; // Восстанавливаем прокрутку
    stopTimer(); // Останавливем таймр при закрытии
    releaseWakeLock();
}

// Функция для обновления изображения таймера
function updateTimerDisplay() {
    const minutes = Math.floor(timerTime / 60);
    const seconds = timerTime % 60;
    const formattedMinutes = minutes.toString().padStart(2, '0');
    const formattedSeconds = seconds.toString().padStart(2, '0');
    const newDigits = [formattedMinutes[0], formattedMinutes[1], formattedSeconds[0], formattedSeconds[1]];

    const digitElements = timerDisplay.querySelectorAll('.timer-digit');

    digitElements.forEach((element, index) => {
        const oldValue = element.textContent;
        const newValue = newDigits[index];

        if (oldValue !== newValue) {
            element.classList.remove('digit-animate');
            element.textContent = newValue;
            void element.offsetWidth;
            element.classList.add('digit-animate');
        }
    });
}

// Функция для показа уведомления
function showNotification(message) {
    const body = message || (currentTask ? `Задача: ${currentTask.text}` : "Время вышло! Задача завершена.");
    showToastNotification("🎁 КОРОБОЧКА", body, 5000);
    playWindChime();

    if ("Notification" in window) {
        if (Notification.permission === "granted") {
            createBrowserNotification(body);
        } else if (Notification.permission !== "denied") {
            Notification.requestPermission().then(permission => {
                if (permission === "granted") {
                    createBrowserNotification(body);
                }
            });
        }
    }
}

// Создание браузерного уведомления
function createBrowserNotification(message) {
    const title = "🎁 КОРОБОЧКА";
    const options = {
        body: message || "Время вышло! Задача завершена.",
        icon: "/icon-192.png",
        badge: "/icon-192.png",
        vibrate: [500, 300, 500],
        tag: "timer-notification",
        renotify: true,
        requireInteraction: true,
        data: { url: "/" }
    };

    if (!("Notification" in window)) return;

    if (navigator.serviceWorker && Notification.permission === "granted") {
        navigator.serviceWorker.ready
            .then(reg => {
                if (reg && reg.showNotification) {
                    reg.showNotification(title, options);
                } else {
                    new Notification(title, options);
                }
            })
            .catch(() => {
                new Notification(title, options);
            });
    } else if (Notification.permission === "granted") {
        new Notification(title, options);
    }
}

// Добавляем запрос разрешения при загрузке страницы
function populateTaskSubcategoryDropdown(task) {
    const dd = document.getElementById(`dropdown-${task.id}`);
    if (!dd) return;
    dd.innerHTML = '';
    // Apply category-colored background for the dropdown
    try { dd.style.backgroundColor = lightenHex(getCategoryColor(task.category), 0.92); dd.style.color = '#222'; } catch (e) {}
    // Disable scroll for categories 2,3,4,5 to match others
    if ([2,3,4,5].includes(Number(task.category))) {
        dd.classList.add('no-scroll');
    } else {
        dd.classList.remove('no-scroll');
    }
    // option: none
    const noneBtn = document.createElement('button');
    noneBtn.type = 'button';
    noneBtn.className = 'category-option';
    noneBtn.textContent = 'Без подкатегории';
    noneBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        changeTaskCategory(task.id, task.category, null);
        dd.classList.remove('show');
        activeDropdown = null;
    });
    dd.appendChild(noneBtn);

    // gather subcategories: defaults + saved
    const customSubsRaw = localStorage.getItem('customSubcategories');
    const customSubs = customSubsRaw ? JSON.parse(customSubsRaw) : {};

    // Build list from saved subcategories and existing tasks in this category
    const list = [];
    const present = new Set();

    // include existing subcategories from tasks
    tasks.filter(t => t.category === task.category && typeof t.subcategory === 'string' && t.subcategory.trim())
         .forEach(t => {
            const norm = normalizeSubcategoryName(task.category, t.subcategory);
            const key = norm || t.subcategory.trim();
            const tag = key.toLowerCase();
            if (!present.has(tag)) { present.add(tag); list.push({ key, label: key }); }
         });

    // include saved (custom) subcategories
    const saved = Array.isArray(customSubs[task.category]) ? customSubs[task.category] : [];
    saved.forEach(s => {
        const norm = normalizeSubcategoryName(task.category, s);
        const key = norm || s;
        const tag = key.toLowerCase();
        if (!present.has(tag)) { present.add(tag); list.push({ key, label: s }); }
    });

    // sort alphabetically (ru-friendly)
    list.sort((a,b) => String(a.label).localeCompare(String(b.label), 'ru'));

    list.forEach(item => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'category-option';
        b.dataset.sub = normalizeSubcategoryName(task.category, item.key) || item.key;
        b.textContent = getSubcategoryLabel(task.category, item.label);
        b.addEventListener('click', (e) => {
            e.stopPropagation();
            changeTaskCategory(task.id, task.category, b.dataset.sub);
            dd.classList.remove('show');
            activeDropdown = null;
        });
        dd.appendChild(b);
    });

    // for security category (2) provide add-button
    if ([2,3,4,5].includes(task.category)) {
        const wrapper = document.createElement('div');
        wrapper.className = 'category-option add-sub-btn-wrapper';
        const inline = document.createElement('div');
        inline.className = 'inline-add-form';
        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = (task.category === 2) ? 'новая сфера безопасности' : (task.category === 5) ? 'Новая сложная радость' : ((task.category === 3 || task.category === 4) ? 'новая сфера удовольствия' : 'Новая подкатегория');
        const save = document.createElement('button');
        save.type = 'button';
        save.className = 'inline-save-btn';
        save.textContent = 'Добавить';
        const cancel = document.createElement('button');
        cancel.type = 'button';
        cancel.className = 'inline-cancel-btn';
        cancel.textContent = 'Отмена';
        inline.appendChild(input);
        inline.appendChild(save);
        inline.appendChild(cancel);
        wrapper.appendChild(inline);
        dd.appendChild(wrapper);

        save.addEventListener('click', (e) => {
            e.stopPropagation();
            const name = input.value && input.value.trim();
            if (!name) return;
            const val = name;
            const arr = Array.isArray(customSubs[task.category]) ? customSubs[task.category] : [];
            if (!arr.includes(val)) arr.push(val);
            customSubs[task.category] = arr;
            localStorage.setItem('customSubcategories', JSON.stringify(customSubs));
            populateTaskSubcategoryDropdown(task);
            if (addTaskModal && addTaskModal.style.display === 'flex') showAddSubcategoriesFor(task.category, modalSubcategories);
        });
        cancel.addEventListener('click', (e) => { e.stopPropagation(); populateTaskSubcategoryDropdown(task); });
    }
}

function setupAddCategorySelector() {
    if (!taskCategory) return;
    let container = document.querySelector('.add-category-selector');
    if (!container) {
        container = document.createElement('div');
        container.className = 'add-category-selector';
        const badge = document.createElement('div');
        badge.className = 'add-category-badge';
        const dropdown = document.createElement('div');
        dropdown.className = 'add-category-dropdown';
        dropdown.innerHTML = `
            <button class="add-category-option" data-category="0">Категория не определена</button>
            <button class="add-category-option" data-category="1">Обязательные</button>
            <button class="add-category-option" data-category="2">Безопасность</button>
            <button class="add-category-option" data-category="5">Доступность простых радостей</button>
            <button class="add-category-option" data-category="3">Простые радости</button>
            <button class="add-category-option" data-category="4">Эго-радости</button>
        `;
        dropdown.querySelectorAll('.add-category-option').forEach(btn => {
            btn.addEventListener('click', () => {
                const v = btn.getAttribute('data-category') || '0';
                taskCategory.value = v;
                applyCategoryVisualToSelect();
                dropdown.classList.remove('show');
                activeDropdown = null;
                // show subcategory picker if available
                showAddSubcategoriesFor(parseInt(v));
            });
        });
        badge.addEventListener('click', (e) => {
            e.stopPropagation();
            if (activeDropdown && activeDropdown !== dropdown) {
                activeDropdown.classList.remove('show');
            }
            dropdown.classList.toggle('show');
            activeDropdown = dropdown;
        });
        container.appendChild(badge);
        container.appendChild(dropdown);
        taskCategory.insertAdjacentElement('afterend', container);
    }
    applyCategoryVisualToSelect();

    // Ensure subcategory controls container exists
    if (!document.querySelector('.add-subcategory-controls')) {
        const sc = document.createElement('div');
        sc.className = 'add-subcategory-controls';
        sc.style.display = 'none';
        taskCategory.parentElement.appendChild(sc);
    }
}

function showAddSubcategoriesFor(cat, targetContainer = null) {
    const controls = targetContainer || document.querySelector('.add-subcategory-controls');
    if (!controls) return;
    const customSubsRaw = localStorage.getItem('customSubcategories');
    const customSubs = customSubsRaw ? JSON.parse(customSubsRaw) : {};
    const list = [];
    const present = new Set();

    // 0) взять подкатегории из уже существующих задач выбранной категории
    const catNum = Number(cat);
    tasks.filter(t => t.category === catNum && typeof t.subcategory === 'string' && t.subcategory.trim())
         .forEach(t => {
            const norm = normalizeSubcategoryName(catNum, t.subcategory);
            const key = norm || t.subcategory.trim();
            const tag = key.toLowerCase();
            if (!present.has(tag)) { present.add(tag); list.push({ key, label: key }); }
         });

    // 1) добавить сохранённые пользователем подкатегории
    const saved = Array.isArray(customSubs[cat]) ? customSubs[cat] : [];
    saved.forEach(s => {
        const norm = normalizeSubcategoryName(cat, s);
        const key = norm || s;
        const tag = key.toLowerCase();
        if (!present.has(tag)) { present.add(tag); list.push({ key, label: s }); }
    });

    // 2) сортировка
    list.sort((a,b) => String(a.label).localeCompare(String(b.label), 'ru'));

    controls.innerHTML = '';

    // Существующие подкатегории в виде чипсов; состояние "без подкатегории" — по умолчанию (ничего не выбрано)
    list.forEach(item => {
        const b = document.createElement('button');
        b.className = 'add-subcategory-btn modal-subcat-chip cat-' + String(cat);
        b.type = 'button';
        b.dataset.sub = normalizeSubcategoryName(cat, item.key) || item.key;
        b.textContent = getSubcategoryLabel(cat, item.label);
        b.addEventListener('click', () => {
            controls.querySelectorAll('.add-subcategory-btn').forEach(x => x.classList.remove('selected'));
            b.classList.add('selected');
            const badge = document.querySelector('.add-category-badge'); if (badge) badge.setAttribute('data-sub', b.dataset.sub);
        });
        controls.appendChild(b);
    });

    // 3) Кнопка «+» для добавления новой подкатегории
    const plusBtn = document.createElement('button');
    plusBtn.type = 'button';
    plusBtn.className = 'add-subcategory-btn add-subcategory-plus cat-' + String(cat);
    plusBtn.setAttribute('aria-label', 'Добавить подкатегорию');
    plusBtn.innerHTML = '<i class="fas fa-plus"></i>';
    controls.appendChild(plusBtn);

    // 4) Скрытый инлайн-редактор, показывается по клику на «+»
    const editor = document.createElement('div');
    editor.className = 'subcat-inline-editor';
    const inp = document.createElement('input');
    inp.type = 'text';
    inp.placeholder = (String(cat) === '2') ? 'новая сфера безопасности' : (String(cat) === '5' ? 'Новая сложная радость' : ((String(cat) === '3' || String(cat) === '4') ? 'новая сфера удовольствия' : 'Новая подкатегория'));
    const actions = document.createElement('div');
    actions.className = 'subcat-editor-actions';
    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'icon-btn subcat-cancel';
    cancelBtn.innerHTML = '<i class="fas fa-times"></i>';
    const saveBtn = document.createElement('button');
    saveBtn.type = 'button';
    saveBtn.className = 'icon-btn subcat-save';
    saveBtn.innerHTML = '<i class="fas fa-check"></i>';
    actions.appendChild(cancelBtn);
    actions.appendChild(saveBtn);
    editor.appendChild(inp);
    editor.appendChild(actions);
    controls.appendChild(editor);

    const hideEditor = () => { editor.style.display = 'none'; inp.value = ''; };
    const showEditor = () => { editor.style.display = 'flex'; setTimeout(()=>inp.focus(), 30); };

    plusBtn.addEventListener('click', showEditor);
    cancelBtn.addEventListener('click', hideEditor);

    saveBtn.addEventListener('click', () => {
        const name = inp.value && inp.value.trim();
        if (!name) return;
        const val = name;
        const arrSaved = Array.isArray(customSubs[cat]) ? customSubs[cat] : [];
        if (!arrSaved.includes(val)) arrSaved.push(val);
        customSubs[cat] = arrSaved;
        localStorage.setItem('customSubcategories', JSON.stringify(customSubs));
        hideEditor();
        showAddSubcategoriesFor(cat, targetContainer);
        if (addTaskModal && addTaskModal.style.display === 'flex') {
            showAddSubcategoriesFor(cat, modalSubcategories);
        }
    });

    controls.classList.add('show');
    controls.style.display = 'flex';
}

window.addEventListener('load', async () => {
    await loadAssets();
    await loadTasks();

    // Register Service Worker for PWA/offline
    if ('serviceWorker' in navigator) {
        try { await navigator.serviceWorker.register('/sw.js'); } catch (e) {}
    }

    setupAddCategorySelector();

    if (typeof addMultipleBtn !== 'undefined' && addMultipleBtn) {
        addMultipleBtn.style.display = 'none';
    }

    applyCategoryVisualToSelect();
    updateNotifyToggle();
    updateSectionTaskCounts();

    if (navigator.permissions && navigator.permissions.query) {
        try {
            const status = await navigator.permissions.query({ name: 'notifications' });
            const update = () => updateNotifyToggle();
            update();
            status.onchange = update;
        } catch (e) {}
    }

    if (!navigator.vibrate) {
        console.log("Вибрация не поддерживается на этом устройстве");
    }
});

// НОВАЯ РЕАЛИЗАЦИЯ ТАЙМЕРА (точный и работающий в фоне)

// Поддержка Wake Lock API, чтобы экран не засыпал во врея таймера
async function requestWakeLock() {
    try {
        if ('wakeLock' in navigator && !wakeLock) {
            wakeLock = await navigator.wakeLock.request('screen');
            wakeLock.addEventListener('release', () => {
                wakeLock = null;
            });
        }
    } catch (_) {
        // игнорируем ошибку
    }
}

async function releaseWakeLock() {
    try {
        if (wakeLock) {
            await wakeLock.release();
            wakeLock = null;
        }
    } catch (_) {}
}

document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && timerRunning) {
        requestWakeLock();
    }
});

// Звуковой сигнал по завершении таймера в стиле Wind Chime
function playWindChime() {
    if (!timerSoundEnabled) return;

    try {
        const AudioCtor = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtor) return;

        const ctx = new AudioCtor();
        const masterGain = ctx.createGain();

        masterGain.gain.setValueAtTime(0.001, ctx.currentTime);
        masterGain.gain.exponentialRampToValueAtTime(0.5, ctx.currentTime + 0.1);
        masterGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 3.0);
        masterGain.connect(ctx.destination);

        const tones = [
            { frequency: 659, start: 0, length: 1.5, type: 'sine', volume: 0.3 },
            { frequency: 784, start: 0.1, length: 1.3, type: 'sine', volume: 0.25 },
            { frequency: 880, start: 0.2, length: 1.1, type: 'sine', volume: 0.2 },
            { frequency: 1047, start: 0.3, length: 0.9, type: 'sine', volume: 0.15 },
            { frequency: 1175, start: 0.4, length: 0.7, type: 'sine', volume: 0.1 }
        ];

        tones.forEach(({ frequency, start, length, type, volume = 0.3 }) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = type;
            osc.frequency.setValueAtTime(frequency, ctx.currentTime + start);

            gain.gain.setValueAtTime(0.001, ctx.currentTime + start);
            gain.gain.exponentialRampToValueAtTime(volume, ctx.currentTime + start + 0.05);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + length);

            osc.connect(gain).connect(masterGain);
            osc.start(ctx.currentTime + start);
            osc.stop(ctx.currentTime + start + length + 0.1);
        });

        setTimeout(() => ctx.close(), 3500);
    } catch (error) {
        console.error('Error playing Wind Chime:', error);
    }
}

// Функция для запуска таймера
function startTimer() {
    if (timerRunning) return;
    requestWakeLock();

    timerRunning = true;
    setQuickAddVisible(true);
    // при возобновлении с паузы
    if (timerPausedTime > 0) {
        timerEndAt = Date.now() + (timerPausedTime * 1000);
        timerPausedTime = 0;
    }
    // при перво зауске
    if (!timerEndAt) {
        const total = Math.max(1, parseInt(timerMinutes.value)) * 60;
        timerEndAt = Date.now() + total * 1000;
    }
    timerStartTime = Date.now();

    // Сообщае серверу о распсании пуш-уведомления
    try {
        ensurePushSubscribed().then(() => {
            fetch('/api/timer/schedule', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ endAt: timerEndAt, taskText: currentTask ? currentTask.text : '' })
            }).catch(() => {});
        }).catch(() => {});
    } catch (_) {}

    // Планируем локальный fallback
    if (timerEndTimeoutId) clearTimeout(timerEndTimeoutId);
    const delay = Math.max(0, timerEndAt - Date.now());
    timerEndTimeoutId = setTimeout(() => {
        if (!timerRunning) return;
        const msg = currentTask ? `Задача: ${currentTask.text}` : undefined;
        stopTimer();
        showNotification(msg);
        timerCompleteOptions.style.display = 'flex';
        const controls = document.querySelector('.timer-controls');
        if (controls) controls.style.display = 'none';
    }, delay);
    
    // Использем Web Worker для точного отсчета времени в фоне
    if (typeof(Worker) !== "undefined") {
        if (timerWorker === null) {
            timerWorker = new Worker(URL.createObjectURL(new Blob([`
                let interval;
                self.onmessage = function(e) {
                    if (e.data === 'start') {
                        interval = setInterval(() => {
                            self.postMessage('tick');
                        }, 1000);
                    } else if (e.data === 'stop') {
                        clearInterval(interval);
                    }
                };
            `], {type: 'application/javascript'})));
            
            timerWorker.onmessage = function(e) {
                if (e.data === 'tick') {
                    timerTime = Math.max(0, Math.ceil((timerEndAt - Date.now()) / 1000));
                    updateTimerDisplay();

                    if (timerTime <= 0) {
                        stopTimer();
                        showNotification(currentTask ? `Задача: ${currentTask.text}` : undefined);
                        timerCompleteOptions.style.display = 'flex';
                        document.querySelector('.timer-controls').style.display = 'none';
                    }
                }
            };
        }
        timerWorker.postMessage('start');
    } else {
        // Fallback дл браузеров без поддежки Web Workers
        timerInterval = setInterval(() => {
            timerTime = Math.max(0, Math.ceil((timerEndAt - Date.now()) / 1000));
            updateTimerDisplay();

            if (timerTime <= 0) {
                stopTimer();
                showNotification(currentTask ? `Задача: ${currentTask.text}` : undefined);
                timerCompleteOptions.style.display = 'flex';
                document.querySelector('.timer-controls').style.display = 'none';
            }
        }, 1000);
    }
}

// Функция для паузы таймера
function pauseTimer() {
    if (!timerRunning) return;

    stopTimer();
    if (timerEndTimeoutId) {
        clearTimeout(timerEndTimeoutId);
        timerEndTimeoutId = null;
    }
    timerPausedTime = Math.max(0, Math.ceil((timerEndAt - Date.now()) / 1000));
}

// Функция для остановки таймра
function stopTimer() {
    timerRunning = false;
    setQuickAddVisible(false);
    releaseWakeLock();

    if (timerEndTimeoutId) {
        clearTimeout(timerEndTimeoutId);
        timerEndTimeoutId = null;
    }

    if (timerWorker) {
        timerWorker.postMessage('stop');
    } else {
        clearInterval(timerInterval);
    }
    
    if (timerAnimationFrame) {
        cancelAnimationFrame(timerAnimationFrame);
        timerAnimationFrame = null;
    }
}

async function cancelServerSchedule() {
    try {
        if (timerEndAt > 0) {
            await fetch('/api/timer/cancel', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ endAt: timerEndAt })
            });
        }
    } catch (_) {}
}

// Функции для сброра таймера
function resetTimer() {
    // отменяем только локальный таймер, серверый не трогаем, чтобы пауза/сброс были явными
    stopTimer();
    if (timerEndTimeoutId) {
        clearTimeout(timerEndTimeoutId);
        timerEndTimeoutId = null;
    }
    timerEndAt = 0;
    timerTime = Math.max(1, parseInt(timerMinutes.value)) * 60;
    timerPausedTime = 0;
    updateTimerDisplay();
}

// Обраотчки событий
sections.forEach(section => {
    section.addEventListener('click', () => {
        const categories = section.dataset.category;
        const task = getRandomTask(categories);
        if (task) showTimer(task);
    });
    const rnd = section.querySelector('.section-random-btn');
    if (rnd) rnd.addEventListener('click', (e) => {
        e.stopPropagation();
        const categories = section.dataset.category;
        const task = getRandomTask(categories);
        if (task) showTimer(task);
    });
    const add = section.querySelector('.section-add-btn');
    if (add) add.addEventListener('click', (e) => {
        e.stopPropagation();
        showArchive = false;
        // open modal restricted to this section: only show "Без катгоии" or subcategories for this section
        openAddModal(undefined, { restrict: 'section', sectionCats: section.dataset.category });
    });
});



showTasksBtn.addEventListener('click', () => {
    showArchive = false;
    taskList.style.display = 'block';
    displayTasks();
    showAddSubcategoriesFor(parseInt(taskCategory.value));
});

if (archiveBtn) {
    archiveBtn.addEventListener('click', () => {
        openDailyActivityModal();
    });
}

hideTasksBtn.addEventListener('click', () => {
    taskList.style.display = 'none';
});

taskCategory.addEventListener('change', applyCategoryVisualToSelect);

addTaskBtn.addEventListener('click', (e) => { e.preventDefault(); openAddModal(parseInt(taskCategory.value) || 0); });

// Modal elements
const addTaskModal = document.getElementById('addTaskModal');
const modalBackdrop = document.getElementById('modalBackdrop');
const modalTaskText = document.getElementById('modalTaskText');
const modalCategoryOptions = document.getElementById('modalCategoryOptions');
const modalSubcategories = document.getElementById('modalSubcategories');
const modalAddTaskBtn = document.getElementById('modalAddTaskBtn');
const modalCancelBtn = document.getElementById('modalCancelBtn');
const modalCloseBtn = document.getElementById('modalCloseBtn');
const modalTaskTextDefaultPlaceholder = modalTaskText ? modalTaskText.getAttribute('placeholder') : '';

function getCategoryColor(cat) {
    switch (Number(cat)) {
        case 0: return '#f5f5f5';
        case 1: return '#fff9c4';
        case 2: return '#bbdefb';
        case 3: return '#c8e6c9';
        case 4: return '#ffcdd2';
        case 5: return '#d1c4e9';
        default: return '#ffffff';
    }
}

// Lighten hex color towards white by factor (0..1) where 1 keeps original, 0 -> white
function lightenHex(hex, factor) {
    try {
        if (!hex) return hex;
        const h = hex.replace('#','');
        const r = parseInt(h.substring(0,2),16);
        const g = parseInt(h.substring(2,4),16);
        const b = parseInt(h.substring(4,6),16);
        const nr = Math.round(r + (255 - r) * (1 - factor));
        const ng = Math.round(g + (255 - g) * (1 - factor));
        const nb = Math.round(b + (255 - b) * (1 - factor));
        return `rgb(${nr}, ${ng}, ${nb})`;
    } catch (e) { return hex; }
}

function getCategoryGroupBg(cat) {
    switch (Number(cat)) {
        case 0: return '#fafafa';
        case 1: return '#fffde7';
        case 2: return '#e3f2fd';
        case 3: return '#e8f5e9';
        case 4: return '#ffebee';
        case 5: return '#ede7f6';
        default: return '#ffffff';
    }
}

function applyModalBackground(cat) {
    const modalContent = addTaskModal ? addTaskModal.querySelector('.modal-content') : null;
    if (!modalContent) return;
    // use category group background (lighter) instead of sticker color
    const color = getCategoryGroupBg(cat);
    modalContent.style.backgroundColor = color;
    // ensure readable text color
    modalContent.style.color = '#333';
    // style modal buttons according to category
    applyModalButtonStyles(cat);
}

function applyModalButtonStyles(cat) {
    const addBtn = document.getElementById('modalAddTaskBtn');
    const cancelBtn = document.getElementById('modalCancelBtn');
    if (!addBtn || !cancelBtn) return;
    // remove existing category classes
    addBtn.className = addBtn.className.split(' ').filter(c => !c.startsWith('cat-')).join(' ').trim();
    cancelBtn.className = cancelBtn.className.split(' ').filter(c => !c.startsWith('cat-')).join(' ').trim();
    // ensure base class
    if (!addBtn.classList.contains('modal-btn')) addBtn.classList.add('modal-btn');
    if (!cancelBtn.classList.contains('modal-btn')) cancelBtn.classList.add('modal-btn');
    // apply category class
    addBtn.classList.add(`cat-${cat}`);
    // cancel is a secondary variant: use cat-{cat}-alt if desired, but for simplicity use same with muted style
    cancelBtn.classList.add(`cat-${cat}`);
}

function applyMoveTaskModalButtonStyles(cat) {
    const moveOkBtn = document.getElementById('moveTaskOk');
    const moveCancelBtn = document.getElementById('moveTaskCancel');
    if (!moveOkBtn || !moveCancelBtn) return;
    // remove existing category classes from move button
    moveOkBtn.className = moveOkBtn.className.split(' ').filter(c => !c.startsWith('cat-')).join(' ').trim();
    // remove existing category classes from cancel button
    moveCancelBtn.className = moveCancelBtn.className.split(' ').filter(c => !c.startsWith('cat-')).join(' ').trim();
    // ensure base class
    if (!moveOkBtn.classList.contains('modal-btn')) moveOkBtn.classList.add('modal-btn');
    if (!moveCancelBtn.classList.contains('modal-btn')) moveCancelBtn.classList.add('modal-btn');
    // apply category class only to move button (primary action)
    moveOkBtn.classList.add(`cat-${cat}`);
    // cancel button stays gray (secondary action) - enforce gray color with inline styles
    moveCancelBtn.style.backgroundColor = '#9E9E9E';
    moveCancelBtn.style.color = '#fff';
}

function renderModalCategoryOptions(allowedCategories = null) {
    const container = modalCategoryOptions;
    if (!container) return;
    container.innerHTML = '';
    const cats = [0,1,2,5,3,4];
    const labels = {0: 'Категория не определена',1: 'Обязательные',2: 'Система безопасности',3: 'Простые радости',4: 'Эго-радости',5: 'Доступность простых радостей'};
    cats.forEach(c => {
        if (allowedCategories && !allowedCategories.map(String).includes(String(c))) return;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `modal-category-btn cat-${c}`;
        btn.dataset.category = String(c);
        btn.textContent = labels[c] || String(c);
        btn.addEventListener('click', () => {
            container.querySelectorAll('.modal-category-btn').forEach(x => x.classList.remove('selected'));
            btn.classList.add('selected');
            applyModalBackground(btn.dataset.category);
            // show subcategory controls for any category that supports them
            showAddSubcategoriesFor(parseInt(btn.dataset.category), modalSubcategories);
            container.dataset.selected = btn.dataset.category;
        });
        container.appendChild(btn);
    });
}

// Modal helper functions
function openConfirmModal({ title='Подтверждение', message='', confirmText='Ок', cancelText='Отмена', requireCheck=false, checkboxLabel='Подтверждаю действие', hideCancel=false, compact=false, onConfirm=null }) {
    const m = document.getElementById('confirmModal'); if (!m) return;
    const backdrop = document.getElementById('confirmBackdrop');
    m.setAttribute('aria-hidden','false'); m.style.display = 'flex';
    const contentEl = m.querySelector('.modal-content');
    if (contentEl) contentEl.classList.toggle('compact', !!compact);
    const titleEl = m.querySelector('#confirmTitle'); const msgEl = m.querySelector('#confirmMessage');
    const wrap = m.querySelector('#confirmCheckWrap'); const chk = m.querySelector('#confirmCheckbox'); const chkLabel = m.querySelector('#confirmCheckboxLabel');
    const okBtn = m.querySelector('#confirmOkBtn'); const cancelBtn = m.querySelector('#confirmCancelBtn'); const closeBtn = m.querySelector('#confirmCloseBtn');
    if (titleEl) titleEl.textContent = title || '';
    if (msgEl) msgEl.textContent = message || '';
    if (chkLabel) chkLabel.textContent = checkboxLabel || '';
    if (wrap) wrap.style.display = requireCheck ? 'flex' : 'none';
    if (chk) chk.checked = false;
    okBtn.disabled = !!requireCheck;
    const onChange = () => { okBtn.disabled = requireCheck && !chk.checked; };
    if (chk) chk.addEventListener('change', onChange);
    const cleanup = () => {
        if (chk) chk.removeEventListener('change', onChange);
        okBtn.removeEventListener('click', onOk);
        cancelBtn.removeEventListener('click', onClose);
        closeBtn.removeEventListener('click', onClose);
        backdrop.removeEventListener('click', onClose);
        const contentEl2 = m.querySelector('.modal-content');
        if (contentEl2) contentEl2.classList.remove('compact');
        m.setAttribute('aria-hidden','true'); m.style.display = 'none';
    };
    const onClose = () => { cleanup(); };
    const onOk = () => { cleanup(); if (typeof onConfirm === 'function') onConfirm(); };
    okBtn.textContent = confirmText || 'Ок'; cancelBtn.textContent = cancelText || 'Отмена';
    cancelBtn.style.display = hideCancel ? 'none' : 'inline-flex';
    okBtn.addEventListener('click', onOk);
    cancelBtn.addEventListener('click', onClose);
    closeBtn.addEventListener('click', onClose);
    backdrop.addEventListener('click', onClose);
}
function openInfoModal(message, title='Сообщение') { openConfirmModal({ title, message, confirmText: 'Ок', hideCancel: true }); }

function renderCategoryButtons(container, allowed=null) {
    if (!container) return;
    container.innerHTML = '';
    const cats = [0,1,2,5,3,4];
    const labels = {0: 'Категория не определена',1: 'Обязательные',2: 'Система безопасности',3: 'Простые радости',4: 'Эго-радости',5: 'Доступность простых радостей'};
    cats.forEach(c => {
        if (allowed && !allowed.map(String).includes(String(c))) return;
        const btn = document.createElement('button'); btn.type='button'; btn.className=`modal-category-btn cat-${c}`; btn.dataset.category=String(c); btn.textContent = labels[c] || String(c);
        btn.addEventListener('click', () => {
            container.querySelectorAll('.modal-category-btn').forEach(x=>x.classList.remove('selected'));
            btn.classList.add('selected');
            // when used in move modal, show relevant subcategories
            const subCont = document.getElementById('moveSubcategories'); if (subCont) showAddSubcategoriesFor(parseInt(btn.dataset.category), subCont);
        });
        container.appendChild(btn);
    });
}

let currentSubcatContext = null;
function openSubcategoryActions(category, subName) {
    currentSubcatContext = { category: parseInt(category), subName };
    const m = document.getElementById('subcatActionsModal'); if (!m) return;
    m.setAttribute('aria-hidden','false'); m.style.display='flex';
}

// Setup subcategory actions modal behavior: rename, move, delete
(function setupSubcatActions(){
    const m = document.getElementById('subcatActionsModal'); if (!m) return;
    const close = () => { m.setAttribute('aria-hidden','true'); m.style.display='none'; };
    const closeBtn = document.getElementById('subcatActionsClose'); const cancelBtn = document.getElementById('subcatActionsCancel'); const backdrop = document.getElementById('subcatActionsBackdrop');
    [closeBtn,cancelBtn,backdrop].forEach(el => el && el.addEventListener('click', close));

    const renameOk = document.getElementById('renameSubcatOk'); const renameCancel = document.getElementById('renameSubcatCancel'); const renameClose = document.getElementById('renameSubcatClose');
    const renameModal = document.getElementById('renameSubcatModal'); const renameInput = document.getElementById('renameSubcatInput');
    if (renameOk) {
        renameOk.addEventListener('click', () => {
            const ctx = currentSubcatContext; if (!ctx) return; const newName = (renameInput.value||'').trim(); if (!newName) return;
            // update customSubcategories and tasks
            const raw = localStorage.getItem('customSubcategories'); const cs = raw?JSON.parse(raw):{}; const arr = Array.isArray(cs[ctx.category])?cs[ctx.category].slice():[];
            const idx = arr.indexOf(ctx.subName);
            if (idx !== -1) arr[idx] = newName; else if (!arr.includes(newName)) arr.push(newName);
            cs[ctx.category] = Array.from(new Set(arr)); localStorage.setItem('customSubcategories', JSON.stringify(cs));
            tasks = tasks.map(t => (t.category === ctx.category && t.subcategory === ctx.subName) ? ({...t, subcategory: newName}) : t);
            saveTasks();
            displayTasks();
            try {
                if (addTaskModal && addTaskModal.style.display === 'flex') {
                    let selCat = null;
                    if (typeof modalPrimaryCategory === 'number' && modalPrimaryCategory !== null) selCat = modalPrimaryCategory;
                    else if (modalCategoryOptions && modalCategoryOptions.dataset && modalCategoryOptions.dataset.selected) selCat = parseInt(modalCategoryOptions.dataset.selected);
                    if (typeof selCat === 'number' && !Number.isNaN(selCat)) {
                        showAddSubcategoriesFor(selCat, modalSubcategories);
                    }
                    const badge = document.querySelector('.add-category-badge');
                    if (badge && badge.getAttribute('data-sub') === ctx.subName) {
                        badge.setAttribute('data-sub', newName);
                    }
                }
            } catch (_) {}
            // close rename modal
            if (renameModal) { renameModal.setAttribute('aria-hidden','true'); renameModal.style.display='none'; }
        });
    }
    if (renameCancel) renameCancel.addEventListener('click', () => { if (renameModal) { renameModal.setAttribute('aria-hidden','true'); renameModal.style.display='none'; } });
    if (renameClose) renameClose.addEventListener('click', () => { if (renameModal) { renameModal.setAttribute('aria-hidden','true'); renameModal.style.display='none'; } });

    // wire subcat action buttons
    m.querySelectorAll('.subcat-action-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const action = btn.dataset.action; const ctx = currentSubcatContext; if (!ctx) return; close();
            if (action === 'rename') {
                const r = document.getElementById('renameSubcatModal'); if (!r) return; const input = document.getElementById('renameSubcatInput'); input.value = ctx.subName || ''; r.setAttribute('aria-hidden','false'); r.style.display='flex';
            } else if (action === 'delete') {
                openConfirmModal({ title: 'Удалить подкатегорию', message: `Удалить подкатегорию "${ctx.subName}"? Задачи останутся без подкатегории.`, confirmText: 'Удалить', cancelText: 'Отмена', requireCheck: false, onConfirm: () => {
                    const raw = localStorage.getItem('customSubcategories'); const cs = raw?JSON.parse(raw):{}; const arr = Array.isArray(cs[ctx.category])?cs[ctx.category]:[]; cs[ctx.category] = arr.filter(n=>n!==ctx.subName); localStorage.setItem('customSubcategories', JSON.stringify(cs)); tasks = tasks.map(t=> (t.category===ctx.category && t.subcategory===ctx.subName) ? ({...t, subcategory: undefined}) : t);
saveTasks();
displayTasks();
try {
    if (addTaskModal && addTaskModal.style.display === 'flex') {
        let selCat = null;
        if (typeof modalPrimaryCategory === 'number' && modalPrimaryCategory !== null) {
            selCat = modalPrimaryCategory;
        } else if (modalCategoryOptions && modalCategoryOptions.dataset && modalCategoryOptions.dataset.selected) {
            selCat = parseInt(modalCategoryOptions.dataset.selected);
        }
        if (typeof selCat === 'number' && !Number.isNaN(selCat)) {
            showAddSubcategoriesFor(selCat, modalSubcategories);
        }
        const badge = document.querySelector('.add-category-badge');
        if (badge && badge.getAttribute('data-sub') === ctx.subName) {
            badge.setAttribute('data-sub', '');
        }
    }
} catch (_) {} } });
            } else if (action === 'move') {
                const mv = document.getElementById('moveTasksModal'); if (!mv) return; mv.setAttribute('aria-hidden','false'); mv.style.display='flex';
                // render category options
                const catCont = document.getElementById('moveTasksCategoryOptions'); const subCont = document.getElementById('moveTasksSubcategories'); renderCategoryButtons(catCont);
                // clear subCont until a category selected
                if (subCont) { subCont.innerHTML=''; subCont.style.display='none'; }
                // wire ok/cancel
                const okBtn = document.getElementById('moveTasksOk'); const cancel = document.getElementById('moveTasksCancel'); const closeBtn = document.getElementById('moveTasksClose'); const backdrop2 = document.getElementById('moveTasksBackdrop');
                if (okBtn) okBtn.disabled = false;
                const closeMove = () => { mv.setAttribute('aria-hidden','true'); mv.style.display='none'; };
                if (cancel) cancel.onclick = closeMove; if (closeBtn) closeBtn.addEventListener('click', closeMove); if (backdrop2) backdrop2.addEventListener('click', closeMove);

                // Handle category selection
                const catBtns = catCont.querySelectorAll('.modal-category-btn');
                catBtns.forEach(btn => {
                    btn.onclick = (e) => {
                        e.stopPropagation();
                        catBtns.forEach(b => b.classList.remove('selected'));
                        btn.classList.add('selected');
                        const cat = parseInt(btn.dataset.category);
                        showAddSubcategoriesFor(cat, subCont);
                        const modalContent = mv.querySelector('.modal-content');
                        if (modalContent) {
                            modalContent.style.background = btn.dataset.color || '#fff';
                        }
                    };
                });

                if (okBtn) okBtn.onclick = () => {
                    const sel = catCont.querySelector('.modal-category-btn.selected'); if (!sel) return; const targetCat = parseInt(sel.dataset.category);
                    const selSub = subCont ? subCont.querySelector('.add-subcategory-btn.selected') : null; const targetSub = selSub ? selSub.dataset.sub || null : null;
                    // perform move
                    tasks = tasks.map(t => (t.category === ctx.category && t.subcategory === ctx.subName) ? ({...t, category: targetCat, subcategory: targetSub || undefined, statusChangedAt: Date.now()}) : t);
                    saveTasks(); displayTasks(); closeMove();
                };
            }
        });
    });
})();


function openAddModal(initialCategory, options = {}) {
    // capture quick-add context flags as a fallback
    if (options && options.quick) {
        if (typeof quickAddContext === 'object') {
            quickAddContext.active = true;
            quickAddContext.resumeTimer = !!options.reopenTimer;
        }
    }
    if (showArchive) { openInfoModal('Нельзя добавлять задачи в списке выполненных'); return; }
    if (!addTaskModal) return;
    addTaskModal.setAttribute('aria-hidden', 'false');
    addTaskModal.style.display = 'flex';
    modalTaskText.value = '';
    modalPrimaryCategory = null;

    if (options.restrict === 'section') {
        const sectionCats = options.sectionCats || '';
        const arr = String(sectionCats).split(',').map(s => s.trim()).filter(Boolean);
        // allowed categories are those in the section (do NOT include category 0 when opening from a section)
        const allowed = arr.length ? arr.map(Number) : [0];
        const primary = allowed.length ? Number(allowed[0]) : 0;
        modalPrimaryCategory = primary;
        renderModalCategoryOptions(allowed);

        // preselect first category button if present
        if (modalCategoryOptions) {
            const firstBtn = modalCategoryOptions.querySelector('.modal-category-btn');
            if (firstBtn) {
                firstBtn.click();
                modalCategoryOptions.dataset.selected = firstBtn.dataset.category;
            }
        }

        // determine if this primary category supports subcategories (defaults or saved)
        const customSubsRaw = localStorage.getItem('customSubcategories');
        const customSubs = customSubsRaw ? JSON.parse(customSubsRaw) : {};
        const hasDefaults = (primary === 2 || primary === 4);
        const hasSaved = Array.isArray(customSubs[primary]) && customSubs[primary].length > 0;
        const hasExisting = tasks.some(t => t.category === primary && typeof t.subcategory === 'string' && t.subcategory.trim());
        if (hasDefaults || hasSaved || hasExisting) {
            showAddSubcategoriesFor(primary, modalSubcategories);
        } else {
            if (modalSubcategories) { modalSubcategories.classList.remove('show'); modalSubcategories.style.display = 'none'; }
        }
        applyModalBackground(primary);
    } else {
        renderModalCategoryOptions();
        if (modalCategoryOptions && typeof initialCategory !== 'undefined' && initialCategory !== null) {
            const btn = modalCategoryOptions.querySelector(`.modal-category-btn[data-category="${initialCategory}"]`);
            if (btn) btn.click();
            else applyModalBackground(initialCategory);
        } else {
            // default neutral background
            applyModalBackground(initialCategory || 0);
        }
        showAddSubcategoriesFor(parseInt(initialCategory) || 0, modalSubcategories);
    }

    setTimeout(() => modalTaskText.focus(), 50);
}

function closeAddModal() {
    if (!addTaskModal) return;
    addTaskModal.setAttribute('aria-hidden', 'true');
    addTaskModal.style.display = 'none';
    if (modalSubcategories) { modalSubcategories.classList.remove('show'); modalSubcategories.style.display = 'none'; }
    // If opened from timer quick-add and timer was running, resume automatically
    try {
        const shouldResume = quickAddContext && quickAddContext.active && quickAddContext.resumeTimer;
        if (quickAddContext) { quickAddContext.active = false; quickAddContext.resumeTimer = false; }
        if (shouldResume) {
            startTimer();
        }
    } catch (_) {}
}

modalBackdrop && modalBackdrop.addEventListener('click', () => closeAddModal());
modalCloseBtn && modalCloseBtn.addEventListener('click', () => closeAddModal());
modalCancelBtn && modalCancelBtn.addEventListener('click', (e) => { e.preventDefault(); closeAddModal(); });

modalAddTaskBtn && modalAddTaskBtn.addEventListener('click', () => {
    const raw = modalTaskText.value;
    const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);
    let category = 0;
    if (modalCategoryOptions && modalCategoryOptions.dataset && modalCategoryOptions.dataset.selected) category = parseInt(modalCategoryOptions.dataset.selected);
    if (lines.length === 0) return;
    const selBtn = modalSubcategories ? modalSubcategories.querySelector('.add-subcategory-btn.selected') : null;
    let selectedSub = null;
    if (selBtn && typeof selBtn.dataset.sub !== 'undefined') selectedSub = selBtn.dataset.sub || null;
    if (selectedSub && typeof modalPrimaryCategory === 'number' && modalPrimaryCategory !== null) {
        category = modalPrimaryCategory;
    }
    if (lines.length > 1) {
        openConfirmModal({
            title: 'Подтверждение',
            message: `Добавить ${lines.length} задач?`,
            confirmText: 'Добавить',
            cancelText: 'Отмена',
            requireCheck: false,
            compact: true,
            onConfirm: () => {
                const added = addLinesAsTasks(lines, category, selectedSub);
                if (added > 0) showToastNotification('Задачи добавлены', `Добавлено ${added} задач`);
            }
        });
        return;
    }
    addLinesAsTasks(lines, category, selectedSub);
});

// Move Task Modal
let currentMoveTaskContext = null;
const moveTaskModal = document.getElementById('moveTaskModal');
const moveTaskBackdrop = document.getElementById('moveTaskBackdrop');
const moveTaskClose = document.getElementById('moveTaskClose');
const moveCategoryOptions = document.getElementById('moveCategoryOptions');
const moveSubcategories = document.getElementById('moveSubcategories');
const moveTaskOk = document.getElementById('moveTaskOk');
const moveTaskCancel = document.getElementById('moveTaskCancel');

function openMoveTaskModal(taskId) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    currentMoveTaskContext = { taskId };

    if (!moveTaskModal) return;
    moveTaskModal.setAttribute('aria-hidden', 'false');
    moveTaskModal.style.display = 'flex';

    // Render category options
    renderMoveCategoryOptions();

    // Clear subcategories until a category is selected
    if (moveSubcategories) {
        moveSubcategories.innerHTML = '';
        moveSubcategories.style.display = 'none';
    }

    // Apply neutral background and button styles
    const modalContent = moveTaskModal.querySelector('.modal-content');
    if (modalContent) {
        modalContent.style.backgroundColor = '#fffaf0';
        modalContent.style.color = '#333';
    }
    // Apply initial button styles
    const moveOkBtn = document.getElementById('moveTaskOk');
    const moveCancelBtn = document.getElementById('moveTaskCancel');
    if (moveOkBtn) {
        moveOkBtn.className = 'modal-btn cat-0';
        moveOkBtn.style.backgroundColor = '';
        moveOkBtn.style.color = '';
    }
    if (moveCancelBtn) {
        moveCancelBtn.className = 'modal-btn';
        moveCancelBtn.style.backgroundColor = '#9E9E9E';
        moveCancelBtn.style.color = '#fff';
    }
}

function closeMoveTaskModal() {
    if (!moveTaskModal) return;
    moveTaskModal.setAttribute('aria-hidden', 'true');
    moveTaskModal.style.display = 'none';
    if (moveSubcategories) {
        moveSubcategories.classList.remove('show');
        moveSubcategories.style.display = 'none';
    }
    currentMoveTaskContext = null;
}

function renderMoveCategoryOptions() {
    if (!moveCategoryOptions) return;
    moveCategoryOptions.innerHTML = '';
    const cats = [0, 1, 2, 5, 3, 4];
    const labels = {
        0: 'Категория не определена',
        1: 'Обязательные',
        2: 'Система безопасности',
        3: 'Простые радости',
        4: 'Эго-радости',
        5: 'Доступность простых радостей'
    };

    cats.forEach(c => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `modal-category-btn cat-${c}`;
        btn.dataset.category = String(c);
        btn.textContent = labels[c] || String(c);
        btn.addEventListener('click', () => {
            moveCategoryOptions.querySelectorAll('.modal-category-btn').forEach(x => x.classList.remove('selected'));
            btn.classList.add('selected');
            moveCategoryOptions.dataset.selected = btn.dataset.category;
            // Show subcategories for selected category
            showAddSubcategoriesFor(parseInt(btn.dataset.category), moveSubcategories);
            // Apply background color and button styles
            const modalContent = moveTaskModal.querySelector('.modal-content');
            if (modalContent) {
                const color = getCategoryGroupBg(parseInt(btn.dataset.category));
                modalContent.style.backgroundColor = color;
            }
            // Apply category-specific button styles
            applyMoveTaskModalButtonStyles(parseInt(btn.dataset.category));
        });
        moveCategoryOptions.appendChild(btn);
    });
}

// Event listeners for move task modal
if (moveTaskBackdrop) moveTaskBackdrop.addEventListener('click', closeMoveTaskModal);
if (moveTaskClose) moveTaskClose.addEventListener('click', closeMoveTaskModal);
if (moveTaskCancel) moveTaskCancel.addEventListener('click', closeMoveTaskModal);

if (moveTaskOk) {
    moveTaskOk.addEventListener('click', () => {
        if (!currentMoveTaskContext) return;

        const selectedCatBtn = moveCategoryOptions ? moveCategoryOptions.querySelector('.modal-category-btn.selected') : null;
        if (!selectedCatBtn) {
            openInfoModal('Пожалуйста, выберите категорию');
            return;
        }

        const targetCategory = parseInt(selectedCatBtn.dataset.category);
        const selectedSubBtn = moveSubcategories ? moveSubcategories.querySelector('.add-subcategory-btn.selected') : null;
        const targetSubcategory = selectedSubBtn ? (selectedSubBtn.dataset.sub || null) : null;

        // Move the task
        const taskIndex = tasks.findIndex(t => t.id === currentMoveTaskContext.taskId);
        if (taskIndex !== -1) {
            const updated = { ...tasks[taskIndex], category: targetCategory };
            if (targetSubcategory) {
                updated.subcategory = targetSubcategory;
            } else {
                delete updated.subcategory;
            }
            tasks[taskIndex] = updated;

            // If moving from category 0 (undefined) to a defined category, activate it
            if (tasks[taskIndex].category === 0 && targetCategory !== 0 && !tasks[taskIndex].active) {
                tasks[taskIndex].active = true;
                tasks[taskIndex].statusChangedAt = Date.now();
            }

            saveTasks();
            displayTasks();
            closeMoveTaskModal();
            const categoryName = getCategoryName(targetCategory);
            showToastNotification('Задача перенесена', `Задача перемещена в ${categoryName}`);
        }
    });
}

if (typeof addMultipleBtn !== 'undefined' && addMultipleBtn) {
    addMultipleBtn.style.display = 'none';
}

exportTasksBtn.addEventListener('click', exportTasks);

importFile.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        importTasks(e.target.files[0]);
        e.target.value = ''; // Сбрасываем значение input
    }
});

// Paste tasks handling (supports inline area and modal)
const pasteTasksBtn = document.getElementById('pasteTasksBtn');
// Modal elements (scoped to modal to avoid duplicate IDs)
const pasteTasksModal = document.getElementById('pasteTasksModal');
const pasteTasksBackdrop = pasteTasksModal ? pasteTasksModal.querySelector('#pasteTasksBackdrop') : null;
const pasteTasksCloseBtn = pasteTasksModal ? pasteTasksModal.querySelector('#pasteTasksCloseBtn') : null;
const pasteTasksInput = pasteTasksModal ? pasteTasksModal.querySelector('#pasteTasksInput') : null;
const pasteTasksAddBtn = pasteTasksModal ? pasteTasksModal.querySelector('#pasteTasksAddBtn') : null;
const pasteTasksCancelBtnModal = pasteTasksModal ? pasteTasksModal.querySelector('#pasteTasksCancelBtn') : null;

function openPasteModal() {
    if (showArchive) { openInfoModal('Нельзя добавлять задачи в списке выполненных'); return; }
    if (!pasteTasksModal) return;
    pasteTasksModal.setAttribute('aria-hidden','false');
    pasteTasksModal.style.display = 'flex';
    if (pasteTasksInput) { pasteTasksInput.value = ''; setTimeout(()=>pasteTasksInput.focus(), 50); }
}
function closePasteModal() {
    if (!pasteTasksModal) return;
    pasteTasksModal.setAttribute('aria-hidden','true');
    pasteTasksModal.style.display = 'none';
}

// Task actions modal (for completed tasks)
let currentTaskActionsContext = null;

function openTaskActionsModal(taskId) {
    const task = tasks.find(t => t.id === taskId);
    if (!task || !task.completed) return;

    currentTaskActionsContext = { taskId };
    const m = document.getElementById('taskActionsModal');
    if (!m) return;

    m.setAttribute('aria-hidden', 'false');
    m.style.display = 'flex';
}

function closeTaskActionsModal() {
    const m = document.getElementById('taskActionsModal');
    if (!m) return;
    m.setAttribute('aria-hidden', 'true');
    m.style.display = 'none';
    currentTaskActionsContext = null;
}

// Edit task modal setup
(function setupTaskActionsModal() {
    const m = document.getElementById('taskActionsModal');
    if (!m) return;

    const backdrop = document.getElementById('taskActionsBackdrop');
    const closeBtn = document.getElementById('taskActionsClose');
    const cancelBtn = document.getElementById('taskActionsCancel');

    const closeModal = () => closeTaskActionsModal();

    if (backdrop) backdrop.addEventListener('click', closeModal);
    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

    m.querySelectorAll('.task-action-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const action = btn.dataset.action;
            const ctx = currentTaskActionsContext;
            if (!ctx) return;

            if (action === 'edit') {
                closeModal();
                openEditTaskModal(ctx.taskId);
            } else if (action === 'delete') {
                closeModal();
                deleteTask(ctx.taskId);
            }
        });
    });
})();

// Edit task modal
let currentEditTaskContext = null;

function openEditTaskModal(taskId) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    currentEditTaskContext = { taskId };
    const m = document.getElementById('editTaskModal');
    if (!m) return;

    m.setAttribute('aria-hidden', 'false');
    m.style.display = 'flex';

    // Populate form fields
    const nameInput = document.getElementById('editTaskNameInput');
    if (nameInput) nameInput.value = task.text || '';

    // Set time inputs
    const completedDate = new Date(task.completedAt || Date.now());
    const hoursInput = document.getElementById('editTaskHours');
    const minutesInput = document.getElementById('editTaskMinutes');
    const durationInput = document.getElementById('editTaskDuration');

    if (hoursInput) hoursInput.value = completedDate.getHours();
    if (minutesInput) minutesInput.value = completedDate.getMinutes();
    if (durationInput) durationInput.value = Math.round((task.duration || 0) / 60000);

    // Render category options
    const categoryContainer = document.getElementById('editTaskCategoryOptions');
    if (categoryContainer) {
        renderCategoryButtons(categoryContainer);
        const catBtn = categoryContainer.querySelector(`[data-category="${task.category}"]`);
        if (catBtn) catBtn.click();
    }

    // Focus on the task name input
    if (nameInput) setTimeout(() => nameInput.focus(), 50);
}

function closeEditTaskModal() {
    const m = document.getElementById('editTaskModal');
    if (!m) return;
    m.setAttribute('aria-hidden', 'true');
    m.style.display = 'none';
    currentEditTaskContext = null;
}

// Edit task modal setup
(function setupEditTaskModal() {
    const m = document.getElementById('editTaskModal');
    if (!m) return;

    const backdrop = document.getElementById('editTaskBackdrop');
    const closeBtn = document.getElementById('editTaskClose');
    const cancelBtn = document.getElementById('editTaskCancel');
    const okBtn = document.getElementById('editTaskOk');

    const closeModal = () => closeEditTaskModal();

    if (backdrop) backdrop.addEventListener('click', closeModal);
    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

    if (okBtn) {
        okBtn.addEventListener('click', () => {
            const ctx = currentEditTaskContext;
            if (!ctx) return;

            const taskId = ctx.taskId;
            const idx = tasks.findIndex(t => t.id === taskId);
            if (idx === -1) return;

            const task = tasks[idx];

            // Update task name
            const nameInput = document.getElementById('editTaskNameInput');
            if (nameInput && nameInput.value.trim()) {
                task.text = nameInput.value.trim();
            }

            // Update category
            const categoryContainer = document.getElementById('editTaskCategoryOptions');
            const selectedBtn = categoryContainer ? categoryContainer.querySelector('.modal-category-btn.selected') : null;
            if (selectedBtn) {
                const newCategory = parseInt(selectedBtn.dataset.category);
                if (!Number.isNaN(newCategory)) {
                    task.category = newCategory;
                }
            }

            // Update time
            const hoursInput = document.getElementById('editTaskHours');
            const minutesInput = document.getElementById('editTaskMinutes');
            const durationInput = document.getElementById('editTaskDuration');

            if (hoursInput && minutesInput) {
                const hours = parseInt(hoursInput.value) || 0;
                const minutes = parseInt(minutesInput.value) || 0;
                const completedDate = new Date(task.completedAt || Date.now());
                completedDate.setHours(hours, minutes, 0, 0);
                task.completedAt = completedDate.getTime();
            }

            if (durationInput) {
                const durationMinutes = parseInt(durationInput.value) || 0;
                task.duration = durationMinutes * 60000;
            }

            saveTasks();
            closeModal();
            displayTasks();
        });
    }
})();

if (pasteTasksBtn) {
    pasteTasksBtn.addEventListener('click', openPasteModal);
}
[pasteTasksBackdrop, pasteTasksCloseBtn, pasteTasksCancelBtnModal].forEach(el => { if (el) el.addEventListener('click', closePasteModal); });

// Modal add button
if (pasteTasksAddBtn) pasteTasksAddBtn.addEventListener('click', () => {
    if (showArchive) { openInfoModal('Нельзя добавлять задачи в списке выполненных'); return; }
    const raw = pasteTasksInput ? (pasteTasksInput.value || '') : '';
    const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) return;
    const addAll = () => {
        lines.forEach(text => {
            const newTask = { id: getNextId(), text, category: 0, completed: false, active: true, statusChangedAt: Date.now() };
            tasks.push(newTask);
        });
        saveTasks();
        closePasteModal();
        displayTasks();
        showToastNotification('Задачи добавлены', `Добавлено ${lines.length} задач`);
    };
    if (lines.length > 1) {
        // Close the paste modal first so confirm modal is fully visible and clickable
        closePasteModal();
        openConfirmModal({
            title: 'Подтверждение',
            message: `Добавить ${lines.length} задач?`,
            confirmText: 'Добавить',
            cancelText: 'Отмена',
            requireCheck: false,
            compact: true,
            onConfirm: addAll
        });
    } else {
        addAll();
    }
});


// About modal
const infoFab = document.getElementById('infoFab');
const infoModal = document.getElementById('infoModal');
const infoBackdrop = document.getElementById('infoBackdrop');
const infoCloseBtn = document.getElementById('infoCloseBtn');
const infoCloseAction = document.getElementById('infoCloseAction');
function openAboutModal() { if (!infoModal) return; infoModal.setAttribute('aria-hidden','false'); infoModal.style.display='flex'; }
function closeAboutModal() { if (!infoModal) return; infoModal.setAttribute('aria-hidden','true'); infoModal.style.display='none'; }
if (infoFab) infoFab.addEventListener('click', openAboutModal);
[infoBackdrop, infoCloseBtn, infoCloseAction].forEach(el => { if (el) el.addEventListener('click', closeAboutModal); });

if (quickAddTaskBtn) {
    quickAddTaskBtn.addEventListener('click', () => {
        if (!timerRunning && timerPausedTime <= 0) return;
        const wasRunning = timerRunning;
        if (timerRunning) {
            pauseTimer();
        }
        showArchive = false;
        // mark quick-add context to resume timer after modal closes if it was running
        if (typeof quickAddContext === 'object') {
            quickAddContext.active = true;
            quickAddContext.resumeTimer = !!wasRunning;
        }
        openAddModal(0, { quick: true, reopenTimer: wasRunning });
    });
}

startTimerBtn.addEventListener('click', startTimer);
pauseTimerBtn.addEventListener('click', pauseTimer);
resetTimerBtn.addEventListener('click', resetTimer);

function completeCurrentTaskAndClose() {
    if (!currentTask) return Promise.resolve();
    const taskIndex = tasks.findIndex(t => t.id === currentTask.id);
    if (taskIndex !== -1) {
        const now = Date.now();
        const durationMs = timerStartTime > 0 ? Math.max(0, now - timerStartTime) : 0;

        tasks[taskIndex].completed = true;
        tasks[taskIndex].active = false;
        tasks[taskIndex].completedAt = now;
        tasks[taskIndex].duration = durationMs;

        const completedDate = new Date(now);
        completedDate.setHours(0, 0, 0, 0);
        tasks[taskIndex].completedDate = completedDate.toISOString().split('T')[0];

        saveTasks();
    }
    return cancelServerSchedule().then(() => {
        stopTimer();
        timerEndAt = 0;
        hideTimer();
        displayTasks();
    });
}

completeTaskBtn.addEventListener('click', async () => {
    await completeCurrentTaskAndClose();
});

if (completeNowBtn) {
    completeNowBtn.addEventListener('click', async () => {
        await completeCurrentTaskAndClose();
    });
}

returnTaskBtn.addEventListener('click', async () => {
    if (currentTask) {
        const taskIndex = tasks.findIndex(t => t.id === currentTask.id);
        if (taskIndex !== -1) {
            const now = Date.now();
            const durationMs = timerStartTime > 0 ? Math.max(0, now - timerStartTime) : 0;

            tasks[taskIndex].completed = true;
            tasks[taskIndex].active = false;
            tasks[taskIndex].completedAt = now;
            tasks[taskIndex].duration = durationMs;

            const completedDate = new Date(now);
            completedDate.setHours(0, 0, 0, 0);
            tasks[taskIndex].completedDate = completedDate.toISOString().split('T')[0];

            saveTasks();
        }
    }
    await cancelServerSchedule();
    stopTimer();
    timerEndAt = 0;
    hideTimer();
});

closeTimerBtn.addEventListener('click', async () => {
    await cancelServerSchedule();
    stopTimer();
    timerEndAt = 0;
    hideTimer();
});

timerMinutes.addEventListener('change', () => {
    if (!timerRunning) {
        timerTime = Math.max(1, parseInt(timerMinutes.value)) * 60;
        updateTimerDisplay();
    }
});


// Service Worker для push-уведомлений
if ('serviceWorker' in navigator) {
    window.addEventListener('load', function() {
        navigator.serviceWorker.register('/sw.js').then(function(registration) {
            console.log('ServiceWorker registration successful with scope: ', registration.scope);
        }, function(err) {
            console.log('ServiceWorker registration failed: ', err);
        });
    });
}

// Пересчет при возрае на кладку/разворачивании окна
window.addEventListener('focus', () => {
    if (timerRunning) {
        timerTime = Math.max(0, Math.ceil((timerEndAt - Date.now()) / 1000));
        updateTimerDisplay();
        if (timerTime <= 0) {
            stopTimer();
            showNotification(currentTask ? `Задача: ${currentTask.text}` : undefined);
            timerCompleteOptions.style.display = 'flex';
            const controls = document.querySelector('.timer-controls');
            if (controls) controls.style.display = 'none';
        }
    }
});

// Функция для показа toast-уведомления
function showToastNotification(title, message, duration = 5000) {
    let toast = document.getElementById('toast-notification');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'toast-notification';
        toast.className = 'toast-notification';
        toast.innerHTML = `
            <div class="toast-icon">🎁</div>
            <div class="toast-content">
                <div class="toast-title"></div>
                <div class="toast-message"></div>
            </div>
            <button class="toast-close">&times;</button>
        `;
        document.body.appendChild(toast);
        toast.querySelector('.toast-close').addEventListener('click', () => {
            hideToastNotification();
        });
    }
    toast.querySelector('.toast-title').textContent = title;
    toast.querySelector('.toast-message').textContent = message;
    toast.classList.remove('hide');
    toast.classList.add('show');
    if (duration > 0) {
        setTimeout(() => {
            hideToastNotification();
        }, duration);
    }
    if (navigator.vibrate) {
        navigator.vibrate([200, 100, 200]);
    }
}

function hideToastNotification() {
    const toast = document.getElementById('toast-notification');
    if (toast) {
        toast.classList.remove('show');
        toast.classList.add('hide');
        setTimeout(() => {
            if (toast && toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }
}

if (notifyToggleBtn) {
    notifyToggleBtn.addEventListener('click', async () => {
        if (!('Notification' in window)) {
            openInfoModal('Уведомления не поддерживаются этим браузером');
            return;
        }
        if (Notification.permission === 'granted') {
            await ensurePushSubscribed();
            createBrowserNotification('Уведомления включены');
            updateNotifyToggle();
            return;
        }
        try {
            const result = await Notification.requestPermission();
            if (result === 'granted') {
                await ensurePushSubscribed();
                createBrowserNotification('Уведомления включены');
            } else if (result === 'default') {
                openInfoModal('Уведомления не включены. Подтвердите запрос браузера или разрешите их в настройках сайта.');
            } else if (result === 'denied') {
                openInfoModal('Уведомления заблокированы в настройках браузера. Разрешите их вручную.');
            }
        } catch (e) {
            openInfoModal('Не удалось запросить разрешение на уведомления. Откройте сайт напрямую и попробуйте снова.');
        }
        updateNotifyToggle();
    });
}

// ============= DAILY ACTIVITY CALENDAR =============

let selectedDailyDate = null;
let selectedPastTaskCategory = 0;
let selectedPastTaskSubcategory = null;

function openDailyActivityModal() {
    const modal = document.getElementById('dailyActivityModal');
    if (!modal) return;

    modal.setAttribute('aria-hidden', 'false');
    modal.style.display = 'flex';

    const backdrop = document.getElementById('dailyActivityBackdrop');
    if (backdrop) backdrop.style.display = 'block';

    selectedDailyDate = new Date();
    selectedDailyDate.setHours(0, 0, 0, 0);

    selectedPastTaskCategory = 0;
    selectedPastTaskSubcategory = null;
    updatePastTaskCategoryButton();

    const now = new Date();
    const hoursInput = document.getElementById('pastTaskHours');
    const minutesInput = document.getElementById('pastTaskMinutes');
    if (hoursInput) hoursInput.value = String(now.getHours()).padStart(2, '0');
    if (minutesInput) minutesInput.value = String(now.getMinutes()).padStart(2, '0');

    renderCalendarWidget();
    updateDailyView();
}

function closeDailyActivityModal() {
    const modal = document.getElementById('dailyActivityModal');
    if (!modal) return;

    modal.setAttribute('aria-hidden', 'true');
    modal.style.display = 'none';

    const backdrop = document.getElementById('dailyActivityBackdrop');
    if (backdrop) backdrop.style.display = 'none';
}

function renderCalendarWidget() {
    const container = document.getElementById('calendarWidget');
    if (!container) return;

    container.innerHTML = '';

    const monthDate = new Date(selectedDailyDate.getTime());
    const year = monthDate.getFullYear();
    const month = monthDate.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - (firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1));

    const monthYear = document.createElement('div');
    monthYear.className = 'calendar-month-year';
    monthYear.innerHTML = `
        <button id="calendarPrevBtn" class="calendar-nav-btn">&lt;</button>
        <span>${new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric' }).format(monthDate)}</span>
        <button id="calendarNextBtn" class="calendar-nav-btn">&gt;</button>
    `;
    container.appendChild(monthYear);

    const weekDays = document.createElement('div');
    weekDays.className = 'calendar-weekdays';
    const dayNames = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
    dayNames.forEach(day => {
        const dayEl = document.createElement('div');
        dayEl.className = 'calendar-weekday';
        dayEl.textContent = day;
        weekDays.appendChild(dayEl);
    });
    container.appendChild(weekDays);

    const daysContainer = document.createElement('div');
    daysContainer.className = 'calendar-days';

    let currentDate = new Date(startDate);
    while (currentDate <= lastDay || currentDate.getDay() !== 0) {
        const dayEl = document.createElement('button');
        dayEl.className = 'calendar-day';

        const isCurrentMonth = currentDate.getMonth() === month;
        const isToday = currentDate.toDateString() === new Date().toDateString();
        const isSelected = currentDate.toDateString() === selectedDailyDate.toDateString();

        if (!isCurrentMonth) dayEl.classList.add('other-month');
        if (isToday) dayEl.classList.add('today');
        if (isSelected) dayEl.classList.add('selected');

        const dateStr = currentDate.toISOString().split('T')[0];
        const completedCount = tasks.filter(t => t.completedDate === dateStr && t.completed).length;

        dayEl.textContent = currentDate.getDate();
        if (completedCount > 0) {
            dayEl.setAttribute('data-count', completedCount);
        }

        const clickedDate = new Date(currentDate);
        dayEl.addEventListener('click', () => {
            selectedDailyDate = new Date(clickedDate);
            selectedDailyDate.setHours(0, 0, 0, 0);
            renderCalendarWidget();
            updateDailyView();
        });

        daysContainer.appendChild(dayEl);
        currentDate.setDate(currentDate.getDate() + 1);
    }

    container.appendChild(daysContainer);

    document.getElementById('calendarPrevBtn').addEventListener('click', () => {
        selectedDailyDate.setMonth(selectedDailyDate.getMonth() - 1);
        renderCalendarWidget();
        updateDailyView();
    });

    document.getElementById('calendarNextBtn').addEventListener('click', () => {
        selectedDailyDate.setMonth(selectedDailyDate.getMonth() + 1);
        renderCalendarWidget();
        updateDailyView();
    });
}

function updateDailyView() {
    const dateDisplay = document.getElementById('selectedDateDisplay');
    const tasksList = document.getElementById('dailyTasksList');

    if (!dateDisplay || !tasksList) return;

    const dateStr = selectedDailyDate.toISOString().split('T')[0];
    const completedTasks = tasks.filter(t => t.completedDate === dateStr && t.completed);

    const displayDate = new Intl.DateTimeFormat('ru-RU', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }).format(selectedDailyDate);
    dateDisplay.innerHTML = `<strong>${displayDate}</strong>`;

    tasksList.innerHTML = '';

    if (completedTasks.length === 0) {
        tasksList.innerHTML = '<p class="no-tasks-message">Нет завершённых задач в этот день</p>';
        return;
    }

    const sortedTasks = completedTasks.sort((a, b) => (a.completedAt || 0) - (b.completedAt || 0));

    const timelineEl = document.createElement('div');
    timelineEl.className = 'timeline-view';

    sortedTasks.forEach((task, index) => {
        const taskEl = document.createElement('div');
        taskEl.className = 'timeline-item';

        const categoryColor = getCategoryIndicatorColor(task.category);
        const categoryName = getCategoryName(task.category);
        const durationMinutes = Math.round((task.duration || 0) / 60000);
        const durationText = durationMinutes > 0 ? `${durationMinutes} мин` : 'нет времени';

        const startDate = new Date(task.completedAt || Date.now());
        const startTimeStr = startDate.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

        const endDate = new Date(startDate.getTime() + (task.duration || 0));
        const endTimeStr = endDate.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

        const timeRangeStr = `${startTimeStr} - ${endTimeStr}`;

        const isLastItem = index === sortedTasks.length - 1;

        taskEl.innerHTML = `
            <div class="timeline-dot" style="background-color: ${categoryColor};" title="${categoryName}"></div>
            <div class="timeline-connector${isLastItem ? ' timeline-connector-last' : ''}"></div>
            <div class="timeline-content">
                <div class="timeline-header">
                    <span class="timeline-time">${timeRangeStr}</span>
                    <span class="timeline-duration">[${durationText}]</span>
                </div>
                <div class="timeline-text">${escapeHtml(task.text)}</div>
                <div class="timeline-footer">
                    <button class="timeline-menu-btn" title="Меню" data-task-id="${task.id}">⋯</button>
                    <span class="timeline-category-tag" style="background-color: ${categoryColor}; color: ${getCategoryTagTextColor(task.category)};">${categoryName}</span>
                </div>
            </div>
        `;

        taskEl.querySelector('.timeline-menu-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            openTimelineTaskMenu(task.id);
        });

        timelineEl.appendChild(taskEl);
    });

    tasksList.appendChild(timelineEl);
}

function deleteCompletedTask(taskId) {
    const taskIndex = tasks.findIndex(t => t.id === taskId);
    if (taskIndex !== -1) {
        tasks.splice(taskIndex, 1);
        saveTasks();
        updateDailyView();
        renderCalendarWidget();
    }
}

function undoCompleteTask(taskId) {
    deleteCompletedTask(taskId);
}

function getCategoryIndicatorColor(catId) {
    const colors = {
        0: '#999999',
        1: '#FFC107',
        2: '#2196F3',
        3: '#4CAF50',
        4: '#F44336',
        5: '#B3E5FC'
    };
    return colors[catId] || '#999999';
}

function getCategoryTagTextColor(catId) {
    const textColors = {
        0: '#666666',
        1: '#8B7500',
        2: '#0D47A1',
        3: '#1B5E20',
        4: '#B71C1C',
        5: '#0277BD'
    };
    return textColors[catId] || '#666666';
}

function openAddModalFromArchive(initialCategory) {
    if (!addTaskModal) return;
    addTaskModal.setAttribute('aria-hidden', 'false');
    addTaskModal.style.display = 'flex';
    addTaskModal.style.position = 'fixed';
    addTaskModal.style.zIndex = '10300';
    modalTaskText.value = '';
    modalPrimaryCategory = null;

    renderModalCategoryOptions();
    if (modalCategoryOptions && typeof initialCategory !== 'undefined' && initialCategory !== null) {
        const btn = modalCategoryOptions.querySelector(`.modal-category-btn[data-category="${initialCategory}"]`);
        if (btn) btn.click();
        else applyModalBackground(initialCategory);
    } else {
        applyModalBackground(initialCategory || 0);
    }
    showAddSubcategoriesFor(parseInt(initialCategory) || 0, modalSubcategories);

    setTimeout(() => modalTaskText.focus(), 50);
}

function openPastTaskCategoryModal() {
    const modal = document.getElementById('pastTaskCategoryModal');
    const categoryOptionsContainer = document.getElementById('pastTaskCategoryOptions');
    if (!modal || !categoryOptionsContainer) return;

    categoryOptionsContainer.innerHTML = '';
    const categories = [
        { value: 0, label: 'Категория не определена' },
        { value: 1, label: 'Обязательные дела' },
        { value: 2, label: 'Система безопасности' },
        { value: 5, label: 'Доступность простых радостей' },
        { value: 3, label: 'Простые радости' },
        { value: 4, label: 'Эго-радости' }
    ];

    categories.forEach(cat => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `modal-category-btn cat-${cat.value}`;
        btn.setAttribute('data-category', cat.value);
        btn.textContent = cat.label;
        btn.addEventListener('click', () => {
            categoryOptionsContainer.querySelectorAll('.modal-category-btn').forEach(x => x.classList.remove('selected'));
            btn.classList.add('selected');
            selectedPastTaskCategory = cat.value;
            selectedPastTaskSubcategory = null;
            updatePastTaskCategoryButton();
            const subcatsContainer = document.getElementById('pastTaskSubcategories');
            if (subcatsContainer) {
                subcatsContainer.style.display = 'none';
            }
            if (cat.value === 1) {
                showPastTaskSubcategoriesFor(cat.value);
            } else {
                closePastTaskCategoryModal();
            }
        });
        categoryOptionsContainer.appendChild(btn);
    });

    modal.setAttribute('aria-hidden', 'false');
    modal.style.display = 'flex';
}

function showPastTaskSubcategoriesFor(cat) {
    const catNum = Number(cat);
    const subcatsContainer = document.getElementById('pastTaskSubcategories');
    if (!subcatsContainer) return;

    subcatsContainer.innerHTML = '';

    const existing = new Map();
    tasks
        .filter(t => t.category === catNum && t.subcategory)
        .forEach(t => {
            const key = normalizeSubcategoryName(catNum, t.subcategory) || t.subcategory.trim();
            const tag = key.toLowerCase();
            if (!existing.has(tag)) existing.set(tag, key);
        });

    const customSubs = JSON.parse(localStorage.getItem('customSubcategories') || '{}');
    const saved = Array.isArray(customSubs[catNum]) ? customSubs[catNum] : [];
    saved.forEach(s => {
        const norm = normalizeSubcategoryName(catNum, s);
        const key = norm || s;
        const tag = key.toLowerCase();
        if (!existing.has(tag)) existing.set(tag, key);
    });

    const items = Array.from(existing.values()).map(key => ({
        key: normalizeSubcategoryName(catNum, key) || key,
        label: key
    }));

    items.forEach(item => {
        const b = document.createElement('button');
        b.className = 'add-subcategory-btn modal-subcat-chip cat-' + String(cat);
        b.type = 'button';
        b.dataset.sub = item.key;
        b.textContent = getSubcategoryLabel(catNum, item.key);
        if (selectedPastTaskSubcategory === item.key) {
            b.classList.add('selected');
        }
        b.addEventListener('click', () => {
            subcatsContainer.querySelectorAll('.add-subcategory-btn:not(.add-subcategory-plus)').forEach(x => x.classList.remove('selected'));
            b.classList.add('selected');
            selectedPastTaskSubcategory = item.key;
            updatePastTaskCategoryButton();
            closePastTaskCategoryModal();
        });
        subcatsContainer.appendChild(b);
    });

    const plusBtn = document.createElement('button');
    plusBtn.type = 'button';
    plusBtn.className = 'add-subcategory-btn modal-subcat-chip cat-' + String(cat);
    plusBtn.setAttribute('aria-label', 'Добавить подкатегорию');
    plusBtn.innerHTML = '<i class="fas fa-plus"></i>';
    const inp = document.createElement('input');
    inp.type = 'text';
    inp.placeholder = 'новая сфера';
    const actions = document.createElement('div');
    actions.className = 'inline-add-form';

    const saveBtn = document.createElement('button');
    saveBtn.className = 'inline-save-btn';
    saveBtn.type = 'button';
    saveBtn.textContent = 'Добавить';
    saveBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const value = inp.value.trim();
        if (value) {
            const customSubs = JSON.parse(localStorage.getItem('customSubcategories') || '{}');
            customSubs[catNum] = Array.from(new Set([...(customSubs[catNum] || []), value]));
            localStorage.setItem('customSubcategories', JSON.stringify(customSubs));
            selectedPastTaskSubcategory = normalizeSubcategoryName(catNum, value) || value;
            updatePastTaskCategoryButton();
            closePastTaskCategoryModal();
        }
    });

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'inline-cancel-btn';
    cancelBtn.type = 'button';
    cancelBtn.textContent = 'Отмена';
    cancelBtn.addEventListener('click', (e) => { e.stopPropagation(); });

    actions.appendChild(inp);
    actions.appendChild(saveBtn);
    actions.appendChild(cancelBtn);

    let showForm = false;
    plusBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        showForm = !showForm;
        actions.style.display = showForm ? 'flex' : 'none';
        if (showForm) inp.focus();
    });

    subcatsContainer.appendChild(plusBtn);
    subcatsContainer.appendChild(actions);
    actions.style.display = 'none';
    subcatsContainer.style.display = 'flex';
}

function closePastTaskCategoryModal() {
    const modal = document.getElementById('pastTaskCategoryModal');
    if (modal) {
        modal.setAttribute('aria-hidden', 'true');
        modal.style.display = 'none';
    }
}

function updatePastTaskCategoryButton() {
    const btn = document.getElementById('pastTaskCategoryBtn');
    if (btn) {
        let text = getCategoryName(selectedPastTaskCategory);
        if (selectedPastTaskSubcategory && selectedPastTaskCategory === 1) {
            text += ` → ${getSubcategoryLabel(selectedPastTaskCategory, selectedPastTaskSubcategory)}`;
        }
        btn.textContent = text;

        btn.className = 'past-task-category-btn category-' + selectedPastTaskCategory;
        const categoryColor = getCategoryIndicatorColor(selectedPastTaskCategory);
        btn.style.backgroundColor = categoryColor;
        btn.style.borderColor = categoryColor;

        if (selectedPastTaskCategory === 0 || selectedPastTaskCategory === 5) {
            btn.style.color = '#666';
        } else if (selectedPastTaskCategory === 1) {
            btn.style.color = '#8B7500';
        } else if (selectedPastTaskCategory === 2) {
            btn.style.color = '#0D47A1';
        } else if (selectedPastTaskCategory === 3) {
            btn.style.color = '#1B5E20';
        } else if (selectedPastTaskCategory === 4) {
            btn.style.color = '#B71C1C';
        }
    }
}

// Add modal event listeners
document.addEventListener('DOMContentLoaded', () => {
    const dailyActivityCloseBtn = document.getElementById('dailyActivityCloseBtn');
    const dailyActivityBackdrop = document.getElementById('dailyActivityBackdrop');
    const pastTaskCategoryBtn = document.getElementById('pastTaskCategoryBtn');
    const pastTaskCategoryClose = document.getElementById('pastTaskCategoryClose');
    const pastTaskCategoryBackdrop = document.getElementById('pastTaskCategoryBackdrop');
    const addPastTaskBtn = document.getElementById('addPastTaskBtn');

    if (dailyActivityCloseBtn) {
        dailyActivityCloseBtn.addEventListener('click', closeDailyActivityModal);
    }

    if (dailyActivityBackdrop) {
        dailyActivityBackdrop.addEventListener('click', closeDailyActivityModal);
    }

    if (pastTaskCategoryBtn) {
        pastTaskCategoryBtn.addEventListener('click', () => {
            openPastTaskCategoryModal();
        });
    }

    if (pastTaskCategoryClose) {
        pastTaskCategoryClose.addEventListener('click', () => {
            closePastTaskCategoryModal();
        });
    }

    if (addPastTaskBtn) {
        addPastTaskBtn.addEventListener('click', () => {
            const input = document.getElementById('pastTaskInput');
            const category = selectedPastTaskCategory;
            const durationMinutes = parseInt(document.getElementById('pastTaskDuration').value) || 0;
            const hoursInput = document.getElementById('pastTaskHours');
            const minutesInput = document.getElementById('pastTaskMinutes');
            const hours = parseInt(hoursInput.value) || 0;
            const minutes = parseInt(minutesInput.value) || 0;

            if (!input || !input.value.trim()) {
                openInfoModal('Введите описание задачи');
                return;
            }

            if (durationMinutes <= 0) {
                openInfoModal('Укажите продолжительность в минутах');
                return;
            }

            if (!selectedDailyDate) {
                openInfoModal('Выберите дату');
                return;
            }

            const taskDate = new Date(selectedDailyDate);
            taskDate.setHours(hours, minutes, 0, 0);

            const newTask = {
                id: getNextId(),
                text: input.value.trim(),
                category,
                completed: true,
                active: false,
                completedAt: taskDate.getTime(),
                duration: durationMinutes * 60000,
                completedDate: selectedDailyDate.toISOString().split('T')[0],
                statusChangedAt: Date.now()
            };

            if (selectedPastTaskSubcategory && category === 1) {
                newTask.subcategory = selectedPastTaskSubcategory;
            }

            tasks.push(newTask);
            saveTasks();

            input.value = '';
            document.getElementById('pastTaskDuration').value = '';
            hoursInput.value = '';
            minutesInput.value = '';

            updateDailyView();
        });
    }
});
