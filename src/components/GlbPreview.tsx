import '@google/model-viewer'

import {
  useEffect,
  useRef,
  useState,
} from 'react'

import type {
  Attachment,
} from '../types/board'

interface GlbPreviewProps {
  attachment: Attachment

  onLoadAttachment: (
    attachment: Attachment,
  ) => Promise<Blob | null>

  onClose: () => void
}

export function GlbPreview({
  attachment,
  onLoadAttachment,
  onClose,
}: GlbPreviewProps) {
  const viewerContainerRef =
    useRef<HTMLDivElement | null>(
      null,
    )

  const [isLoading, setIsLoading] =
    useState(true)

  const [
    loadError,
    setLoadError,
  ] =
    useState<string | null>(null)

  useEffect(() => {
    let isCancelled = false

    let objectUrl:
      string | null = null

    let modelViewer:
      HTMLElement | null = null

    setIsLoading(true)
    setLoadError(null)

    async function loadModel() {
      let sourceUrl =
        attachment.previewUrl ??
        null

      if (!sourceUrl) {
        const blob =
          await onLoadAttachment(
            attachment,
          )

        if (!blob) {
          throw new Error(
            'The 3D model could not be loaded.',
          )
        }

        if (isCancelled) {
          return
        }

        const glbBlob =
          blob.type ===
            'model/gltf-binary'
            ? blob
            : new Blob(
              [blob],
              {
                type:
                  'model/gltf-binary',
              },
            )

        objectUrl =
          URL.createObjectURL(
            glbBlob,
          )

        sourceUrl =
          objectUrl
      }

      if (isCancelled) {
        return
      }

      modelViewer =
        document.createElement(
          'model-viewer',
        )

      modelViewer.className =
        'glb-preview__viewer'

      modelViewer.setAttribute(
        'src',
        sourceUrl,
      )

      modelViewer.setAttribute(
        'alt',
        attachment.fileName,
      )

      modelViewer.setAttribute(
        'camera-controls',
        '',
      )

      modelViewer.setAttribute(
        'auto-rotate',
        '',
      )

      modelViewer.setAttribute(
        'shadow-intensity',
        '1',
      )

      modelViewer.addEventListener(
        'load',
        () => {
          if (!isCancelled) {
            setIsLoading(false)
          }
        },
      )

      modelViewer.addEventListener(
        'error',
        () => {
          if (!isCancelled) {
            setIsLoading(false)

            setLoadError(
              'The GLB model could not be displayed.',
            )
          }
        },
      )

      viewerContainerRef
        .current
        ?.replaceChildren(
          modelViewer,
        )
    }

    void loadModel().catch(
      (error) => {
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
      },
    )

    return () => {
      isCancelled = true

      modelViewer?.remove()

      if (objectUrl) {
        URL.revokeObjectURL(
          objectUrl,
        )
      }
    }
  }, [
    attachment,
    onLoadAttachment,
  ])

  return (
    <div
      className="glb-preview"
      onPointerDown={(event) =>
        event.stopPropagation()
      }
    >
      <div className="glb-preview__header">
        <strong>
          {attachment.fileName}
        </strong>

        <button
          type="button"
          onClick={onClose}
        >
          Close
        </button>
      </div>

      {isLoading && (
        <div className="glb-preview__status">
          Loading 3D model…
        </div>
      )}

      {loadError && (
        <div className="glb-preview__status">
          {loadError}
        </div>
      )}

      <div
        ref={viewerContainerRef}
        className="glb-preview__container"
      />
    </div>
  )
}