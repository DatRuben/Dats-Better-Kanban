import {
  useEffect,
  useState,
} from 'react'
import { useDraggable } from '@dnd-kit/react'
import type {
  Attachment,
  DemoUser,
  Task,
} from '../types/board'
import {
  getAttachmentTypeLabel,
  isGlbFileName,
  isPreviewableMedia,
} from '../utility/attachmentTypes'
import {
  GlbPreview,
} from './GlbPreview'


interface TaskCardProps {
  task: Task
  assignee: DemoUser | null
  taskNumber: number
  isPipelineEditing: boolean
  isEditing: boolean
  onEdit: () => void
  onLoadAttachment: (
    attachment: Attachment,
  ) => Promise<Blob | null>
  isTaskEditing: boolean
  canMoveManualUp: boolean
  canMoveManualDown: boolean
  onMoveManualUp: () => void
  onMoveManualDown: () => void
  hidePriority?: boolean
}

function getInitials(displayName: string) {
  const nameParts = displayName.trim().split(/\s+/)

  const firstInitial = nameParts[0]?.[0] ?? ''
  const lastInitial =
    nameParts.length > 1
      ? nameParts[nameParts.length - 1]?.[0] ?? ''
      : ''

  return `${firstInitial}${lastInitial}`.toUpperCase()
}

export function TaskCard({
  task,
  assignee,
  taskNumber,
  isPipelineEditing,
  isEditing,
  onEdit,
  onLoadAttachment,
  isTaskEditing,
  canMoveManualUp,
  canMoveManualDown,
  onMoveManualUp,
  onMoveManualDown,
  hidePriority = false,
}: TaskCardProps) {
  const assigneeInitials = assignee
    ? getInitials(assignee.displayName)
    : '?'

  const mediaAttachments =
    task.attachments
      .filter(
        (attachment) =>
          isPreviewableMedia(
            attachment.mimeType,
          ),
      )
      .reverse()

  const [
    previewedGlbId,
    setPreviewedGlbId,
  ] =
    useState<string | null>(null)

  const fileAttachments =
    task.attachments.filter(
      (attachment) =>
        !isPreviewableMedia(
          attachment.mimeType,
        ),
    )

  const previewedGlb =
    fileAttachments.find(
      (attachment) =>
        attachment.id ===
        previewedGlbId &&
        isGlbFileName(
          attachment.fileName,
        ),
    ) ?? null

  const mediaAttachmentIds =
    mediaAttachments
      .map((attachment) => attachment.id)
      .join('|')

  const [currentMediaIndex, setcurrentMediaIndex] =
    useState(0)

  const mediaAttachment =
    mediaAttachments[currentMediaIndex] ?? null

  const [mediaPreviewUrl, setmediaPreviewUrl] =
    useState<string | null>(
      mediaAttachment?.previewUrl ?? null,
    )

  const [mediaLoadError, setmediaLoadError] =
    useState(false)

  useEffect(() => {
    setcurrentMediaIndex(0)
  }, [
    task.id,
    mediaAttachmentIds,
  ])

  useEffect(() => {
    setmediaLoadError(false)

    if (!mediaAttachment) {
      setmediaPreviewUrl(null)
      return
    }

    if (mediaAttachment.previewUrl) {
      setmediaPreviewUrl(
        mediaAttachment.previewUrl,
      )
      return
    }

    if (!mediaAttachment.driveFileId) {
      setmediaPreviewUrl(null)
      setmediaLoadError(true)
      return
    }

    setmediaPreviewUrl(null)

    let isCancelled = false
    let objectUrl: string | null = null

    void onLoadAttachment(
      mediaAttachment,
    )
      .then((blob) => {
        if (!blob || isCancelled) {
          return
        }

        objectUrl =
          URL.createObjectURL(blob)

        setmediaPreviewUrl(objectUrl)
      })
      .catch((error) => {
        if (isCancelled) {
          return
        }

        setmediaLoadError(true)

        console.error(
          'Failed to load attachment preview:',
          error,
        )
      })

    return () => {
      isCancelled = true

      if (objectUrl) {
        URL.revokeObjectURL(objectUrl)
      }
    }
  }, [
    mediaAttachment,
    onLoadAttachment,
  ])

  const { ref } = useDraggable({
    id: task.id,
    disabled:
      !isTaskEditing ||
      isPipelineEditing,
  })

  const hasMultipleMedia =
    mediaAttachments.length > 1

  const isVideo =
    mediaAttachment?.mimeType === 'video/mp4'

  return (
    <article
      ref={ref}
      className="task-card"
    >
      <div className="task-card__top">
        {!hidePriority && (
          <p
            className={`task-card__priority task-card__priority--${task.priority}`}
          >
            {task.priority}
          </p>
        )}

        <div className="task-card__ranking">
          <p className="task-card__number">
            {taskNumber}
          </p>

          <p className="task-card__deadline">
            {task.deadline ?? 'No deadline'}
          </p>
        </div>
      </div>

      <h3>{task.title}</h3>

      <p className="task-card__description">
        {task.description}
      </p>

      {(task.tags?.length ?? 0) > 0 && (
        <div className="task-card__tags">
          {task.tags?.map((tag) => (
            <span
              key={tag}
              className="task-card__tag"
            >
              #{tag}
            </span>
          ))}
        </div>
      )}

      <div className="task-card__footer">
        <div
          className="task-card__assignee"
          title={assignee?.displayName ?? 'Unassigned'}
        >
          {assigneeInitials}
        </div>

        {isTaskEditing &&
          !isPipelineEditing && (
            <div className="task-card__edit-controls">
              {(
                canMoveManualUp ||
                canMoveManualDown
              ) && (
                  <div className="task-card__manual-order">
                    <button
                      type="button"
                      disabled={!canMoveManualUp}
                      title="Move task up"
                      aria-label="Move task up"
                      onPointerDown={(event) =>
                        event.stopPropagation()
                      }
                      onClick={onMoveManualUp}
                    >
                      ↑
                    </button>

                    <button
                      type="button"
                      disabled={!canMoveManualDown}
                      title="Move task down"
                      aria-label="Move task down"
                      onPointerDown={(event) =>
                        event.stopPropagation()
                      }
                      onClick={onMoveManualDown}
                    >
                      ↓
                    </button>
                  </div>
                )}

              <button
                type="button"
                className={`task-card__edit-button ${isEditing
                  ? 'task-card__edit-button--active'
                  : ''
                  }`}
                onPointerDown={(event) =>
                  event.stopPropagation()
                }
                onClick={onEdit}
              >
                {isEditing
                  ? 'Editing'
                  : 'Edit'}
              </button>
            </div>
          )}
      </div>

      {mediaAttachment && (
        <div className="task-card__attachment">
          <div className="task-card__attachment-frame">
            {mediaPreviewUrl ? (
              isVideo ? (
                <video
                  src={mediaPreviewUrl}
                  controls
                  playsInline
                  preload="metadata"
                  onPointerDown={(event) =>
                    event.stopPropagation()
                  }
                />
              ) : (
                <img
                  src={mediaPreviewUrl}
                  alt={mediaAttachment.fileName}
                />
              )
            ) : (
              <div className="task-card__attachment-placeholder">
                {mediaLoadError
                  ? 'Media unavailable'
                  : 'Loading media…'}
              </div>
            )}

            {hasMultipleMedia && (
              <div className="task-card__attachment-controls">
                <button
                  type="button"
                  className="task-card__attachment-arrow"
                  aria-label="Show newer attachment"
                  disabled={currentMediaIndex === 0}
                  onPointerDown={(event) =>
                    event.stopPropagation()
                  }
                  onClick={() =>
                    setcurrentMediaIndex(
                      (currentIndex) =>
                        Math.max(
                          0,
                          currentIndex - 1,
                        ),
                    )
                  }
                >
                  {'<'}
                </button>

                <button
                  type="button"
                  className="task-card__attachment-arrow"
                  aria-label="Show older attachment"
                  disabled={
                    currentMediaIndex ===
                    mediaAttachments.length - 1
                  }
                  onPointerDown={(event) =>
                    event.stopPropagation()
                  }
                  onClick={() =>
                    setcurrentMediaIndex(
                      (currentIndex) =>
                        Math.min(
                          mediaAttachments.length - 1,
                          currentIndex + 1,
                        ),
                    )
                  }
                >
                  {'>'}
                </button>
              </div>
            )}
          </div>

          {hasMultipleMedia && (
            <div className="task-card__attachment-indicators">
              {mediaAttachments.map(
                (attachment, index) => (
                  <button
                    key={attachment.id}
                    type="button"
                    className={`task-card__attachment-indicator ${index === currentMediaIndex
                      ? 'task-card__attachment-indicator--active'
                      : ''
                      }`}
                    aria-label={`Show ${attachment.fileName}`}
                    aria-pressed={
                      index === currentMediaIndex
                    }
                    title={attachment.fileName}
                    onPointerDown={(event) =>
                      event.stopPropagation()
                    }
                    onClick={() =>
                      setcurrentMediaIndex(index)
                    }
                  />
                ),
              )}
            </div>
          )}
        </div>
      )}

      {fileAttachments.length > 0 && (
        <div className="task-card__files">
          {fileAttachments.map(
            (attachment) => {
              const isGlb =
                isGlbFileName(
                  attachment.fileName,
                )

              const isPreviewOpen =
                previewedGlbId ===
                attachment.id

              return (
                <div
                  key={attachment.id}
                  className="task-card__file-entry"
                >
                  <div
                    className="task-card__file"
                    title={
                      attachment.fileName
                    }
                  >
                    <div className="task-card__file-info">
                      <strong>
                        {
                          attachment.fileName
                        }
                      </strong>

                      <span>
                        {getAttachmentTypeLabel(
                          attachment.fileName,
                          attachment.mimeType,
                        )}
                      </span>
                    </div>

                    {isGlb && (
                      <button
                        type="button"
                        className="task-card__file-action"
                        onPointerDown={
                          (event) =>
                            event.stopPropagation()
                        }
                        onClick={() =>
                          setPreviewedGlbId(
                            isPreviewOpen
                              ? null
                              : attachment.id,
                          )
                        }
                      >
                        {isPreviewOpen
                          ? 'Close'
                          : 'Preview 3D'}
                      </button>
                    )}
                  </div>

                  {isPreviewOpen &&
                    previewedGlb && (
                      <GlbPreview
                        attachment={
                          previewedGlb
                        }
                        onLoadAttachment={
                          onLoadAttachment
                        }
                        onClose={() =>
                          setPreviewedGlbId(
                            null,
                          )
                        }
                      />
                    )}
                </div>
              )
            },
          )}
        </div>
      )}
    </article>
  )
}