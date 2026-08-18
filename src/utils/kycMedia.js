const DB_NAME = 'chime-kyc-media'
const STORE = 'images'

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) {
        request.result.createObjectStore(STORE)
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export function resizeImage(dataUrl, maxWidth = 960, quality = 0.72) {
  return new Promise((resolve) => {
    const image = new Image()
    image.onload = () => {
      const scale = Math.min(1, maxWidth / image.width)
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(image.width * scale))
      canvas.height = Math.max(1, Math.round(image.height * scale))
      canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height)
      resolve(canvas.toDataURL('image/jpeg', quality))
    }
    image.onerror = () => resolve(dataUrl)
    image.src = dataUrl
  })
}

export async function saveKycImage(key, dataUrl) {
  const db = await openDb()
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(dataUrl, key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  return key
}

export async function loadKycImage(key) {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const request = tx.objectStore(STORE).get(key)
    request.onsuccess = () => resolve(request.result || '')
    request.onerror = () => reject(request.error)
  })
}

export async function hydrateCaseDocuments(list) {
  return Promise.all(
    list.map(async (item) => ({
      ...item,
      documents: await Promise.all(
        (item.documents || []).map(async (doc) => {
          if (doc.src || !doc.mediaKey) return doc
          const src = await loadKycImage(doc.mediaKey)
          return src ? { ...doc, src } : doc
        }),
      ),
    })),
  )
}

export function stripDocumentSrc(list) {
  return list.map((item) => ({
    ...item,
    documents: (item.documents || []).map(({ src, ...doc }) => doc),
  }))
}
