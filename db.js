(function(){
  const DB_NAME = 'korobochka-db';
  const DB_VERSION = 1;
  const TASKS_STORE = 'tasks';
  const META_STORE = 'meta';

  let dbPromise = null;

  function openDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = req.result;
        if (!db.objectStoreNames.contains(TASKS_STORE)) {
          db.createObjectStore(TASKS_STORE, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(META_STORE)) {
          db.createObjectStore(META_STORE, { keyPath: 'key' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbPromise;
  }

  async function getStore(storeName, mode='readonly') {
    const db = await openDB();
    return db.transaction(storeName, mode).objectStore(storeName);
  }

  async function getMeta(key) {
    const store = await getStore(META_STORE);
    return new Promise((resolve, reject) => {
      const r = store.get(key);
      r.onsuccess = () => resolve(r.result ? r.result.value : undefined);
      r.onerror = () => reject(r.error);
    });
  }

  async function setMeta(key, value) {
    const store = await getStore(META_STORE, 'readwrite');
    return new Promise((resolve, reject) => {
      const r = store.put({ key, value });
      r.onsuccess = () => resolve(true);
      r.onerror = () => reject(r.error);
    });
  }

  async function getAllTasks() {
    const store = await getStore(TASKS_STORE);
    return new Promise((resolve, reject) => {
      const r = store.getAll();
      r.onsuccess = () => resolve(r.result || []);
      r.onerror = () => reject(r.error);
    });
  }

  async function clearTasks() {
    const store = await getStore(TASKS_STORE, 'readwrite');
    return new Promise((resolve, reject) => {
      const r = store.clear();
      r.onsuccess = () => resolve(true);
      r.onerror = () => reject(r.error);
    });
  }

  async function putTask(task) {
    const store = await getStore(TASKS_STORE, 'readwrite');
    return new Promise((resolve, reject) => {
      const r = store.put(task);
      r.onsuccess = () => resolve(true);
      r.onerror = () => reject(r.error);
    });
  }

  async function saveAllTasks(list) {
    // Replace entire content to keep parity with in-memory array
    await clearTasks();
    // Chunk writes to avoid blocking
    const CHUNK = 200;
    for (let i = 0; i < list.length; i += CHUNK) {
      const slice = list.slice(i, i + CHUNK);
      await Promise.all(slice.map(item => putTask(item)));
      await new Promise(r => setTimeout(r, 0));
    }
  }

  async function migrateFromLocalStorageIfNeeded() {
    try {
      const migrated = await getMeta('migrated_v1');
      const existing = await getAllTasks();
      if (migrated || (Array.isArray(existing) && existing.length > 0)) return false;
      const raw = localStorage.getItem('tasks');
      if (!raw) return false;
      let parsed = [];
      try { parsed = JSON.parse(raw); } catch (_) { parsed = []; }
      if (!Array.isArray(parsed) || parsed.length === 0) return false;
      await saveAllTasks(parsed);
      await setMeta('migrated_v1', true);
      return true;
    } catch (_) { return false; }
  }

  async function init() {
    await openDB();
    await migrateFromLocalStorageIfNeeded();
    return true;
  }

  window.DB = {
    init,
    getAllTasks,
    saveAllTasks,
  };
})();
