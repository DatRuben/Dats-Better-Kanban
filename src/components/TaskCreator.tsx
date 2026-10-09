import { useState } from 'react'
import type { SubmitEvent } from 'react'
import type {
    Attachment,
    DemoUser,
    NewTaskInput,
    Priority,
    Task,
} from '../types/board'
import {
    isSupportedAttachmentFile,
} from '../utility/attachmentTypes'

interface TaskCreatorProps {
    columnTitle: string
    members: DemoUser[]
    initialTask?: Task
    onCreate: (task: NewTaskInput) => void
    onCancel: () => void
    onDelete?: () => void
    onUploadAttachments: (
        files: File[],
    ) => Promise<Attachment[]>
}

export function TaskCreator({
    columnTitle,
    members,
    initialTask,
    onCreate,
    onCancel,
    onDelete,
    onUploadAttachments,
}: TaskCreatorProps) {
    const [title, setTitle] = useState(
        initialTask?.title ?? '',
    )

    const [description, setDescription] =
        useState(
            initialTask?.description ?? '',
        )

    const [priority, setPriority] =
        useState<Priority>(
            initialTask?.priority ??
            'medium',
        )

    const [assigneeId, setAssigneeId] =
        useState(
            initialTask?.assigneeId ?? '',
        )

    const [deadline, setDeadline] =
        useState(
            initialTask?.deadline ?? '',
        )

    const [tags, setTags] =
        useState<string[]>(
            initialTask?.tags ?? [],
        )

    const [tagInput, setTagInput] =
        useState('')

    const [
        attachmentFiles,
        setAttachmentFiles,
    ] = useState<File[]>([])

    const [
        removedAttachmentIds,
        setRemovedAttachmentIds,
    ] = useState<string[]>([])

    const [
        isUploadingAttachment,
        setIsUploadingAttachment,
    ] = useState(false)

    const [
        attachmentUploadError,
        setAttachmentUploadError,
    ] = useState<string | null>(null)

    const existingAttachments =
        initialTask?.attachments ?? []

    function handleAddTag() {
        const normalizedTag =
            tagInput
                .trim()
                .replace(/^#+/, '')
                .trim()

        if (
            !normalizedTag ||
            tags.length >= 3
        ) {
            return
        }

        const alreadyExists =
            tags.some(
                (tag) =>
                    tag.toLowerCase() ===
                    normalizedTag.toLowerCase(),
            )

        if (alreadyExists) {
            setTagInput('')
            return
        }

        setTags((currentTags) => [
            ...currentTags,
            normalizedTag,
        ])

        setTagInput('')
    }

    async function handleSubmit(
        event:
            SubmitEvent<HTMLFormElement>,
    ) {
        event.preventDefault()

        const trimmedTitle =
            title.trim()

        if (
            !trimmedTitle ||
            isUploadingAttachment
        ) {
            return
        }

        let attachments =
            initialTask?.attachments ?? []

        if (
            removedAttachmentIds.length >
            0
        ) {
            attachments =
                attachments.filter(
                    (attachment) =>
                        !removedAttachmentIds
                            .includes(
                                attachment.id,
                            ),
                )
        }

        try {
            setAttachmentUploadError(
                null,
            )

            if (
                attachmentFiles.length >
                0
            ) {
                setIsUploadingAttachment(
                    true,
                )

                const uploadedAttachments =
                    await onUploadAttachments(
                        attachmentFiles,
                    )

                attachments = [
                    ...attachments,
                    ...uploadedAttachments,
                ]
            }

            onCreate({
                title: trimmedTitle,
                description:
                    description.trim(),
                priority,
                assigneeId:
                    assigneeId || null,
                deadline:
                    deadline || null,
                tags,
                attachments,
            })
        } catch (error) {
            setAttachmentUploadError(
                error instanceof Error
                    ? error.message
                    : 'Attachment upload failed.',
            )
        } finally {
            setIsUploadingAttachment(
                false,
            )
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
                        {initialTask
                            ? 'Edit task'
                            : 'New task'}
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
                        setTitle(
                            event.target.value,
                        )
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
                        setDescription(
                            event.target.value,
                        )
                    }
                />
            </label>

            <div className="task-creator__field-row">
                <label className="task-creator__field">
                    <span>
                        Priority
                    </span>

                    <select
                        value={priority}
                        onChange={(event) =>
                            setPriority(
                                event.target
                                    .value as Priority,
                            )
                        }
                    >
                        <option value="critical">
                            Critical
                        </option>

                        <option value="high">
                            High
                        </option>

                        <option value="medium">
                            Medium
                        </option>

                        <option value="low">
                            Low
                        </option>
                    </select>
                </label>

                <label className="task-creator__field">
                    <span>
                        Deadline
                    </span>

                    <input
                        type="date"
                        value={deadline}
                        onChange={(event) =>
                            setDeadline(
                                event.target.value,
                            )
                        }
                    />
                </label>
            </div>

            <label className="task-creator__field">
                <span>Assignee</span>

                <select
                    value={assigneeId}
                    onChange={(event) =>
                        setAssigneeId(
                            event.target.value,
                        )
                    }
                >
                    <option value="">
                        Unassigned
                    </option>

                    {members.map(
                        (member) => (
                            <option
                                key={
                                    member.id
                                }
                                value={
                                    member.id
                                }
                            >
                                {
                                    member.displayName
                                }
                            </option>
                        ),
                    )}
                </select>
            </label>

            <div className="task-creator__field">
                <span>Tags</span>

                <div className="task-creator__tag-input">
                    <input
                        type="text"
                        value={tagInput}
                        placeholder="Add tag"
                        disabled={
                            tags.length >= 3
                        }
                        onChange={(event) =>
                            setTagInput(
                                event.target.value,
                            )
                        }
                    />

                    <button
                        type="button"
                        disabled={
                            !tagInput.trim() ||
                            tags.length >= 3
                        }
                        onClick={
                            handleAddTag
                        }
                    >
                        Add
                    </button>
                </div>

                {tags.length > 0 && (
                    <div className="task-creator__tags">
                        {tags.map(
                            (tag) => (
                                <button
                                    key={tag}
                                    type="button"
                                    className="task-creator__tag"
                                    title={`Remove ${tag}`}
                                    onClick={() =>
                                        setTags(
                                            (
                                                currentTags,
                                            ) =>
                                                currentTags.filter(
                                                    (
                                                        currentTag,
                                                    ) =>
                                                        currentTag !==
                                                        tag,
                                                ),
                                        )
                                    }
                                >
                                    #{tag} ×
                                </button>
                            ),
                        )}
                    </div>
                )}

                <small>
                    {tags.length}/3 tags
                </small>
            </div>

            <div className="task-creator__field">
                <span>
                    Attachments
                </span>

                <small>
                    Images, GIFs, MP4
                    videos, Blender .blend,
                    and GLB 3D models
                </small>

                {existingAttachments.length >
                    0 && (
                        <div>
                            <small>
                                Current attachments
                            </small>

                            {existingAttachments.map(
                                (attachment) => {
                                    const isRemoved =
                                        removedAttachmentIds
                                            .includes(
                                                attachment.id,
                                            )

                                    return (
                                        <div
                                            key={
                                                attachment.id
                                            }
                                        >
                                            <small>
                                                {
                                                    attachment.fileName
                                                }
                                            </small>

                                            {isRemoved ? (
                                                <>
                                                    <small>
                                                        {' '}
                                                        — will be
                                                        removed when
                                                        you save
                                                    </small>

                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            setRemovedAttachmentIds(
                                                                (
                                                                    currentIds,
                                                                ) =>
                                                                    currentIds.filter(
                                                                        (
                                                                            id,
                                                                        ) =>
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
                                                        setRemovedAttachmentIds(
                                                            (
                                                                currentIds,
                                                            ) => [
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
                                },
                            )}f
                        </div>
                    )}

                <input
                    type="file"
                    accept="image/*,video/mp4,.blend,.glb"
                    multiple
                    onChange={(event) => {
                        const selectedFiles =
                            Array.from(
                                event.target
                                    .files ?? [],
                            )

                        const unsupportedFile =
                            selectedFiles.find(
                                (file) =>
                                    !isSupportedAttachmentFile(
                                        file,
                                    ),
                            )

                        if (
                            unsupportedFile
                        ) {
                            setAttachmentFiles(
                                [],
                            )

                            setAttachmentUploadError(
                                `${unsupportedFile.name} is not a supported attachment type.`,
                            )

                            event.target.value =
                                ''

                            return
                        }

                        setAttachmentFiles(
                            selectedFiles,
                        )

                        setAttachmentUploadError(
                            null,
                        )
                    }}
                />

                {attachmentFiles.length >
                    0 && (
                        <div>
                            <small>
                                New attachments
                            </small>

                            {attachmentFiles.map(
                                (
                                    file,
                                    index,
                                ) => (
                                    <div
                                        key={`${file.name}-${file.size}-${file.lastModified}`}
                                    >
                                        <small>
                                            {
                                                file.name
                                            }
                                        </small>

                                        <button
                                            type="button"
                                            onClick={() =>
                                                setAttachmentFiles(
                                                    (
                                                        currentFiles,
                                                    ) =>
                                                        currentFiles.filter(
                                                            (
                                                                _,
                                                                currentIndex,
                                                            ) =>
                                                                currentIndex !==
                                                                index,
                                                        ),
                                                )
                                            }
                                        >
                                            Remove
                                        </button>
                                    </div>
                                ),
                            )}
                        </div>
                    )}

                {attachmentUploadError && (
                    <small>
                        {
                            attachmentUploadError
                        }
                    </small>
                )}
            </div>

            <div className="task-creator__actions">
                <div>
                    {initialTask &&
                        onDelete && (
                            <button
                                type="button"
                                className="task-creator__delete"
                                onClick={
                                    onDelete
                                }
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
                        disabled={
                            isUploadingAttachment
                        }
                    >
                        Cancel
                    </button>

                    <button
                        type="submit"
                        className="task-creator__create"
                        disabled={
                            !title.trim() ||
                            isUploadingAttachment
                        }
                    >
                        {isUploadingAttachment
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