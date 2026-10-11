
import { useState } from 'react'

import type {
  Attachment,
} from '../types/board'

import {
  isLikelyAttachmentAccessError,
} from '../storage/attachmentAuthorization'

interface AttachmentDownloadButtonProps {
  attachment: Attachment
  onLoadAttachment: (
    driveFileId: string,
  ) => Promise<Blob | null>
  onAuthorizeAttachment: (
    attachment: Attachment,
  ) => void
}

export function AttachmentDownloadButton({
  attachment,
  onLoadAttachment,
  onAuthorizeAttachment,
}: AttachmentDownloadButtonProps) {
  const [isDownloading, setIsDownloading] =
    useState(false)

  const [error, setError] =
    useState<string | null>(null)

  async function handleDownload() {
    if (isDownloading) {
      return
    }

    setIsDownloading(true)
    setError(null)

    try {
      let blob: Blob | null = null

      if (attachment.driveFileId) {
        blob = await onLoadAttachment(
          attachment.driveFileId,
        )
      } else if (
        attachment.previewUrl?.startsWith('blob:')
      ) {
        const response = await fetch(
          attachment.previewUrl,
        )

        if (!response.ok) {
          throw new Error(
            'The local attachment is no longer available.',
          )
        }

        blob = await response.blob()
      }

      if (!blob) {
        throw new Error(
          'File data is unavailable. Reconnect to Google Drive or re-add the file.',
        )
      }

      const objectUrl =
        URL.createObjectURL(blob)

      const link =
        document.createElement('a')

      link.href = objectUrl
      link.download = attachment.fileName
      link.style.display = 'none'

      document.body.appendChild(link)
      link.click()
      link.remove()

      // Allow the browser time to begin the
      // download before releasing the URL.
      window.setTimeout(() => {
        URL.revokeObjectURL(objectUrl)
      }, 30_000)
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'File download failed.',
      )
    } finally {
      setIsDownloading(false)
    }
  }

  return (
    <div className="attachment-download">
      <button
        type="button"
        className="task-card__file-action"
        disabled={isDownloading}
        aria-label={`Download ${attachment.fileName}`}
        onPointerDown={(event) =>
          event.stopPropagation()
        }
        onClick={(event) => {
          event.stopPropagation()
          void handleDownload()
        }}
      >
        {isDownloading
          ? 'Downloading…'
          : 'Download'}
      </button>

      {error && (
        <div
          className="attachment-download__error"
          role="alert"
        >
          {error}

          {attachment.driveFileId &&
            isLikelyAttachmentAccessError(error) && (
              <button
                type="button"
                className="task-card__file-action"
                onPointerDown={(event) =>
                  event.stopPropagation()
                }
                onClick={() =>
                  onAuthorizeAttachment(attachment)
                }
              >
                Check / Authorize File
              </button>
            )}
        </div>
      )}
    </div>
  )
}
