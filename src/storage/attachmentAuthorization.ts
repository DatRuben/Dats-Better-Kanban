
import {
  verifyAttachmentDownloadFromDrive,
} from './googleDriveApi'

export type AttachmentAccessFailureKind =
  | 'authorization'
  | 'temporary'
  | 'other'

export interface AttachmentAccessFailure {
  fileId: string
  reason: string
  kind: AttachmentAccessFailureKind
}

export interface AttachmentAccessReport {
  authorizedFileIds: string[]
  failures: AttachmentAccessFailure[]
}

export function classifyAttachmentAccessError(
  message: string,
): AttachmentAccessFailureKind {
  // Google sometimes returns HTTP 403 for
  // rate limits, not just permission failures.
  if (
    /rate.?limit|quota|dailyLimitExceeded|RESOURCE_EXHAUSTED|backendError|internalError|serviceUnavailable/i.test(
      message,
    )
  ) {
    return 'temporary'
  }

  const status =
    /\bstatus\s+(\d{3})\b/i.exec(message)

  if (status) {
    const code = Number(status[1])

    if (
      code === 408 ||
      code === 409 ||
      code === 425 ||
      code === 429 ||
      code >= 500
    ) {
      return 'temporary'
    }

    if (code === 403 || code === 404) {
      return 'authorization'
    }
  }

  if (
    /not authorized|permission denied|insufficient permissions|access denied/i.test(
      message,
    )
  ) {
    return 'authorization'
  }

  if (
    /failed to fetch|network|timed out|timeout|offline|connection|aborterror/i.test(
      message,
    )
  ) {
    return 'temporary'
  }

  return 'other'
}

export function isLikelyAttachmentAccessError(
  message: string | null,
): boolean {
  return (
    message !== null &&
    classifyAttachmentAccessError(message) ===
      'authorization'
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
            reason: null,
            kind: null,
          }
        } catch (error) {
          const reason =
            error instanceof Error
              ? error.message
              : 'Unknown attachment access error.'

          // Expired sessions must be handled
          // by the application, not Picker.
          if (
            /\bstatus\s+401\b/i.test(reason)
          ) {
            throw error
          }

          return {
            fileId,
            reason,
            kind:
              classifyAttachmentAccessError(
                reason,
              ),
          }
        }
      }),
    )

    for (const result of results) {
      if (result.reason === null) {
        report.authorizedFileIds.push(
          result.fileId,
        )
      } else {
        report.failures.push({
          fileId: result.fileId,
          reason: result.reason,
          kind: result.kind!,
        })
      }
    }
  }

  return report
}
