
import {
  verifyAttachmentDownloadFromDrive,
} from './googleDriveApi'

export interface AttachmentAccessFailure {
  fileId: string
  reason: string
}

export interface AttachmentAccessReport {
  authorizedFileIds: string[]
  failures: AttachmentAccessFailure[]
}

export function isLikelyAttachmentAccessError(
  message: string | null,
): boolean {
  if (!message) {
    return false
  }

  return (
    /\bstatus (403|404)\b/i.test(message) ||
    /not authorized/i.test(message) ||
    /permission denied/i.test(message)
  )
}

export async function verifySelectedAttachmentAccess(
  accessToken: string,
  fileIds: readonly string[],
): Promise<AttachmentAccessReport> {
  const uniqueIds = [
    ...new Set(fileIds.filter(Boolean)),
  ]

  const report: AttachmentAccessReport = {
    authorizedFileIds: [],
    failures: [],
  }

  // Check small groups to avoid excessive
  // simultaneous Google Drive requests.
  const batchSize = 4

  for (
    let start = 0;
    start < uniqueIds.length;
    start += batchSize
  ) {
    const batch = uniqueIds.slice(
      start,
      start + batchSize,
    )

    const results = await Promise.all(
      batch.map(async (fileId) => {
        try {
          await verifyAttachmentDownloadFromDrive(
            accessToken,
            fileId,
          )

          return {
            fileId,
            error: null,
          }
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : 'Unknown attachment access error.'

          if (/\bstatus 401\b/i.test(message)) {
            throw error
          }

          return {
            fileId,
            error: message,
          }
        }
      }),
    )

    for (const result of results) {
      if (result.error === null) {
        report.authorizedFileIds.push(
          result.fileId,
        )
      } else {
        report.failures.push({
          fileId: result.fileId,
          reason: result.error,
        })
      }
    }
  }

  return report
}
