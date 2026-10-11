import type { Project } from '../types/board'

const DRIVE_FILES_URL = 'https://www.googleapis.com/drive/v3/files'
const RETRY_DELAY_MS = 5 * 60 * 1000


const retryAfter = new Map<string, number>()

export interface SharedDeletionCleanupOptions {
  accessToken: string
  projectFileId: string
  userPermissionId: string
  attachmentsFolderId: string
  savedProject: Project
  localProject: Project

  canProceed: () => boolean
  getCurrentLocalProject: () => Project
}

interface DriveFileMetadata {
  parents?: string[]
  trashed?: boolean
  capabilities?: {
    canDelete?: boolean
  }
}

function referencedFileIds(...projects: Project[]): Set<string> {
  const result = new Set<string>()

  for (const project of projects) {
    for (const task of project.tasks) {
      for (const attachment of task.attachments) {
        if (attachment.driveFileId) {
          result.add(attachment.driveFileId)
        }
      }
    }
  }

  return result
}


function receiptKey(projectFileId: string, fileId: string): string {
  return `dats:deleted-attachment:${projectFileId}:${fileId}`
}

function hasSuccessReceipt(key: string): boolean {
  try {
    return localStorage.getItem(key) === '1'
  } catch {
    return false
  }
}

function rememberSuccess(key: string): void {
  try {
    localStorage.setItem(key, '1')
  } catch {
  }
}

function pauseRetry(key: string): void {
  retryAfter.set(key, Date.now() + RETRY_DELAY_MS)
}

export async function processSharedAttachmentDeletions(
  options: SharedDeletionCleanupOptions,
): Promise<string[]> {
  const {
    accessToken,
    projectFileId,
    userPermissionId,
    attachmentsFolderId,
    savedProject,
    localProject,
    canProceed,
    getCurrentLocalProject,
  } = options

  if (
    savedProject.id !== localProject.id ||
    !attachmentsFolderId ||
    !canProceed()
  ) {
    return []
  }

  const referenced = referencedFileIds(savedProject, localProject)
  const completed: string[] = []
  const seen = new Set<string>()

  for (const request of savedProject.attachmentDeletionRequests ?? []) {
    const fileId = request.driveFileId

    if (
      !fileId ||
      request.completedAt ||
      seen.has(fileId) ||
      referenced.has(fileId) ||
      !canProceed()
    ) {
      continue
    }

    seen.add(fileId)

    const successKey = receiptKey(projectFileId, fileId)
    if (hasSuccessReceipt(successKey)) {
      completed.push(fileId)
      continue
    }

    const retryKey = `${projectFileId}:${userPermissionId}:${fileId}`
    if ((retryAfter.get(retryKey) ?? 0) > Date.now()) {
      continue
    }

    try {
      const metadataUrl = new URL(`${DRIVE_FILES_URL}/${encodeURIComponent(fileId)}`)
      metadataUrl.searchParams.set(
        'fields',
        'id,parents,trashed,capabilities(canDelete)',
      )

      const metadataResponse = await fetch(metadataUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })

      if (metadataResponse.status === 401) {
        throw new Error('Google Drive attachment access failed with status 401.')
      }

      if (!metadataResponse.ok) {
        pauseRetry(retryKey)
        continue
      }

      const metadata = await metadataResponse.json() as DriveFileMetadata
      if (
        metadata.trashed === true ||
        metadata.capabilities?.canDelete !== true ||
        !metadata.parents?.includes(attachmentsFolderId)
      ) {
        pauseRetry(retryKey)
        continue
      }

      if (
        !canProceed() ||
        referencedFileIds(getCurrentLocalProject()).has(fileId)
      ) {
        continue
      }

      const deletionResponse = await fetch(
        `${DRIVE_FILES_URL}/${encodeURIComponent(fileId)}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${accessToken}` },
        },
      )

      if (deletionResponse.status === 401) {
        throw new Error('Google Drive attachment deletion failed with status 401.')
      }

      if (!deletionResponse.ok) {
        pauseRetry(retryKey)
        if (deletionResponse.status !== 403 && deletionResponse.status !== 404) {
          console.warn(
            `Google Drive attachment cleanup failed with status ${deletionResponse.status}.`,
          )
        }
        continue
      }

      rememberSuccess(successKey)
      retryAfter.delete(retryKey)
      completed.push(fileId)
    } catch (error) {
      if (error instanceof Error && error.message.includes('status 401')) {
        throw error
      }

      pauseRetry(retryKey)
      console.warn('Google Drive attachment cleanup could not complete:', error)
    }
  }

  return completed
}
