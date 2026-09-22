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

  const imageAttachments =
    task.attachments
      .filter(
        (attachment) =>
          attachment.mimeType.startsWith('image/'),
      )
      .reverse()

  const imageAttachmentIds =
    imageAttachments
      .map((attachment) => attachment.id)
      .join('|')

  const [currentImageIndex, setCurrentImageIndex] =
    useState(0)

  const imageAttachment =
    imageAttachments[currentImageIndex] ?? null

  const [imagePreviewUrl, setImagePreviewUrl] =
    useState<string | null>(
      imageAttachment?.previewUrl ?? null,
    )

  const [imageLoadError, setImageLoadError] =
    useState(false)

  useEffect(() => {
    setCurrentImageIndex(0)
  }, [
    task.id,
    imageAttachmentIds,
  ])

  useEffect(() => {
    setImageLoadError(false)

    if (!imageAttachment) {
      setImagePreviewUrl(null)
      return
    }

    if (imageAttachment.previewUrl) {
      setImagePreviewUrl(
        imageAttachment.previewUrl,
      )
      return
    }

    if (!imageAttachment.driveFileId) {
      setImagePreviewUrl(null)
      setImageLoadError(true)
      return
    }

    setImagePreviewUrl(null)

    let isCancelled = false
    let objectUrl: string | null = null

    void onLoadAttachment(
      imageAttachment,
    )
      .then((blob) => {
        if (!blob || isCancelled) {
          return
        }

        objectUrl =
          URL.createObjectURL(blob)

        setImagePreviewUrl(objectUrl)
      })
      .catch((error) => {
        if (isCancelled) {
          return
        }

        setImageLoadError(true)

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
    imageAttachment,
    onLoadAttachment,
  ])

  const { ref } = useDraggable({
    id: task.id,
    disabled:
      !isTaskEditing ||
      isPipelineEditing,
  })

  const hasMultipleImages =
    imageAttachments.length > 1

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

      {imageAttachment && (
        <div className="task-card__attachment">
          <div className="task-card__attachment-frame">
            {imagePreviewUrl ? (
              <img
                src={imagePreviewUrl}
                alt={imageAttachment.fileName}
              />
            ) : (
              <div className="task-card__attachment-placeholder">
                {imageLoadError
                  ? 'Media unavailable'
                  : 'Loading media…'}
              </div>
            )}

            {hasMultipleImages && (
              <div className="task-card__attachment-controls">
                <button
                  type="button"
                  className="task-card__attachment-arrow"
                  aria-label="Show newer attachment"
                  disabled={currentImageIndex === 0}
                  onPointerDown={(event) =>
                    event.stopPropagation()
                  }
                  onClick={() =>
                    setCurrentImageIndex(
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
                    currentImageIndex ===
                    imageAttachments.length - 1
                  }
                  onPointerDown={(event) =>
                    event.stopPropagation()
                  }
                  onClick={() =>
                    setCurrentImageIndex(
                      (currentIndex) =>
                        Math.min(
                          imageAttachments.length - 1,
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

          {hasMultipleImages && (
            <div className="task-card__attachment-indicators">
              {imageAttachments.map(
                (attachment, index) => (
                  <button
                    key={attachment.id}
                    type="button"
                    className={`task-card__attachment-indicator ${index === currentImageIndex
                      ? 'task-card__attachment-indicator--active'
                      : ''
                      }`}
                    aria-label={`Show ${attachment.fileName}`}
                    aria-pressed={
                      index === currentImageIndex
                    }
                    title={attachment.fileName}
                    onPointerDown={(event) =>
                      event.stopPropagation()
                    }
                    onClick={() =>
                      setCurrentImageIndex(index)
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