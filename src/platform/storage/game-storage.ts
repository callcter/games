const DATABASE_NAME = 'family-game-room'
const STORE_NAME = 'game-saves'
const DATABASE_VERSION = 1

export async function loadGameSave<T>(key: string): Promise<T | null> {
  try {
    const database = await openDatabase()
    return await new Promise<T | null>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readonly')
      const request = transaction.objectStore(STORE_NAME).get(key)
      request.onsuccess = () => resolve((request.result as T | undefined) ?? null)
      request.onerror = () => reject(request.error)
      transaction.oncomplete = () => database.close()
    })
  } catch (error) {
    console.warn('读取游戏存档失败，将使用新游戏。', error)
    return null
  }
}

export async function saveGame<T>(key: string, value: T): Promise<void> {
  try {
    const database = await openDatabase()
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readwrite')
      transaction.objectStore(STORE_NAME).put(value, key)
      transaction.oncomplete = () => {
        database.close()
        resolve()
      }
      transaction.onerror = () => reject(transaction.error)
      transaction.onabort = () => reject(transaction.error)
    })
  } catch (error) {
    console.warn('保存游戏进度失败。', error)
  }
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

