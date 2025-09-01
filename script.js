// Переменная для хранения задач
let tasks = [];

// Функции для работы с localStorage
function loadTasks() {
    const tasksJSON = localStorage.getItem('tasks');
    if (tasksJSON) {
        tasks = JSON.parse(tasksJSON);
    } else {
        tasks = [];
    }
    return tasks;
}

function saveTasks() {
    localStorage.setItem('tasks', JSON.stringify(tasks));
}

function getNextId() {
    let maxId = 0;
    tasks.forEach(task => {
        if (task.id > maxId) maxId = task.id;
    });
    return maxId + 1;
}

// Переменные состояния
let currentTask = null;
let timerInterval = null;
let timerTime = 15 * 60; // 15 минут в секундах
let timerRunning = false;
let selectedTaskId = null;
let activeDropdown = null;
let wakeLock = null; // экраны не засыпают во время таймера (где поддерж��вается)

// Новые переменные для точного таймера
let timerStartTime = 0;
let timerPausedTime = 0;
let timerAnimationFrame = null;
let timerWorker = null;
let timerEndAt = 0;
let timerEndTimeoutId = null;

// Элем��нты DOM
const sections = document.querySelectorAll('.section');

// Глобальный обработчик для закрытия открытого выпадающего меню категорий
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
const exportTasksBtn = document.getElementById('exportTasksBtn');
const taskList = document.getElementById('taskList');
const tasksContainer = document.getElementById('tasksContainer');
const taskText = document.getElementById('taskText');
const taskCategory = document.getElementById('taskCategory');
const addTaskBtn = document.getElementById('addTaskBtn');
const hideTasksBtn = document.getElementById('hideTasksBtn');
const timerScreen = document.getElementById('timerScreen');
const timerTaskText = document.getElementById('timerTaskText');
const timerDisplay = document.getElementById('timerDisplay');
const timerMinutes = document.getElementById('timerMinutes');
const startTimerBtn = document.getElementById('startTimerBtn');
const pauseTimerBtn = document.getElementById('pauseTimerBtn');
const resetTimerBtn = document.getElementById('resetTimerBtn');
const completeTaskBtn = document.getElementById('completeTaskBtn');
const returnTaskBtn = document.getElementById('returnTaskBtn');
const closeTimerBtn = document.getElementById('closeTimerBtn');
const importFile = document.getElementById('importFile');
const notification = document.getElementById('notification');
const timerCompleteOptions = document.getElementById('timerCompleteOptions');
const notifyBanner = document.getElementById('notifyBanner');
const enableNotifyBtn = document.getElementById('enableNotifyBtn');

function applyCategoryVisualToSelect() {
    if (!taskCategory) return;
    const val = parseInt(taskCategory.value) || 0;
    const badge = document.querySelector('.add-category-badge');
    if (badge) {
        badge.textContent = getCategoryName(val);
        badge.setAttribute('data-category', String(val));
    }
    const subControls = document.querySelector('.add-subcategory-controls');
    if (subControls) {
        subControls.style.display = (val === 1 ? 'flex' : 'none');
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
        return;
    }
    setNotifyBannerVisible(Notification.permission !== 'granted');
}

// Функция для получения названия категории по номеру
function getCategoryName(category) {
    const categories = {
        0: "Без категории",
        1: "Обязательные",
        2: "Безопасность",
        3: "Простые радости",
        4: "Эго радости",
        5: "Доступность радостей"
    };
    return categories[category] || "Неизвестно";
}

// Функция отображения всех задач
function displayTasks() {
    tasksContainer.innerHTML = '';

    const isMobile = window.matchMedia('(max-width: 480px)').matches;
    tasksContainer.classList.remove('sticker-grid');
    tasksContainer.classList.toggle('mobile-compact', isMobile);

    const groups = new Map();
    tasks.forEach(t => {
        const arr = groups.get(t.category) || [];
        arr.push(t);
        groups.set(t.category, arr);
    });

    const categories = Array.from(groups.keys()).sort((a, b) => a - b);

    const collapsedRaw = localStorage.getItem('collapsedCategories');
    const collapsedCategories = new Set(collapsedRaw ? JSON.parse(collapsedRaw) : []);

    categories.forEach(cat => {
        const group = document.createElement('div');
        group.className = `category-group category-${cat}`;
        group.dataset.category = String(cat);

        const title = document.createElement('div');
        title.className = 'category-title';
        title.innerHTML = `<i class=\"fas fa-folder folder-before-title\"></i><span class=\"category-heading\">${getCategoryName(cat)}</span>`;

        const grid = document.createElement('div');
        grid.className = 'group-grid';

        if (collapsedCategories.has(cat)) {
            group.classList.add('collapsed');
        }

        group.appendChild(title);
        group.appendChild(grid);
        tasksContainer.appendChild(group);

        const list = groups.get(cat) || [];
        list.sort((a, b) => {
            if (a.active !== b.active) return a.active ? 1 : -1;
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

            const categoryDisplay = `<i class=\"fas fa-folder\"></i><span class=\"category-name\">${getCategoryName(task.category)}</span>`;

            taskElement.innerHTML = `
                <div class=\"task-content\">
                    <div class=\"task-text\">${task.text}</div>
                    <div class=\"category-selector\">
                        <div class=\"category-badge\" data-id=\"${task.id}\">
                            ${categoryDisplay}
                            <i class=\"fas fa-caret-down\"></i>
                        </div>
                        <div class=\"category-dropdown\" id=\"dropdown-${task.id}\">
                            <button class=\"category-option\" data-category=\"0\">Без категории</button>
                            <div class=\"category-option-group\">
                                <button class=\"category-option\" data-category=\"1\">Обязательные</button>
                                <div class=\"category-subrow\">
                                    <button class=\"category-option\" data-category=\"1\" data-subcategory=\"work\">Работа</button>
                                    <span class=\"category-divider\"></span>
                                    <button class=\"category-option\" data-category=\"1\" data-subcategory=\"home\">Дом</button>
                                </div>
                            </div>
                            <button class=\"category-option\" data-category=\"2\">Безопасность</button>
                            <button class=\"category-option\" data-category=\"5\">Доступность радостей</button>
                            <button class=\"category-option\" data-category=\"3\">Простые радости</button>
                            <button class=\"category-option\" data-category=\"4\">Эго радости</button>
                        </div>
                    </div>
                </div>
                <div class=\"task-controls\">
                    <button class=\"task-control-btn toggle-active-btn\" data-id=\"${task.id}\">
                        <i class=\"fas ${task.active ? 'fa-eye-slash' : 'fa-eye'}\"></i>
                    </button>
                    <button class=\"task-control-btn delete-task-btn\" data-id=\"${task.id}\">
                        <i class=\"fas fa-trash\"></i>
                    </button>
                </div>
            `;
            if (isMobile && task.text.length > 44) {
                taskElement.classList.add('sticker-wide');
            }
            grid.appendChild(taskElement);
        });

        // Группировка задач по подкатегориям для категории "Обязатель��ые"
        if (cat === 1) {
            const workTitle = document.createElement('div');
            const homeTitle = document.createElement('div');
            workTitle.className = 'category-title';
            homeTitle.className = 'category-title';
            workTitle.innerHTML = '<span class="category-heading">Работа</span>';
            homeTitle.innerHTML = '<span class="category-heading">Дом</span>';

            // Кнопки включения/выключения подкатегорий
            const workHasActive = list.some(t => t.subcategory === 'work' && t.active);
    const homeHasActive = list.some(t => t.subcategory === 'home' && t.active);
            const workToggle = document.createElement('button');
            workToggle.className = 'task-control-btn subcategory-toggle-all';
            workToggle.innerHTML = `<i class=\"fas ${workHasActive ? 'fa-eye-slash' : 'fa-eye'}\"></i>`;
            workToggle.addEventListener('click', (e) => {
                e.stopPropagation();
                toggleSubcategoryActive('work');
            });
            const homeToggle = document.createElement('button');
            homeToggle.className = 'task-control-btn subcategory-toggle-all';
            homeToggle.innerHTML = `<i class=\"fas ${homeHasActive ? 'fa-eye-slash' : 'fa-eye'}\"></i>`;
            homeToggle.addEventListener('click', (e) => {
                e.stopPropagation();
                toggleSubcategoryActive('home');
            });
            workTitle.appendChild(workToggle);
            homeTitle.appendChild(homeToggle);

            // Перемещаем задачи в одну общую сетку с заголовками подкатегорий
            const nodes = [...grid.querySelectorAll(':scope > .task')];
            const workTasks = nodes.filter(el => el.dataset.subcategory === 'work');
            const homeTasks = nodes.filter(el => el.dataset.subcategory === 'home');
            if (workTasks.length) {
                grid.appendChild(workTitle);
                workTasks.forEach(el => grid.appendChild(el));
            }
            if (homeTasks.length) {
                grid.appendChild(homeTitle);
                homeTasks.forEach(el => grid.appendChild(el));
            }

            // Оставшиеся без подкатегории остаются сверху, далее подкатегории заголовком и их задачи
        }

        title.addEventListener('click', () => {
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
    });

    // Добавляем обработчики событий для новых элементов
    document.querySelectorAll('.category-badge').forEach(badge => {
        badge.addEventListener('click', function(e) {
            e.stopPropagation();
            if (activeDropdown && activeDropdown !== this.nextElementSibling) {
                activeDropdown.classList.remove('show');
                if (activeDropdown.parentElement) activeDropdown.parentElement.style.zIndex = '';
            }
            const dropdown = this.nextElementSibling;
            dropdown.classList.toggle('show');
            activeDropdown = dropdown;
            if (dropdown.classList.contains('show')) {
                if (dropdown.parentElement) dropdown.parentElement.style.zIndex = '9000';
                dropdown.style.top = '100%';
                dropdown.style.bottom = 'auto';
                dropdown.style.left = '';
                dropdown.style.right = '';
                const rect = dropdown.getBoundingClientRect();
                const vw = window.innerWidth || document.documentElement.clientWidth;
                const vh = window.innerHeight || document.documentElement.clientHeight;
                if (rect.bottom > vh - 8) {
                    dropdown.style.top = 'auto';
                    dropdown.style.bottom = '100%';
                }
                if (rect.right > vw - 8) {
                    dropdown.style.left = 'auto';
                    dropdown.style.right = '0';
                }
                if (rect.left < 8) {
                    dropdown.style.left = '0';
                    dropdown.style.right = 'auto';
                }
            } else {
                if (dropdown.parentElement) dropdown.parentElement.style.zIndex = '';
            }
        });
    });

    document.querySelectorAll('.category-option').forEach(option => {
        option.addEventListener('click', function() {
            const taskId = parseInt(this.closest('.category-selector').querySelector('.category-badge').dataset.id);
            const newCategory = parseInt(this.dataset.category);
            const newSub = this.dataset.subcategory || null;
            changeTaskCategory(taskId, newCategory, newSub);
            // Закрываем dropdown
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
}

// Функция для из��енения категории задачи
function changeTaskCategory(taskId, newCategory, newSubcategory = null) {
    const taskIndex = tasks.findIndex(t => t.id === taskId);
    if (taskIndex === -1) return;
    const wasActive = !!tasks[taskIndex].active;

    const updateData = { category: newCategory };
    if (newCategory === 1) {
        if (newSubcategory) {
            updateData.subcategory = newSubcategory;
        } else if ('subcategory' in tasks[taskIndex]) {
            updateData.subcategory = null;
        }
    }
    if (tasks[taskIndex].category === 0 && !tasks[taskIndex].active && newCategory !== 0) {
        updateData.active = true;
    }
    if (!wasActive && updateData.active === true) {
        updateData.statusChangedAt = Date.now();
    }

    tasks[taskIndex] = { ...tasks[taskIndex], ...updateData };
    if (newCategory !== 1 && 'subcategory' in tasks[taskIndex]) {
        delete tasks[taskIndex].subcategory;
    }
    if (newCategory === 1 && (!newSubcategory || newSubcategory === null) && 'subcategory' in tasks[taskIndex] && tasks[taskIndex].subcategory === null) {
        delete tasks[taskIndex].subcategory;
    }
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

// Пе��еключение активности всех задач внутри категории
function toggleCategoryActive(category) {
    const hasActive = tasks.some(t => t.category === category && t.active);
    const newActive = !hasActive;
    tasks = tasks.map(t => t.category === category ? { ...t, active: newActive, statusChangedAt: Date.now() } : t);
    saveTasks();
    displayTasks();
}

// Переключение активности подкатегории (Работа/Дом) внутри "Обязательные"
function toggleSubcategoryActive(subKey) {
    const hasActive = tasks.some(t => t.category === 1 && t.subcategory === subKey && t.active);
    const newActive = !hasActive;
    tasks = tasks.map(t => (t.category === 1 && t.subcategory === subKey)
        ? { ...t, active: newActive, statusChangedAt: Date.now() }
        : t
    );
    saveTasks();
    displayTasks();
}

// Функц��я для удаления задачи
function deleteTask(taskId) {
    if (confirm('Удалить эту задачу?')) {
        tasks = tasks.filter(t => t.id !== taskId);
        saveTasks();
        displayTasks();
    }
}

// Функция для экспорта задач в файл
function exportTasks() {
    const dataStr = JSON.stringify(tasks, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = 'коробочка-з��дачи.json';
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
}

// Функция для импорта задач из файла
function importTasks(file) {
    const reader = new FileReader();
    
    reader.onload = function(e) {
        try {
            const importedTasks = JSON.parse(e.target.result);
            
            if (!Array.isArray(importedTasks)) {
                alert('О��ибка: файл должен содержать массив задач');
                return;
            }
            
            // Проверяем структуру задач
            for (const task of importedTasks) {
                if (!task.text || typeof task.category === 'undefined') {
                    alert('Ошибка: неправильный формат файла');
                    return;
                }
            }
            
            // Добавляем задачи в базу данных
            tasks = importedTasks;
            saveTasks();
            alert(`Успешно импортировано ${importedTasks.length} задач`);
            displayTasks();
            
        } catch (error) {
            alert('Ошибка при чтении файла: ' + error.message);
        }
    };
    
    reader.readAsText(file);
}

// Функция для выбора случайной задачи из категории
function getRandomTask(categories) {
    // Преобразуем строку категорий в массив чисел
    const categoryArray = categories.split(',').map(Number);
    
    // Получаем все активные задачи из указанных категорий
    const filteredTasks = tasks.filter(task => 
        categoryArray.includes(task.category) && task.active
    );
    
    if (filteredTasks.length === 0) {
        alert('Нет активных задач �� этой категор��и!');
        return null;
    }
    
    const randomIndex = Math.floor(Math.random() * filteredTasks.length);
    return filteredTasks[randomIndex];
}

// Функция для отображения таймера
function showTimer(task) {
    currentTask = task;
    timerTaskText.textContent = task.text;

    // Полный сб��ос состояния таймера перед новым запуском
    if (timerEndTimeoutId) {
        clearTimeout(timerEndTimeoutId);
        timerEndTimeoutId = null;
    }
    timerRunning = false;
    timerPausedTime = 0;
    timerEndAt = 0;

    timerTime = Math.max(1, parseInt(timerMinutes.value)) * 60;
    updateTimerDisplay();
    timerScreen.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    // Скрываем опции завершения и показываем управление таймером
    timerCompleteOptions.style.display = 'none';
    document.querySelector('.timer-controls').style.display = 'flex';
}

// Функция для скрытия таймера
function hideTimer() {
    timerScreen.style.display = 'none';
    document.body.style.overflow = 'auto'; // Восстанавливаем прокрутку
    stopTimer(); // Останавливаем таймер при закрыт��и
    releaseWakeLock();
}

// Функция для обновления отображения таймера
function updateTimerDisplay() {
    const minutes = Math.floor(timerTime / 60);
    const seconds = timerTime % 60;
    timerDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

// Функция для показа уведомления
function showNotification(message) {
    const body = message || (currentTask ? `Задача: ${currentTask.text}` : "Время вышло! Задача завершена.");
    showToastNotification("🎁 КОРОБОЧКА", body, 5000);
    playBeep();

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
        body: message || "Время ��ышло! Задача завершена.",
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
            <button class="add-category-option" data-category="0">Без категории</button>
            <div class="category-option-group">
                <button class="add-category-option" data-category="1">Обязательные</button>
                <div class="category-subrow">
                    <button class="add-category-option" data-category="1" data-subcategory="work">Работа</button>
                    <span class="category-divider"></span>
                    <button class="add-category-option" data-category="1" data-subcategory="home">Дом</button>
                </div>
            </div>
            <button class="add-category-option" data-category="2">Безопасность</button>
            <button class="add-category-option" data-category="5">Доступность радостей</button>
            <button class="add-category-option" data-category="3">Простые радости</button>
            <button class="add-category-option" data-category="4">Эго радости</button>
        `;
        dropdown.querySelectorAll('.add-category-option').forEach(btn => {
            btn.addEventListener('click', () => {
                const v = btn.getAttribute('data-category') || '0';
                const sub = btn.getAttribute('data-subcategory');
                taskCategory.value = v;
                applyCategoryVisualToSelect();
                const subControls = document.querySelector('.add-subcategory-controls');
                if (subControls) {
                    const workBtn = subControls.querySelector('.add-subcategory-btn[data-sub="work"]');
                    const homeBtn = subControls.querySelector('.add-subcategory-btn[data-sub="home"]');
                    if (sub === 'work' || sub === 'home') {
                        [workBtn, homeBtn].forEach(b => b && b.classList.remove('selected'));
                        const target = sub === 'work' ? workBtn : homeBtn;
                        if (target) target.classList.add('selected');
                    }
                }
                dropdown.classList.remove('show');
                activeDropdown = null;
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
        // Подкатегории для "Обязательные"
        let sub = document.querySelector('.add-subcategory-controls');
        if (!sub) {
            sub = document.createElement('div');
            sub.className = 'add-subcategory-controls';
            const btnWork = document.createElement('button');
            btnWork.type = 'button';
            btnWork.className = 'add-subcategory-btn selected';
            btnWork.dataset.sub = 'work';
            btnWork.textContent = 'Работа';
            const btnHome = document.createElement('button');
            btnHome.type = 'button';
            btnHome.className = 'add-subcategory-btn';
            btnHome.dataset.sub = 'home';
            btnHome.textContent = 'Дом';
            [btnWork, btnHome].forEach(btn => {
                btn.addEventListener('click', () => {
                    sub.querySelectorAll('.add-subcategory-btn').forEach(b => b.classList.remove('selected'));
                    btn.classList.add('selected');
                });
            });
            container.insertAdjacentElement('afterend', sub);
        }
    }
    applyCategoryVisualToSelect();
}

window.addEventListener('load', async () => {
    loadTasks();

    setupAddCategorySelector();

    if (typeof addMultipleBtn !== 'undefined' && addMultipleBtn) {
        addMultipleBtn.style.display = 'none';
    }

    applyCategoryVisualToSelect();
    refreshNotifyBanner();

    if (navigator.permissions && navigator.permissions.query) {
        try {
            const status = await navigator.permissions.query({ name: 'notifications' });
            const update = () => setNotifyBannerVisible(status.state !== 'granted');
            update();
            status.onchange = update;
        } catch (e) {}
    }

    if (!navigator.vibrate) {
        console.log("Вибрация не поддерживается на этом устройстве");
    }
});

// НОВАЯ РЕАЛИЗАЦИЯ ТАЙМЕРА (точный и работающий в фоне)

// Поддержка Wake Lock API, чтобы экран не засыпал во время таймера
async function requestWakeLock() {
    try {
        if ('wakeLock' in navigator && !wakeLock) {
            wakeLock = await navigator.wakeLock.request('screen');
            wakeLock.addEventListener('release', () => {
                wakeLock = null;
            });
        }
    } catch (_) {
        // игнорируем ошибки
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

// Звуковой сигнал по завершении
function playBeep() {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'sine';
        o.frequency.setValueAtTime(880, ctx.currentTime);
        g.gain.setValueAtTime(0.001, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.6);
        o.connect(g).connect(ctx.destination);
        o.start();
        o.stop(ctx.currentTime + 0.6);
    } catch (_) {}
}

// Функция для запуска таймера
function startTimer() {
    if (timerRunning) return;
    requestWakeLock();

    timerRunning = true;
    // при возобновлении с паузы
    if (timerPausedTime > 0) {
        timerEndAt = Date.now() + (timerPausedTime * 1000);
        timerPausedTime = 0;
    }
    // при первом запуске
    if (!timerEndAt) {
        const total = Math.max(1, parseInt(timerMinutes.value)) * 60;
        timerEndAt = Date.now() + total * 1000;
    }
    timerStartTime = Date.now();

    // Сообщаем серверу о расписании пуш-уведомления
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
    
    // Используем Web Worker для точного отсчета времени в фоне
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
        // Fallback для браузеров без подде��жки Web Workers
        timerInterval = setInterval(() => {
            timerTime = Math.max(0, Math.ceil((timerEndAt - Date.now()) / 1000));
            updateTimerDisplay();

            if (timerTime <= 0) {
                stopTimer();
                showNotification(currentTask ? `За��ача: ${currentTask.text}` : undefined);
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

// Функция для остановки тайм��ра
function stopTimer() {
    timerRunning = false;
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

// Функция для сброса таймера
function resetTimer() {
    // отменяе�� только локальный таймер, серверный не трогаем, чтобы пауза/сброс был явным
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

// Обработч��ки событий
sections.forEach(section => {
    section.addEventListener('click', () => {
        const categories = section.dataset.category;
        const task = getRandomTask(categories);
        if (task) showTimer(task);
    });
});

showTasksBtn.addEventListener('click', () => {
    taskList.style.display = 'block';
    displayTasks();
});

if (addSingleBtn) {
    addSingleBtn.addEventListener('click', () => {
        taskList.style.display = 'block';
        displayTasks();
        setTimeout(() => {
            taskText.focus();
            taskText.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 0);
    });
}

hideTasksBtn.addEventListener('click', () => {
    taskList.style.display = 'none';
});

taskCategory.addEventListener('change', applyCategoryVisualToSelect);

addTaskBtn.addEventListener('click', () => {
    const raw = taskText.value;
    const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);
    const category = parseInt(taskCategory.value);
    if (lines.length === 0) return;

    if (lines.length > 1) {
        if (!confirm(`Добавить ${lines.length} задач?`)) return;
    }

    const active = true;
    lines.forEach(text => {
        const newTask = {
            id: getNextId(),
            text,
            category,
            completed: false,
            active,
            statusChangedAt: Date.now()
        };
        if (category === 1) {
            const selectedBtn = document.querySelector('.add-subcategory-controls .add-subcategory-btn.selected');
            if (selectedBtn && selectedBtn.dataset.sub) {
                newTask.subcategory = selectedBtn.dataset.sub;
            }
        }
        tasks.push(newTask);
    });

    saveTasks();
    taskText.value = '';
    displayTasks();
});

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

startTimerBtn.addEventListener('click', startTimer);
pauseTimerBtn.addEventListener('click', pauseTimer);
resetTimerBtn.addEventListener('click', resetTimer);

completeTaskBtn.addEventListener('click', async () => {
    if (currentTask) {
        const taskIndex = tasks.findIndex(t => t.id === currentTask.id);
        if (taskIndex !== -1) {
            tasks[taskIndex].completed = true;
            tasks[taskIndex].active = false;
            saveTasks();
        }
        await cancelServerSchedule();
        stopTimer();
        timerEndAt = 0;
        hideTimer();
        displayTasks();
    }
});

returnTaskBtn.addEventListener('click', async () => {
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

// Пересчет при возврате на вкладку/разворачивании окна
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

if (enableNotifyBtn) {
    enableNotifyBtn.addEventListener('click', async () => {
        if (!('Notification' in window)) {
            alert('Уведомления не поддерживаются этим браузером');
            return;
        }
        if (Notification.permission === 'granted') {
            setNotifyBannerVisible(false);
            await ensurePushSubscribed();
            createBrowserNotification('Уведомления включены');
            return;
        }
        try {
            const result = await Notification.requestPermission();
            if (result === 'granted') {
                setNotifyBannerVisible(false);
                await ensurePushSubscribed();
                createBrowserNotification('Уведомления включены');
            } else if (result === 'default') {
                alert('Уведомления не ��ключены. Подтвердите запрос браузера или разрешите их в ��астройках са��та.');
            } else if (result === 'denied') {
                alert('Уведомления заблокированы в настройках браузера. Разрешите их вручную.');
            }
        } catch (e) {
            alert('Не удалось запросить разрешение на уведомления. Откройте сайт напрямую и попробуйте снова.');
        }
    });
}
