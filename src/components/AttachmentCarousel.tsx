
import {
    lazy,
    Suspense,
    useEffect,
    useState,
} from 'react'
import type {
    Attachment,
} from '../types/board'
import {
    isGlbFileName,
    isPreviewableMedia,
} from '../utility/attachmentTypes'
import {
    isLikelyAttachmentAccessError,
} from '../storage/attachmentAuthorization'

const GlbPreview = lazy(async () => {
    const module = await import('./GlbPreview')

    return {
        default: module.GlbPreview,
    }
})

type AttachmentLoader = (
    driveFileId: string,
) => Promise<Blob | null>

interface AttachmentCarouselProps {
    attachments: Attachment[]
    onLoadAttachment: AttachmentLoader
    onAuthorizeAttachment: (
        attachment: Attachment,
    ) => void
}

interface LoadedMedia {
    fileId: string
    loader: AttachmentLoader
    url: string | null
    error: string | null
}

interface AttachmentSlideProps {
    attachment: Attachment
    onLoadAttachment: AttachmentLoader
    onAuthorizeAttachment: (
        attachment: Attachment,
    ) => void
    onCloseModel: () => void
    onRetry: () => void
}



function AttachmentSlide({
    attachment,
    onLoadAttachment,
    onAuthorizeAttachment,
    onCloseModel,
    onRetry,
}: AttachmentSlideProps) {
    const [loadedMedia, setLoadedMedia] =
        useState<LoadedMedia | null>(null)

    const isGlb =
        isGlbFileName(attachment.fileName)

    const fileId =
        attachment.driveFileId ?? null

    const previewUrl =
        attachment.previewUrl ?? null

    useEffect(() => {
        if (
            isGlb ||
            previewUrl ||
            !fileId
        ) {
            return
        }

        let cancelled = false
        let objectUrl: string | null = null

        void onLoadAttachment(fileId)
            .then((blob) => {
                if (cancelled) {
                    return
                }

                if (!blob) {
                    setLoadedMedia({
                        fileId,
                        loader: onLoadAttachment,
                        url: null,
                        error: 'No attachment data was returned.',
                    })

                    return
                }

                objectUrl =
                    URL.createObjectURL(blob)

                setLoadedMedia({
                    fileId,
                    loader: onLoadAttachment,
                    url: objectUrl,
                    error: null,
                })
            })
            .catch((error: unknown) => {
                if (cancelled) {
                    return
                }

                setLoadedMedia({
                    fileId,
                    loader: onLoadAttachment,
                    url: null,
                    error:
                        error instanceof Error
                            ? error.message
                            : 'Attachment download failed.',
                })
            })

        return () => {
            cancelled = true

            if (objectUrl) {
                URL.revokeObjectURL(objectUrl)
            }
        }
    }, [
        attachment.id,
        fileId,
        isGlb,
        previewUrl,
        onLoadAttachment,
    ])

    if (isGlb) {
        return (
            <Suspense
                fallback={
                    <div className="task-card__attachment-placeholder">
                        Loading 3D viewer…
                    </div>
                }
            >
                <GlbPreview
                    attachment={attachment}
                    onLoadAttachment={onLoadAttachment}
                    onClose={onCloseModel}
                    onAuthorizeAttachment={() =>
                        onAuthorizeAttachment(attachment)
                    }
                    embedded
                    onRetry={onRetry}
                />
            </Suspense>
        )
    }

    const resultIsCurrent =
        loadedMedia !== null &&
        loadedMedia.fileId === fileId &&
        loadedMedia.loader === onLoadAttachment

    const sourceUrl =
        previewUrl ??
        (
            resultIsCurrent
                ? loadedMedia.url
                : null
        )

    const error =
        !previewUrl && !fileId
            ? 'This attachment has no Google Drive file reference.'
            : resultIsCurrent
                ? loadedMedia.error
                : null

    const isVideo =
        attachment.mimeType === 'video/mp4'

    return (
        <>
            {sourceUrl ? (
                isVideo ? (
                    <video
                        src={sourceUrl}
                        controls
                        playsInline
                        preload="metadata"
                        onPointerDown={(event) =>
                            event.stopPropagation()
                        }
                    />
                ) : (
                    <img
                        src={sourceUrl}
                        alt={attachment.fileName}
                    />
                )
            ) : (
                <div className="task-card__attachment-placeholder">
                    {error
                        ? 'Media unavailable'
                        : 'Loading media…'}
                </div>
            )}

            {error && (
                <details
                    className="task-card__attachment-error"
                >
                    <summary>
                        Why is this attachment unavailable?
                    </summary>

                    <p>{error}</p>

                    {fileId && (
                        <button
                            type="button"
                            className="task-card__file-action"
                            onClick={onRetry}
                        >
                            Retry Preview
                        </button>
                    )}

                    {fileId &&
                        isLikelyAttachmentAccessError(error) && (
                            <button
                                type="button"
                                className="task-card__file-action"
                                onClick={() =>
                                    onAuthorizeAttachment(attachment)
                                }
                            >
                                Check / Authorize File
                            </button>
                        )}
                </details>
            )}
        </>
    )
}

export function AttachmentCarousel({
    attachments,
    onLoadAttachment,
    onAuthorizeAttachment,
}: AttachmentCarouselProps) {
    const [selectedAttachmentId, setSelectedAttachmentId] =
        useState<string | null>(null)

    const [retryRevision, setRetryRevision] =
        useState(0)

    const mediaAttachments = attachments
        .filter(
            (attachment) =>
                isPreviewableMedia(attachment.mimeType) ||
                isGlbFileName(attachment.fileName),
        )
        .reverse()

    const foundIndex = mediaAttachments.findIndex(
        (attachment) =>
            attachment.id === selectedAttachmentId,
    )

    const currentIndex =
        foundIndex >= 0 ? foundIndex : 0

    const selectedAttachment =
        mediaAttachments[currentIndex] ?? null

    if (!selectedAttachment) {
        return null
    }

    const hasMultipleAttachments =
        mediaAttachments.length > 1

    function selectIndex(index: number) {
        const nextAttachment =
            mediaAttachments[index]

        if (!nextAttachment) {
            return
        }

        setSelectedAttachmentId(
            nextAttachment.id,
        )
    }

    return (
        <div className="task-card__attachment">
            <div
                className="task-card__attachment-frame"
                onPointerDown={(event) =>
                    event.stopPropagation()
                }
            >
                <div className="task-card__attachment-slide">
                    <AttachmentSlide
                        key={`${selectedAttachment.id}:${retryRevision}`}
                        attachment={selectedAttachment}
                        onLoadAttachment={onLoadAttachment}
                        onAuthorizeAttachment={
                            onAuthorizeAttachment
                        }
                        onCloseModel={() =>
                            setSelectedAttachmentId(null)
                        }
                        onRetry={() =>
                            setRetryRevision(
                                (current) => current + 1,
                            )
                        }
                    />

                </div>

                {hasMultipleAttachments && (
                    <div className="task-card__attachment-controls">
                        <button
                            type="button"
                            className="task-card__attachment-arrow"
                            aria-label="Show previous attachment"
                            disabled={currentIndex === 0}
                            onClick={() =>
                                selectIndex(currentIndex - 1)
                            }
                        >
                            {'<'}
                        </button>

                        <button
                            type="button"
                            className="task-card__attachment-arrow"
                            aria-label="Show next attachment"
                            disabled={
                                currentIndex ===
                                mediaAttachments.length - 1
                            }
                            onClick={() =>
                                selectIndex(currentIndex + 1)
                            }
                        >
                            {'>'}
                        </button>
                    </div>
                )}
            </div>

            <div className="task-card__attachment-caption">
                <span title={selectedAttachment.fileName}>
                    {selectedAttachment.fileName}
                </span>

                <span>
                    {currentIndex + 1} / {mediaAttachments.length}
                </span>
            </div>

            {hasMultipleAttachments && (
                <div className="task-card__attachment-indicators">
                    {mediaAttachments.map(
                        (attachment, index) => (
                            <button
                                key={attachment.id}
                                type="button"
                                className={`task-card__attachment-indicator ${index === currentIndex
                                    ? 'task-card__attachment-indicator--active'
                                    : ''
                                    }`}
                                aria-label={`Show ${attachment.fileName}`}
                                aria-pressed={
                                    index === currentIndex
                                }
                                title={attachment.fileName}
                                onClick={() =>
                                    selectIndex(index)
                                }
                            />
                        ),
                    )}
                </div>
            )}
        </div>
    )
}
