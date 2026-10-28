window.portfolioLocalStore = (() => {
  const databaseName = "porto-studio-local";
  const databaseVersion = 1;
  let databasePromise;

  function openDatabase() {
    if (!("indexedDB" in window)) {
      return Promise.reject(new Error("Penyimpanan lokal tidak tersedia di browser ini."));
    }
    if (!databasePromise) {
      databasePromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(databaseName, databaseVersion);
        request.onupgradeneeded = () => {
          const database = request.result;
          if (!database.objectStoreNames.contains("content")) {
            database.createObjectStore("content", { keyPath: "id" });
          }
          if (!database.objectStoreNames.contains("settings")) {
            database.createObjectStore("settings", { keyPath: "key" });
          }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || new Error("Gagal membuka penyimpanan lokal."));
        request.onblocked = () => reject(new Error("Penyimpanan lokal sedang dipakai tab lain. Tutup tab lama lalu coba lagi."));
      });
    }
    return databasePromise;
  }

  async function requestStore(storeName, mode, action) {
    const database = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(storeName, mode);
      const request = action(transaction.objectStore(storeName));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("Operasi penyimpanan lokal gagal."));
      transaction.onabort = () => reject(transaction.error || new Error("Penyimpanan lokal dibatalkan."));
    });
  }

  return {
    list: () => requestStore("content", "readonly", (store) => store.getAll()),
    get: (id) => requestStore("content", "readonly", (store) => store.get(id)),
    save: (row) => requestStore("content", "readwrite", (store) => store.put(row)),
    remove: (id) => requestStore("content", "readwrite", (store) => store.delete(id)),
    getSetting: async (key) => {
      const setting = await requestStore("settings", "readonly", (store) => store.get(key));
      return setting?.value;
    },
    setSetting: (key, value) => requestStore("settings", "readwrite", (store) => store.put({ key, value }))
  };
})();
