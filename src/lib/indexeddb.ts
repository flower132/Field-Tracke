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
      retryCount: 0,
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
      request.onsuccess = () => {
        const items = request.result as Array<{ _createdAt?: string; retryCount?: number }>
        items.sort((a, b) => {
          const ta = a._createdAt ? new Date(a._createdAt).getTime() : 0
          const tb = b._createdAt ? new Date(b._createdAt).getTime() : 0
          return ta - tb
        })
        resolve(items)
      }
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

export async function updateTaskRetry(
  table: OfflineTable,
  id: number,
  retryCount: number
): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(table, 'readwrite')
    const store = tx.objectStore(table)
    const getReq = store.get(id)
    getReq.onsuccess = () => {
      const data = getReq.result
      if (!data) {
        resolve()
        return
      }
      data.retryCount = retryCount
      data._lastRetryAt = new Date().toISOString()
      const putReq = store.put(data)
      putReq.onsuccess = () => resolve()
      putReq.onerror = () => reject(putReq.error)
    }
    getReq.onerror = () => reject(getReq.error)
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
