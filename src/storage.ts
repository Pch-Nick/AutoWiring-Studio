const DB = 'autowiring', ST = 'projects'
const open = () => new Promise<IDBDatabase>((res, rej) => { const r = indexedDB.open(DB, 1)
  r.onupgradeneeded = () => r.result.createObjectStore(ST); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error) })
export async function dbPut(key: string, val: unknown) { const db = await open()
  return new Promise<void>((res, rej) => { const t = db.transaction(ST, 'readwrite'); t.objectStore(ST).put(val, key); t.oncomplete = () => res(); t.onerror = () => rej(t.error) }) }
export async function dbGet<T>(key: string) { const db = await open()
  return new Promise<T | undefined>((res, rej) => { const r = db.transaction(ST).objectStore(ST).get(key); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error) }) }
export async function dbAll<T>() { const db = await open()
  return new Promise<T[]>((res, rej) => { const r = db.transaction(ST).objectStore(ST).getAll(); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error) }) }
export async function dbDel(key: string) { const db = await open()
  return new Promise<void>((res, rej) => { const t = db.transaction(ST, 'readwrite'); t.objectStore(ST).delete(key); t.oncomplete = () => res(); t.onerror = () => rej(t.error) }) }
