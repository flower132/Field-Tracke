import { OFFLINE_DB_NAME, OFFLINE_DB_VERSION } from '../utils/constants'

export type OfflineTable = 'tracks' | 'checkins' | 'photos' | 'syncQueue'

let dbPromise: Promise<IDBDatabase> | null = null

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(OFFLINE_DB_NAME, OFFLINE_DB_VERSION)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains('tracks')) {
        db.createObjectStore('tracks', { keyPath: 'id', autoIncrement: true })
      }
      if (!db.objectStoreNames.contains('checkins')) {
        db.createObjectStore('checkins', { keyPath: 'id', autoIncrement: true })
      }
      if (!db.objectStoreNames.contains('photos')) {
        const photoStore = db.createObjectStore('photos', { keyPath: 'id', autoIncrement: true })
        photoStore.createIndex('checkinTempId', 'checkinTempId', { unique: false })
      }
      if (!db.objectStoreNames.contains('syncQueue')) {
        db.createObjectStore('syncQueue', { keyPath: 'id', autoIncrement: true })
      }
    }
  })
  return dbPromise
}

export async function addPendingTask(table: OfflineTable, data: unknown): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(table, 'readwrite')
    const store = tx.objectStore(table)
    const request = store.add({
      ...(data as Record<string, unknown>),
      _createdAt: new Date().toISOString(),
    })
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

export async function getPendingTasks(table: OfflineTable): Promise<unknown[]> {
  return new Promise((resolve, reject) => {
    openDB().then(db => {
      const tx = db.transaction(table, 'readonly')
      const store = tx.objectStore(table)
      const request = store.getAll()
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    }).catch(reject)
  })
}

export async function removeTask(table: OfflineTable, id: number): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(table, 'readwrite')
    const store = tx.objectStore(table)
    const request = store.delete(id)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

export async function clearTable(table: OfflineTable): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(table, 'readwrite')
    const store = tx.objectStore(table)
    const request = store.clear()
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

export async function getPendingCount(): Promise<number> {
  const db = await openDB()
  const tables: OfflineTable[] = ['tracks', 'checkins', 'photos']
  let total = 0
  for (const table of tables) {
    const count = await new Promise<number>((resolve, reject) => {
      const tx = db.transaction(table, 'readonly')
      const store = tx.objectStore(table)
      const request = store.count()
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    total += count
  }
  return total
}

export async function getTotalSize(): Promise<number> {
  const tables: OfflineTable[] = ['tracks', 'checkins', 'photos']
  let totalSize = 0
  for (const table of tables) {
    const items = await getPendingTasks(table)
    for (const item of items) {
      totalSize += new Blob([JSON.stringify(item)]).size
    }
  }
  return totalSize
}
