const DATABASE_NAME = 'family-game-room'
const STORE_NAME = 'game-saves'
const DATABASE_VERSION = 1
const STORAGE_TIMEOUT_MS = 2000

// Safari 隐私模式等场景可能让 IndexedDB 请求永远不回调，
// 超时后按“无存档”处理，保证游戏一定能开始。
export async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error(message)), timeoutMs)
      })
    ])
  } finally {
    clearTimeout(timer)
  }
}

export async function loadGameSave<T>(key: string, timeoutMs = STORAGE_TIMEOUT_MS): Promise<T | null> {
  try {
    const database = await withTimeout(openDatabase(), timeoutMs, '打开存档数据库超时')
    return await withTimeout(readSave(database, key), timeoutMs, '读取存档超时')
  } catch (error) {
    console.warn('读取游戏存档失败，将使用新游戏。', error)
    return null
  }
}

export async function saveGame<T>(key: string, value: T, timeoutMs = STORAGE_TIMEOUT_MS): Promise<void> {
  try {
    const database = await withTimeout(openDatabase(), timeoutMs, '打开存档数据库超时')
    await withTimeout(writeSave(database, key, value), timeoutMs, '保存存档超时')
  } catch (error) {
    console.warn('保存游戏进度失败。', error)
  }
}

function readSave<T>(database: IDBDatabase, key: string): Promise<T | null> {
  return new Promise<T | null>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readonly')
    const request = transaction.objectStore(STORE_NAME).get(key)
    request.onsuccess = () => resolve((request.result as T | undefined) ?? null)
    request.onerror = () => reject(request.error)
    transaction.oncomplete = () => database.close()
  })
}

function writeSave<T>(database: IDBDatabase, key: string, value: T): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite')
    transaction.objectStore(STORE_NAME).put(value, key)
    transaction.oncomplete = () => {
      database.close()
      resolve()
    }
    transaction.onerror = () => reject(transaction.error)
    transaction.onabort = () => reject(transaction.error)
  })
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION)
    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME)
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
    request.onblocked = () => reject(new Error('存档数据库正被另一个页面占用'))
  })
}
