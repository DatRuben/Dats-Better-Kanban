import {
  getAttachmentDriveAccess,
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

export async function verifySelectedAttachmentAccess(
  accessToken: string,
  fileIds: readonly string[],
): Promise<AttachmentAccessReport> {
  const report: AttachmentAccessReport = {
    authorizedFileIds: [],
    failures: [],
  }

  const uniqueFileIds = new Set(fileIds)

  for (const fileId of uniqueFileIds) {
    try {
      const access = await getAttachmentDriveAccess(
        accessToken,
        fileId,
      )

      if (!access.isAppAuthorized) {
        throw new Error(
          "Google reports that Dat's is not authorized to access this file.",
        )
      }

      if (!access.canDownload) {
        throw new Error(
          'This Google account cannot download this file.',
        )
      }

      await verifyAttachmentDownloadFromDrive(
        accessToken,
        fileId,
      )

      report.authorizedFileIds.push(fileId)
    } catch (error) {
      report.failures.push({
        fileId,
        reason:
          error instanceof Error
            ? error.message
            : 'Unknown attachment access error.',
      })
    }
  }

  return report
}
