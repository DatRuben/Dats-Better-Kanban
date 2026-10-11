
import type {
  Attachment,
  Project,
} from '../types/board'

const STORAGE_KEY =
  'dats.pendingAttachmentUploads.v1'

export interface PendingAttachmentUpload {
  projectFileId: string
  userPermissionId: string
  attachment: Attachment
  uploadedAt: string
}

function readAll(): PendingAttachmentUpload[] {
  const stored = localStorage.getItem(
    STORAGE_KEY,
  )

  if (!stored) {
    return []
  }

  const parsed: unknown = JSON.parse(stored)

  if (
    !Array.isArray(parsed) ||
    !parsed.every((value: unknown) => {
      if (
        typeof value !== 'object' ||
        value === null
      ) {
        return false
      }

      const record =
        value as Partial<PendingAttachmentUpload>

      return (
        typeof record.projectFileId === 'string' &&
        typeof record.userPermissionId === 'string' &&
        typeof record.uploadedAt === 'string' &&
        typeof record.attachment?.id === 'string' &&
        typeof record.attachment.driveFileId === 'string' &&
        typeof record.attachment.fileName === 'string' &&
        typeof record.attachment.mimeType === 'string'
      )
    })
  ) {
    throw new Error(
      'The local attachment recovery journal is invalid.',
    )
  }

  return parsed as PendingAttachmentUpload[]
}

function writeAll(
  entries: PendingAttachmentUpload[],
): void {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(entries),
  )
}

export function getPendingUploads(
  userPermissionId: string,
  projectFileId: string,
): PendingAttachmentUpload[] {
  return readAll().filter(
    (entry) =>
      entry.userPermissionId === userPermissionId &&
      entry.projectFileId === projectFileId,
  )
}

export function recordPendingUpload(
  entry: PendingAttachmentUpload,
): void {
  const entries = readAll()

  const alreadyRecorded = entries.some(
    (existing) =>
      existing.projectFileId === entry.projectFileId &&
      existing.userPermissionId === entry.userPermissionId &&
      existing.attachment.driveFileId ===
        entry.attachment.driveFileId,
  )

  if (!alreadyRecorded) {
    writeAll([...entries, entry])
  }
}

export function removePendingUpload(
  userPermissionId: string,
  projectFileId: string,
  driveFileId: string,
): void {
  writeAll(
    readAll().filter(
      (entry) =>
        !(
          entry.userPermissionId === userPermissionId &&
          entry.projectFileId === projectFileId &&
          entry.attachment.driveFileId === driveFileId
        ),
    ),
  )
}

export function reconcilePendingUploads(
  userPermissionId: string,
  projectFileId: string,
  savedProject: Project,
): PendingAttachmentUpload[] {
  const referencedFileIds = new Set(
    savedProject.tasks.flatMap(
      (task) =>
        task.attachments.flatMap(
          (attachment) =>
            attachment.driveFileId
              ? [attachment.driveFileId]
              : [],
        ),
    ),
  )

  const existing = readAll()

  const remaining = existing.filter(
    (entry) =>
      !(
        entry.userPermissionId === userPermissionId &&
        entry.projectFileId === projectFileId &&
        referencedFileIds.has(
          entry.attachment.driveFileId!,
        )
      ),
  )

  if (remaining.length !== existing.length) {
    writeAll(remaining)
  }

  return remaining.filter(
    (entry) =>
      entry.userPermissionId === userPermissionId &&
      entry.projectFileId === projectFileId,
  )
}
