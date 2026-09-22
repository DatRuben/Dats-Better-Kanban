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

function isSupportedMedia(
  mimeType: string,
) {
  return (
    mimeType.startsWith('image/') ||
    mimeType === 'video/mp4'
  )
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
}: TaskCardProps) {
  const assigneeInitials = assignee
    ? getInitials(assignee.displayName)
    : '?'

  const mediaAttachments =
    task.attachments
      .filter(
        (attachment) =>
          isSupportedMedia(
            attachment.mimeType,
          ),
      )
      .reverse()

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
        <p
          className={`task-card__priority task-card__priority--${task.priority}`}
        >
          {task.priority}
        </p>

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

      <div className="task-card__footer">
        <div
          className="task-card__assignee"
          title={assignee?.displayName ?? 'Unassigned'}
        >
          {assigneeInitials}
        </div>

        {isTaskEditing && !isPipelineEditing && (
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
            {isEditing ? 'Editing' : 'Edit'}
          </button>
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
    </article>
  )
}