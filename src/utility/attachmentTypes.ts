export function isPreviewableMedia(
  mimeType: string,
) {
  return (
    mimeType.startsWith('image/') ||
    mimeType === 'video/mp4'
  )
}

export function isBlenderFileName(
  fileName: string,
) {
  return fileName
    .toLowerCase()
    .endsWith('.blend')
}

export function isSupportedAttachmentFile(
  file: File,
) {
  return (
    isPreviewableMedia(file.type) ||
    isBlenderFileName(file.name)
  )
}

export function getAttachmentTypeLabel(
  fileName: string,
  mimeType: string,
) {
  if (isBlenderFileName(fileName)) {
    return 'Blender file'
  }

  if (mimeType.startsWith('image/')) {
    return 'Image'
  }

  if (mimeType === 'video/mp4') {
    return 'MP4 video'
  }

  return mimeType || 'File'
}