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
let wakeLock = null; // экраны не засыпают во время таймера (где поддерживается)

// Новые переменные для точного таймера
let timerStartTime = 0;
let timerPausedTime = 0;
let timerAnimationFrame = null;
let timerWorker = null;
let timerEndAt = 0;

// Элементы DOM
const sections = document.querySelectorAll('.section');

// Глобальный обработчик для закрытия открытого выпадающего меню категорий
document.addEventListener('click', function(e) {
    if (activeDropdown && !e.target.closest('.category-selector')) {
        activeDropdown.classList.remove('show');
        activeDropdown = null;
    }
});
const showTasksBtn = document.getElementById('showTasksBtn');
const addMultipleBtn = document.getElementById('addMultipleBtn');
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
    // Сортируем задачи: сначала без категории (0), затем остальные по категории
    tasks.sort((a, b) => {
        if (a.category === 0 && b.category !== 0) return -1;
        if (a.category !== 0 && b.category === 0) return 1;
        return a.category - b.category;
    });
    
    tasksContainer.innerHTML = '';
    
    tasks.forEach(task => {
        const taskElement = document.createElement('div');
        taskElement.className = `task category-${task.category} ${task.active ? '' : 'inactive'}`;
        taskElement.dataset.id = task.id;
        
        // Для задач без категории показываем иконку папки
        const categoryDisplay = task.category === 0 ? 
            '<i class="fas fa-folder"></i>' : 
            getCategoryName(task.category);
        
        taskElement.innerHTML = `
            <div class="task-content">
                <div class="task-text">${task.text}</div>
                <div class="category-selector">
                    <div class="category-badge" data-id="${task.id}">
                        ${categoryDisplay}
                        <i class="fas fa-caret-down"></i>
                    </div>
                    <div class="category-dropdown" id="dropdown-${task.id}">
                        <button class="category-option" data-category="0">Без категории</button>
                        <button class="category-option" data-category="1">Обязательные</button>
                        <button class="category-option" data-category="2">Безопасность</button>
                        <button class="category-option" data-category="5">Доступность радостей</button>
                        <button class="category-option" data-category="3">Простые радости</button>
                        <button class="category-option" data-category="4">Эго радости</button>
                    </div>
                </div>
            </div>
            <div class="task-controls">
                <button class="task-control-btn toggle-active-btn" data-id="${task.id}">
                    <i class="fas ${task.active ? 'fa-eye-slash' : 'fa-eye'}"></i>
                </button>
                <button class="task-control-btn delete-task-btn" data-id="${task.id}">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
        
        tasksContainer.appendChild(taskElement);
    });
    
    // Добавляем обработчики событий для новых элементов
    document.querySelectorAll('.category-badge').forEach(badge => {
        badge.addEventListener('click', function(e) {
            e.stopPropagation();
            const taskId = parseInt(this.dataset.id);
            
            // Закрываем предыдущий открытый dropdown
            if (activeDropdown && activeDropdown !== this.nextElementSibling) {
                activeDropdown.classList.remove('show');
            }
            
            // Открываем/закрываем dropdown
            const dropdown = this.nextElementSibling;
            dropdown.classList.toggle('show');
            activeDropdown = dropdown;
        });
    });
    
    document.querySelectorAll('.category-option').forEach(option => {
        option.addEventListener('click', function() {
            const taskId = parseInt(this.closest('.category-selector').querySelector('.category-badge').dataset.id);
            const newCategory = parseInt(this.dataset.category);
            changeTaskCategory(taskId, newCategory);
            
            // Закрываем dropdown
            this.closest('.category-dropdown').classList.remove('show');
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
    
}

// Функция для изменения категории задачи
function changeTaskCategory(taskId, newCategory) {
    const taskIndex = tasks.findIndex(t => t.id === taskId);
    if (taskIndex === -1) return;
    
    // Если задача была без категории и неактивна, и выбирается новая категория, активируем ее
    const updateData = { category: newCategory };
    if (tasks[taskIndex].category === 0 && !tasks[taskIndex].active && newCategory !== 0) {
        updateData.active = true;
    }
    
    tasks[taskIndex] = { ...tasks[taskIndex], ...updateData };
    saveTasks();
    displayTasks();
}

// Функция для переключения активности задачи
function toggleTaskActive(taskId) {
    const taskIndex = tasks.findIndex(t => t.id === taskId);
    if (taskIndex === -1) return;
    
    tasks[taskIndex].active = !tasks[taskIndex].active;
    saveTasks();
    displayTasks();
}

// Функция для удаления задачи
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
    
    const exportFileDefaultName = 'коробочка-задачи.json';
    
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
                alert('Ошибка: файл должен содержать массив задач');
                return;
            }
            
            // Проверяем структуру задач
            for (const task of importedTasks) {
                if (!task.text || typeof task.category === 'undefined') {
                    alert('��шибка: неправильный формат файла');
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
        alert('Нет активных задач в этой категории!');
        return null;
    }
    
    const randomIndex = Math.floor(Math.random() * filteredTasks.length);
    return filteredTasks[randomIndex];
}

// Функция для отображения таймера
function showTimer(task) {
    currentTask = task;
    timerTaskText.textContent = task.text;
    timerTime = parseInt(timerMinutes.value) * 60;
    updateTimerDisplay();
    timerScreen.style.display = 'flex';
    document.body.style.overflow = 'hidden'; // Блокируем прокрутку основного контента
    
    // Скрываем опции завершения и показываем управление таймером
    timerCompleteOptions.style.display = 'none';
    document.querySelector('.timer-controls').style.display = 'flex';
}

// Функция для скрытия таймера
function hideTimer() {
    timerScreen.style.display = 'none';
    document.body.style.overflow = 'auto'; // Восстанавливаем прокрутку
    stopTimer(); // Останавливаем таймер при закрытии
    releaseWakeLock();
}

// Функция для обновления отображения таймера
function updateTimerDisplay() {
    const minutes = Math.floor(timerTime / 60);
    const seconds = timerTime % 60;
    timerDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

// Функция для показа уведомления
function showNotification() {
    showToastNotification("🎁 КОРОБОЧКА", "Время вышло! Задача завершена.", 5000);
    playBeep();

    if ("Notification" in window) {
        if (Notification.permission === "granted") {
            createBrowserNotification();
        } else if (Notification.permission !== "denied") {
            Notification.requestPermission().then(permission => {
                if (permission === "granted") {
                    createBrowserNotification();
                }
            });
        }
    }
}

// Создание браузерного уведомления
function createBrowserNotification() {
    const title = "🎁 КОРОБОЧКА";
    const options = {
        body: "Время вышло! Задача завершена.",
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
window.addEventListener('load', async () => {
    loadTasks();

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

// Поддержка Wake Lock API, чтобы экран не засыпал в�� время таймера
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
                        showNotification();
                        timerCompleteOptions.style.display = 'flex';
                        document.querySelector('.timer-controls').style.display = 'none';
                    }
                }
            };
        }
        timerWorker.postMessage('start');
    } else {
        // Fallback для браузеров без поддержки Web Workers
        timerInterval = setInterval(() => {
            timerTime = Math.max(0, Math.ceil((timerEndAt - Date.now()) / 1000));
            updateTimerDisplay();

            if (timerTime <= 0) {
                stopTimer();
                showNotification();
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
    timerPausedTime = Math.max(0, Math.ceil((timerEndAt - Date.now()) / 1000));
}

// Функция для остановки таймера
function stopTimer() {
    timerRunning = false;
    releaseWakeLock();
    
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

// Функция для сброса таймера
function resetTimer() {
    stopTimer();
    timerEndAt = 0;
    timerTime = Math.max(1, parseInt(timerMinutes.value)) * 60;
    timerPausedTime = 0;
    updateTimerDisplay();
}

// Обработчики событий
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

hideTasksBtn.addEventListener('click', () => {
    taskList.style.display = 'none';
});

addTaskBtn.addEventListener('click', () => {
    const text = taskText.value.trim();
    const category = parseInt(taskCategory.value);
    
    if (text) {
        // Задачи без категории по умолчанию неактивны
        const active = category !== 0;
        
        tasks.push({
            id: getNextId(),
            text,
            category,
            completed: false,
            active
        });
        
        saveTasks();
        taskText.value = '';
        displayTasks();
    }
});

addMultipleBtn.addEventListener('click', () => {
    const tasksText = prompt('Введите задачи, разделяя их переносом строки:');
    if (tasksText) {
        const tasksArray = tasksText.split('\n').filter(task => task.trim());
        
        if (confirm(`Добавить ${tasksArray.length} задач?`)) {
            tasksArray.forEach(task => {
                tasks.push({
                    id: getNextId(),
                    text: task.trim(),
                    category: 0, // Без категории
                    completed: false,
                    active: true // Теперь активны по умолчанию
                });
            });
            
            saveTasks();
            displayTasks();
        }
    }
});

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

completeTaskBtn.addEventListener('click', () => {
    if (currentTask) {
        // Помечаем задачу как выполненную и неактивную вме��то удаления
        const taskIndex = tasks.findIndex(t => t.id === currentTask.id);
        if (taskIndex !== -1) {
            tasks[taskIndex].completed = true;
            tasks[taskIndex].active = false;
            saveTasks();
        }
        
        stopTimer();
        hideTimer();
        displayTasks();
    }
});

returnTaskBtn.addEventListener('click', () => {
    stopTimer();
    hideTimer();
});

closeTimerBtn.addEventListener('click', () => {
    stopTimer();
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
            showNotification();
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
            createBrowserNotification();
            return;
        }
        try {
            const result = await Notification.requestPermission();
            if (result === 'granted') {
                setNotifyBannerVisible(false);
                createBrowserNotification();
            } else if (result === 'default') {
                alert('Уведомления не включены. Подтвердите запрос браузера или разрешите их в настройках сайта.');
            } else if (result === 'denied') {
                alert('Уведомления заблокированы в настройках браузера. Разрешите их вручную.');
            }
        } catch (e) {
            alert('Не удалось запросить разрешение на уведомления. Откройте сайт напрямую и попробуйте снова.');
        }
    });
}
