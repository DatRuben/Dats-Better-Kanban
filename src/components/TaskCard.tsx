import { useDraggable } from '@dnd-kit/react'
import type { DemoUser, Task } from '../types/board'

interface TaskCardProps {
  task: Task
  assignee: DemoUser | null
  taskNumber: number
  isPipelineEditing: boolean
  isEditing: boolean
  onEdit: () => void
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
}: TaskCardProps) {
  const assigneeInitials = assignee
    ? getInitials(assignee.displayName)
    : '?'

  const imageAttachment = task.attachments.find(
    (attachment) =>
      attachment.mimeType.startsWith('image/'),
  )

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

      {imageAttachment && (
        <div className="task-card__attachment">
          <img
            src={imageAttachment.previewUrl}
            alt={imageAttachment.fileName}
          />
        </div>
      )}
    </article>
  )
}