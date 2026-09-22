import { useState } from 'react'
import type { SubmitEvent } from 'react'
import type {
    Attachment,
    DemoUser,
    NewTaskInput,
    Priority,
    Task,
} from '../types/board'

interface TaskCreatorProps {
    columnTitle: string
    members: DemoUser[]
    initialTask?: Task
    onCreate: (task: NewTaskInput) => void
    onCancel: () => void
    onDelete?: () => void
    onUploadImage: (
        file: File,
    ) => Promise<Attachment>
}

function isSupportedMedia(
    mimeType: string,
) {
    return (
        mimeType.startsWith('image/') ||
        mimeType === 'video/mp4'
    )
}

export function TaskCreator({
    columnTitle,
    members,
    initialTask,
    onCreate,
    onCancel,
    onDelete,
    onUploadImage,
}: TaskCreatorProps) {
    const [title, setTitle] = useState(
        initialTask?.title ?? '',
    )

    const [description, setDescription] = useState(
        initialTask?.description ?? '',
    )

    const [priority, setPriority] = useState<Priority>(
        initialTask?.priority ?? 'medium',
    )

    const [assigneeId, setAssigneeId] = useState(
        initialTask?.assigneeId ?? '',
    )

    const [deadline, setDeadline] = useState(
        initialTask?.deadline ?? '',
    )

    const [imageFiles, setImageFiles] =
        useState<File[]>([])

    const [removedImageIds, setRemovedImageIds] =
        useState<string[]>([])

    const [isUploadingImage, setIsUploadingImage] =
        useState(false)

    const [imageUploadError, setImageUploadError] =
        useState<string | null>(null)

    const existingMedia =
        initialTask?.attachments.filter(
            (attachment) =>
                isSupportedMedia(
                    attachment.mimeType,
                ),
        ) ?? []

    async function handleSubmit(
        event: SubmitEvent<HTMLFormElement>,
    ) {
        event.preventDefault()

        const trimmedTitle = title.trim()

        if (!trimmedTitle || isUploadingImage) {
            return
        }

        let attachments =
            initialTask?.attachments ?? []

        if (removedImageIds.length > 0) {
            attachments =
                attachments.filter(
                    (attachment) =>
                        !removedImageIds.includes(
                            attachment.id,
                        ),
                )
        }

        try {
            setImageUploadError(null)

            if (imageFiles.length > 0) {
                setIsUploadingImage(true)

                const uploadedAttachments =
                    await Promise.all(
                        imageFiles.map((file) =>
                            onUploadImage(file),
                        ),
                    )

                attachments = [
                    ...attachments,
                    ...uploadedAttachments,
                ]
            }
            onCreate({
                title: trimmedTitle,
                description: description.trim(),
                priority,
                assigneeId: assigneeId || null,
                deadline: deadline || null,
                attachments,
            })
        } catch (error) {
            setImageUploadError(
                error instanceof Error
                    ? error.message
                    : 'Image upload failed.',
            )
        } finally {
            setIsUploadingImage(false)
        }
    }

    return (
        <form
            className="task-creator"
            onSubmit={handleSubmit}
        >
            <div className="task-creator__header">
                <div>
                    <p className="task-creator__heading">
                        {initialTask ? 'Edit task' : 'New task'}
                    </p>

                    <p className="task-creator__hint">
                        {initialTask
                            ? `Editing in ${columnTitle}`
                            : `Creating in ${columnTitle}`}
                    </p>
                </div>
            </div>
            <label className="task-creator__field">
                <span>Title</span>

                <input
                    type="text"
                    value={title}
                    placeholder="Task title"
                    autoFocus
                    onChange={(event) =>
                        setTitle(event.target.value)
                    }
                />
            </label>

            <label className="task-creator__field">
                <span>Description</span>

                <textarea
                    value={description}
                    placeholder="What needs to be done?"
                    rows={3}
                    onChange={(event) =>
                        setDescription(event.target.value)
                    }
                />
            </label>

            <div className="task-creator__field-row">
                <label className="task-creator__field">
                    <span>Priority</span>

                    <select
                        value={priority}
                        onChange={(event) =>
                            setPriority(
                                event.target.value as Priority,
                            )
                        }
                    >
                        <option value="critical">Critical</option>
                        <option value="high">High</option>
                        <option value="medium">Medium</option>
                        <option value="low">Low</option>
                    </select>
                </label>

                <label className="task-creator__field">
                    <span>Deadline</span>

                    <input
                        type="date"
                        value={deadline}
                        onChange={(event) =>
                            setDeadline(event.target.value)
                        }
                    />
                </label>
            </div>

            <label className="task-creator__field">
                <span>Assignee</span>

                <select
                    value={assigneeId}
                    onChange={(event) =>
                        setAssigneeId(event.target.value)
                    }
                >
                    <option value="">Unassigned</option>

                    {members.map((member) => (
                        <option
                            key={member.id}
                            value={member.id}
                        >
                            {member.displayName}
                        </option>
                    ))}
                </select>
            </label>

            <div className="task-creator__field">
                <span>Images / GIFs / MP4s</span>

                {existingMedia.length > 0 && (
                    <div>
                        <small>
                            Current attachments
                        </small>

                        {existingMedia.map((attachment) => {
                            const isRemoved =
                                removedImageIds.includes(
                                    attachment.id,
                                )

                            return (
                                <div key={attachment.id}>
                                    <small>
                                        {attachment.fileName}
                                    </small>

                                    {isRemoved ? (
                                        <>
                                            <small>
                                                {' '}
                                                — will be removed
                                                when you save
                                            </small>

                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setRemovedImageIds(
                                                        (currentIds) =>
                                                            currentIds.filter(
                                                                (id) =>
                                                                    id !==
                                                                    attachment.id,
                                                            ),
                                                    )
                                                }
                                            >
                                                Keep
                                            </button>
                                        </>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setRemovedImageIds(
                                                    (currentIds) => [
                                                        ...currentIds,
                                                        attachment.id,
                                                    ],
                                                )
                                            }
                                        >
                                            Remove
                                        </button>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                )}

                <input
                    type="file"
                    accept="image/*,video/mp4"
                    multiple
                    onChange={(event) => {
                        const selectedFiles =
                            Array.from(
                                event.target.files ?? [],
                            )

                        setImageFiles(selectedFiles)
                        setImageUploadError(null)
                    }}
                />

                {imageFiles.length > 0 && (
                    <div>
                        <small>
                            New attachments
                        </small>

                        {imageFiles.map((file, index) => (
                            <div
                                key={`${file.name}-${file.size}-${file.lastModified}`}
                            >
                                <small>
                                    {file.name}
                                </small>

                                <button
                                    type="button"
                                    onClick={() =>
                                        setImageFiles(
                                            (currentFiles) =>
                                                currentFiles.filter(
                                                    (_, currentIndex) =>
                                                        currentIndex !== index,
                                                ),
                                        )
                                    }
                                >
                                    Remove
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                {imageUploadError && (
                    <small>
                        {imageUploadError}
                    </small>
                )}
            </div>

            <div className="task-creator__actions">
                <div>
                    {initialTask && onDelete && (
                        <button
                            type="button"
                            className="task-creator__delete"
                            onClick={onDelete}
                        >
                            Delete
                        </button>
                    )}
                </div>

                <div className="task-creator__actions-right">
                    <button
                        type="button"
                        className="task-creator__cancel"
                        onClick={onCancel}
                        disabled={isUploadingImage}
                    >
                        Cancel
                    </button>

                    <button
                        type="submit"
                        className="task-creator__create"
                        disabled={
                            !title.trim() ||
                            isUploadingImage
                        }
                    >
                        {isUploadingImage
                            ? 'Uploading...'
                            : initialTask
                                ? 'Save Changes'
                                : 'Create Task'}
                    </button>
                </div>
            </div>
        </form>
    )
}