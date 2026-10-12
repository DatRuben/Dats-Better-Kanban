
import '@google/model-viewer'

import {
  useEffect,
  useRef,
  useState,
} from 'react'

import type {
  Attachment,
} from '../types/board'

import {
  isLikelyAttachmentAccessError,
} from '../storage/attachmentAuthorization'

interface GlbPreviewProps {
  attachment: Attachment
  onLoadAttachment: (
    driveFileId: string,
  ) => Promise<Blob | null>
  onClose: () => void
  onRetry?: () => void
  onAuthorizeAttachment?: () => void
  embedded?: boolean
}

export function GlbPreview({
  attachment,
  onLoadAttachment,
  onClose,
  onAuthorizeAttachment,
  embedded = false,
}: GlbPreviewProps) {
  const viewerContainerRef =
    useRef<HTMLDivElement | null>(null)

  const [isLoading, setIsLoading] =
    useState(true)

  const [loadError, setLoadError] =
    useState<string | null>(null)

  const {
    id: attachmentId,
    driveFileId,
    fileName,
    previewUrl,
  } = attachment

  useEffect(() => {
    let isCancelled = false
    let objectUrl: string | null = null
    let modelViewer: HTMLElement | null = null

    async function loadModel() {
      let sourceUrl = previewUrl ?? null

      if (!sourceUrl) {
        if (!driveFileId) {
          throw new Error(
            'This model has no Google Drive file reference.',
          )
        }

        const blob =
          await onLoadAttachment(driveFileId)

        if (isCancelled) {
          return
        }

        if (!blob) {
          throw new Error(
            'No 3D model data was returned.',
          )
        }

        const glbBlob =
          blob.type === 'model/gltf-binary'
            ? blob
            : new Blob([blob], {
              type: 'model/gltf-binary',
            })

        objectUrl =
          URL.createObjectURL(glbBlob)

        sourceUrl = objectUrl
      }

      if (isCancelled) {
        return
      }

      const viewer =
        document.createElement('model-viewer')

      modelViewer = viewer

      viewer.className =
        'glb-preview__viewer'

      viewer.setAttribute(
        'src',
        sourceUrl,
      )

      viewer.setAttribute(
        'alt',
        fileName,
      )

      viewer.setAttribute(
        'camera-controls',
        '',
      )

      viewer.setAttribute(
        'auto-rotate',
        '',
      )

      viewer.setAttribute(
        'shadow-intensity',
        '1',
      )

      viewer.addEventListener('load', () => {
        if (!isCancelled) {
          setIsLoading(false)
          setLoadError(null)
        }
      })

      viewer.addEventListener('error', () => {
        if (!isCancelled) {
          setIsLoading(false)
          setLoadError(
            'The GLB model could not be displayed.',
          )
        }
      })

      viewerContainerRef.current
        ?.replaceChildren(viewer)
    }

    void loadModel().catch((error) => {
      if (isCancelled) {
        return
      }

      setIsLoading(false)

      setLoadError(
        error instanceof Error
          ? error.message
          : 'The 3D model could not be loaded.',
      )

      console.error(
        'Failed to load GLB preview:',
        error,
      )
    })

    return () => {
      isCancelled = true
      modelViewer?.remove()

      if (objectUrl) {
        URL.revokeObjectURL(objectUrl)
      }
    }
  }, [
    attachmentId,
    driveFileId,
    fileName,
    previewUrl,
    onLoadAttachment,
  ])

  const canOfferAuthorization =
    Boolean(driveFileId) &&
    Boolean(onAuthorizeAttachment) &&
    isLikelyAttachmentAccessError(loadError)

  return (
    <div
      className="glb-preview"
      onPointerDown={(event) =>
        event.stopPropagation()
      }
    >

      {!embedded && (
        <div className="glb-preview__header">
          <strong>{fileName}</strong>

          <button
            type="button"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      )}


      {isLoading && (
        <div className="glb-preview__status">
          Loading 3D model…
        </div>
      )}

      {loadError && (
        <div className="glb-preview__status">
          <p>{loadError}</p>


          {onRetry && (
            <button
              type="button"
              className="task-card__file-action"
              onClick={onRetry}
            >
              Retry Preview
            </button>
          )}


          {canOfferAuthorization && (
            <button
              type="button"
              onClick={onAuthorizeAttachment}
            >
              Check / Authorize File
            </button>
          )}
        </div>
      )}

      <div
        ref={viewerContainerRef}
        className="glb-preview__container"
      />
    </div>
  )
}
