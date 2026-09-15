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
}: TaskCardProps) {
  const assigneeInitials = assignee
    ? getInitials(assignee.displayName)
    : '?'

  const imageAttachment = task.attachments.find(
    (attachment) =>
      attachment.mimeType.startsWith('image/'),
  )

  const [imagePreviewUrl, setImagePreviewUrl] =
    useState<string | null>(
      imageAttachment?.previewUrl ?? null,
    )

  useEffect(() => {
    if (
      !imageAttachment ||
      imageAttachment.previewUrl ||
      !imageAttachment.driveFileId
    ) {
      setImagePreviewUrl(
        imageAttachment?.previewUrl ?? null,
      )

      return
    }

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
    disabled: isPipelineEditing,
  })

  return (
    <article
      ref={ref}
      className="task-card"
    >
      {!isPipelineEditing && (
        <button
          type="button"
          className={`task-card__edit-button ${isEditing
            ? 'task-card__edit-button--active'
            : ''
            }`}
          onClick={onEdit}
        >
          {isEditing ? 'Editing' : 'Edit'}
        </button>
      )}

      <div className="task-card__top">
        <p
          className={`task-card__priority task-card__priority--${task.priority}`}
        >
          {task.priority}
        </p>

        <div className="task-card__ranking">
          <p className="task-card__number">{taskNumber}</p>
          <p className="task-card__deadline">
            {task.deadline ?? 'No deadline'}
          </p>
        </div>
      </div>

      <h3>{task.title}</h3>

      <p className="task-card__description">
        {task.description}
      </p>

      <div
        className="task-card__assignee"
        title={assignee?.displayName ?? 'Unassigned'}
      >
        {assigneeInitials}
      </div>

      {imageAttachment && imagePreviewUrl && (
        <div className="task-card__attachment">
          <img
            src={imagePreviewUrl}
            alt={imageAttachment.fileName}
          />
        </div>
      )}
    </article>
  )
}