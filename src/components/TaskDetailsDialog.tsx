import {
    useEffect,
} from 'react'
import type {
    BoardColumn,
    DemoUser,
    Task,
} from '../types/board'
import {
    getAttachmentTypeLabel,
    getAttachmentProcessingLabel,
} from '../utility/attachmentTypes'

interface TaskDetailsDialogProps {
    task: Task | null
    members: DemoUser[]
    columns: BoardColumn[]
    onClose: () => void
}

function formatDateTime(
    dateValue: string,
) {
    return new Date(
        dateValue,
    ).toLocaleString(
        'en-US',
        {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
        },
    )
}

function formatDeadline(
    deadline: string,
) {
    return new Date(
        `${deadline}T00:00:00`,
    ).toLocaleDateString(
        'en-US',
        {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        },
    )
}

export function TaskDetailsDialog({
    task,
    members,
    columns,
    onClose,
}: TaskDetailsDialogProps) {
    useEffect(() => {
        if (!task) {
            return
        }

        function handleKeyDown(
            event: KeyboardEvent,
        ) {
            if (event.key === 'Escape') {
                onClose()
            }
        }

        const previousOverflow =
            document.body.style.overflow

        document.body.style.overflow =
            'hidden'

        window.addEventListener(
            'keydown',
            handleKeyDown,
        )

        return () => {
            document.body.style.overflow =
                previousOverflow

            window.removeEventListener(
                'keydown',
                handleKeyDown,
            )
        }
    }, [
        task,
        onClose,
    ])

    if (!task) {
        return null
    }

    const assignee =
        members.find(
            (member) =>
                member.id === task.assigneeId,
        ) ?? null

    const column =
        columns.find(
            (column) =>
                column.id === task.columnId,
        ) ?? null

    return (
        <div
            className="task-details-backdrop"
            onMouseDown={(event) => {
                if (
                    event.target ===
                    event.currentTarget
                ) {
                    onClose()
                }
            }}
        >
            <section
                className="task-details-dialog"
                role="dialog"
                aria-modal="true"
                aria-labelledby="task-details-title"
            >
                <header className="task-details-dialog__header">
                    <div>
                        <p className="task-details-dialog__section">
                            {column?.title ??
                                'Unknown section'}
                        </p>

                        <h2 id="task-details-title">
                            {task.title}
                        </h2>
                    </div>

                    <button
                        type="button"
                        className="task-details-dialog__close"
                        onClick={onClose}
                        aria-label="Close task details"
                    >
                        ×
                    </button>
                </header>

                <div className="task-details-dialog__metadata">
                    <div>
                        <span>Priority</span>

                        <strong
                            className={`timeline-item__priority timeline-item__priority--${task.priority}`}
                        >
                            {task.priority}
                        </strong>
                    </div>

                    <div>
                        <span>Deadline</span>

                        <strong>
                            {task.deadline
                                ? formatDeadline(
                                    task.deadline,
                                )
                                : 'No deadline'}
                        </strong>
                    </div>

                    <div>
                        <span>Assignee</span>

                        <strong>
                            {assignee?.displayName ??
                                'Unassigned'}
                        </strong>
                    </div>

                    <div>
                        <span>Status</span>

                        <strong>
                            {column?.countsAsCompleted
                                ? 'Completed'
                                : column?.title ??
                                'Unknown'}
                        </strong>
                    </div>
                </div>

                <div className="task-details-dialog__section-block">
                    <h3>Description</h3>

                    <p>
                        {task.description.trim()
                            ? task.description
                            : 'No description.'}
                    </p>
                </div>

                <div className="task-details-dialog__section-block">
                    <h3>Tags</h3>

                    {(task.tags?.length ?? 0) >
                        0 ? (
                        <div className="task-details-dialog__tags">
                            {task.tags?.map(
                                (tag) => (
                                    <span
                                        key={tag}
                                        className="task-card__tag"
                                    >
                                        #{tag}
                                    </span>
                                ),
                            )}
                        </div>
                    ) : (
                        <p>No tags.</p>
                    )}
                </div>

                <div className="task-details-dialog__section-block">
                    <h3>
                        Attachments ({task.attachments.length})
                    </h3>

                    {task.attachments.length >
                        0 ? (
                        <div className="task-details-dialog__attachments">
                            {task.attachments.map(
                                (attachment) => (
                                    <div
                                        key={attachment.id}
                                        className="task-details-dialog__attachment"
                                    >
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
                                ),
                            )}
                        </div>
                    ) : (
                        <p>No attachments.</p>
                    )}
                </div>

                <footer className="task-details-dialog__footer">
                    <span>
                        Created{' '}
                        {formatDateTime(
                            task.createdAt,
                        )}
                    </span>

                    <span>
                        Updated{' '}
                        {formatDateTime(
                            task.updatedAt,
                        )}
                    </span>

                    {task.completedAt && (
                        <span>
                            Completed{' '}
                            {formatDateTime(
                                task.completedAt,
                            )}
                        </span>
                    )}
                </footer>
            </section>
        </div>
    )
}