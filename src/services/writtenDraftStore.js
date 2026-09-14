const DATABASE_NAME = 'solvescript-written-drafts';
const STORE_NAME = 'pages';

function openDatabase() {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error('Offline storage is unavailable in this browser'));
      return;
    }
    const request = window.indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME, { keyPath: 'key' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore(mode, action) {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, mode);
    const store = transaction.objectStore(STORE_NAME);
    const request = action(store);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => database.close();
    transaction.onerror = () => database.close();
  });
}

export async function readWrittenDraft(attemptId, pageNumber) {
  return withStore('readonly', (store) => store.get(`${attemptId}:${pageNumber}`));
}

export async function saveWrittenDraft({ attemptId, pageNumber, annotation, revision }) {
  return withStore('readwrite', (store) => store.put({
    key: `${attemptId}:${pageNumber}`,
    attemptId,
    pageNumber,
    annotation,
    revision,
    savedAt: new Date().toISOString(),
  }));
}

export async function removeWrittenDraft(attemptId, pageNumber) {
  return withStore('readwrite', (store) => store.delete(`${attemptId}:${pageNumber}`));
}
