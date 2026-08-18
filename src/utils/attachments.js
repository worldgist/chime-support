export const MAX_FILE_SIZE = 10 * 1024 * 1024
export const MAX_ATTACHMENTS = 6

export function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export async function createAttachment(file) {
  const type = file.type.startsWith('image/') ? 'image' : 'file'
  return {
    id: crypto.randomUUID(),
    type,
    name: file.name,
    size: file.size,
    mime: file.type || 'application/octet-stream',
    file,
    url: type === 'image' ? URL.createObjectURL(file) : '',
  }
}

export async function addFiles(current, files) {
  const next = [...current]
  const errors = []

  for (const file of files) {
    if (next.length >= MAX_ATTACHMENTS) {
      errors.push(`You can attach up to ${MAX_ATTACHMENTS} items.`)
      break
    }
    if (file.size > MAX_FILE_SIZE) {
      errors.push(`${file.name} is larger than 10 MB.`)
      continue
    }
    next.push(await createAttachment(file))
  }

  return { attachments: next, errors }
}

export async function toLocalAttachment(item) {
  if (!item?.file) {
    const { file, ...rest } = item || {}
    return rest
  }
  const url = item.url?.startsWith('blob:') || !item.url ? await readAsDataUrl(item.file) : item.url
  const { file, ...rest } = item
  return { ...rest, url }
}
