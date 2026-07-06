const STORAGE_PREFIX = 'occupation-graph-preview:'

export function savePreviewPayload(payload) {
  const previewId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const content = JSON.stringify(payload)
  localStorage.setItem(`${STORAGE_PREFIX}${previewId}`, content)
  sessionStorage.setItem(`${STORAGE_PREFIX}${previewId}`, content)
  return previewId
}

export function loadPreviewPayload() {
  const previewId = new URLSearchParams(window.location.search).get('preview')
  if (!previewId) {
    return null
  }

  const raw =
    sessionStorage.getItem(`${STORAGE_PREFIX}${previewId}`) ||
    localStorage.getItem(`${STORAGE_PREFIX}${previewId}`)
  if (!raw) {
    return null
  }

  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}
