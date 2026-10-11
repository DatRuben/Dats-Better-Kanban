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
  AttachmentCarousel,
} from './AttachmentCarousel'
import {
  AttachmentDownloadButton,
} from './AttachmentDownloadButton'

interface TaskCardProps {
  task: Task
  assignee: DemoUser | null
  taskNumber: number
  isPipelineEditing: boolean
  isEditing: boolean
  onEdit: () => void
  onLoadAttachment: (
    driveFileId: string,
  ) => Promise<Blob | null>
  isTaskEditing: boolean
  canMoveManualUp: boolean
  canMoveManualDown: boolean
  onMoveManualUp: () => void
  onMoveManualDown: () => void
  hidePriority?: boolean
  onAuthorizeAttachment: (
    attachment: Attachment,
  ) => void
}

function getInitials(displayName: string) {
  const nameParts =
    displayName.trim().split(/\s+/)

  const firstInitial =
    nameParts[0]?.[0] ?? ''

  const lastInitial =
    nameParts.length > 1
      ? nameParts[nameParts.length - 1]?.[0] ?? ''
      : ''

  return (
    `${firstInitial}${lastInitial}`
      .toUpperCase()
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
  canMoveManualUp,
  canMoveManualDown,
  onMoveManualUp,
  onMoveManualDown,
  hidePriority = false,
  onAuthorizeAttachment,
}: TaskCardProps) {
  const assigneeInitials =
    assignee
      ? getInitials(assignee.displayName)
      : '?'

  // Files without browser previews stay listed.
  // GLBs are now handled by AttachmentCarousel.
  const fileAttachments =
    task.attachments.filter(
      (attachment) =>
        !isPreviewableMedia(attachment.mimeType) &&
        !isGlbFileName(attachment.fileName),
    )

  const { ref } = useDraggable({
    id: task.id,
    disabled:
      !isTaskEditing ||
      isPipelineEditing,
  })

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
              {tag}
            </span>
          ))}
        </div>
      )}

      <div className="task-card__footer">
        <div
          className="task-card__assignee"
          title={
            assignee?.displayName ??
            'Unassigned'
          }
        >
          {assigneeInitials}
        </div>

        {isTaskEditing &&
          !isPipelineEditing && (
            <div className="task-card__edit-controls">
              {(canMoveManualUp ||
                canMoveManualDown) && (
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

      <AttachmentCarousel
        attachments={task.attachments}
        onLoadAttachment={onLoadAttachment}
        onAuthorizeAttachment={
          onAuthorizeAttachment
        }
      />

      {fileAttachments.length > 0 && (
        <div className="task-card__files">
          {fileAttachments.map(
            (attachment) => (
              <div
                key={attachment.id}
                className="task-card__file-entry"
              >
                <div
                  className="task-card__file"
                  title={attachment.fileName}
                >
                  <div className="task-card__file-info">
                    <strong>
                      {attachment.fileName}
                    </strong>

                    <span>
                      {getAttachmentTypeLabel(
                        attachment.fileName,
                        attachment.mimeType,
                      )}
                    </span>
                  </div>
                  <AttachmentDownloadButton
                    attachment={attachment}
                    onLoadAttachment={onLoadAttachment}
                    onAuthorizeAttachment={
                      onAuthorizeAttachment
                    }
                  />
                </div>
              </div>
            ),
          )}
        </div>
      )}
    </article>
  )
}
