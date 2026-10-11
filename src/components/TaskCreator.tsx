import { useRef, useState } from 'react'
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
import { TagEditor } from './TagEditor'

interface TaskCreatorProps {
    columnTitle: string
    members: DemoUser[]
    initialTask?: Task
    onCreate: (task: NewTaskInput) => boolean
    onCancel: () => void
    onDelete?: () => void
    onUploadAttachments: (
        files: File[],
    ) => Promise<Attachment[]>
    availableTags: string[]
}

export function TaskCreator({
    columnTitle,
    members,
    initialTask,
    onCreate,
    onCancel,
    onDelete,
    onUploadAttachments,
    availableTags,
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

    const [
        attachmentFiles,
        setAttachmentFiles,
    ] = useState<File[]>([])

    const [
        removedAttachmentIds,
        setRemovedAttachmentIds,
    ] = useState<string[]>([])

    const submissionLockedRef = useRef(false)

    const [
        stagedUploads,
        setStagedUploads,
    ] = useState<Attachment[] | null>(null)

    const [
        isSubmitting,
        setIsSubmitting,
    ] = useState(false)

    const [
        attachmentUploadError,
        setAttachmentUploadError,
    ] = useState<string | null>(null)

    const existingAttachments =
        initialTask?.attachments ?? []

    async function handleSubmit(
        event: SubmitEvent<HTMLFormElement>,
    ) {
        event.preventDefault()

        const trimmedTitle = title.trim()

        if (
            !trimmedTitle ||
            submissionLockedRef.current
        ) {
            return
        }

        submissionLockedRef.current = true
        setIsSubmitting(true)
        setAttachmentUploadError(null)

        try {
            const retainedAttachments =
                (initialTask?.attachments ?? []).filter(
                    (attachment) =>
                        !removedAttachmentIds.includes(
                            attachment.id,
                        ),
                )

            let uploadedAttachments = stagedUploads

            if (uploadedAttachments === null) {
                uploadedAttachments =
                    attachmentFiles.length > 0
                        ? await onUploadAttachments(
                            [...attachmentFiles],
                        )
                        : []

                setStagedUploads(
                    uploadedAttachments.length > 0
                        ? uploadedAttachments
                        : null,
                )
            }

            const taskInput: NewTaskInput = {
                title: trimmedTitle,
                description: description.trim(),
                priority,
                assigneeId: assigneeId || null,
                deadline: deadline || null,
                tags: [...tags],
                attachments: [
                    ...retainedAttachments,
                    ...uploadedAttachments,
                ],
            }

            const accepted = onCreate(taskInput)

            if (!accepted) {
                throw new Error(
                    'The task could not be accepted. Any successfully uploaded files are retained for retry without reuploading.',
                )
            }
        } catch (error) {
            submissionLockedRef.current = false
            setIsSubmitting(false)

            setAttachmentUploadError(
                error instanceof Error
                    ? error.message
                    : 'The task could not be submitted.',
            )
        }
    }

    const hasStagedUploads =
        (stagedUploads?.length ?? 0) > 0

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

                <TagEditor
                    tags={tags}
                    availableTags={availableTags}
                    onChange={setTags}
                    maxTags={3}
                />
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
                                                        className="task-creator__attachment-action"
                                                        disabled={isSubmitting || hasStagedUploads}
                                                        onClick={() =>
                                                            setRemovedAttachmentIds(
                                                                (currentIds) =>
                                                                    currentIds.filter(
                                                                        (id) =>
                                                                            id !== attachment.id,
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
                                                    className="task-creator__attachment-action task-creator__attachment-action--remove"
                                                    disabled={isSubmitting || hasStagedUploads}
                                                    onClick={() =>
                                                        setRemovedAttachmentIds(
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
                                },
                            )}
                        </div>
                    )}

                <input
                    type="file"
                    accept="image/*,video/mp4,.blend,.glb"
                    multiple
                    disabled={isSubmitting || hasStagedUploads}
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
                                            className="task-creator__attachment-action task-creator__attachment-action--remove"
                                            disabled={isSubmitting || hasStagedUploads}
                                            onClick={() =>
                                                setAttachmentFiles(
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
                                disabled={isSubmitting || hasStagedUploads}
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
                        onClick={() => {
                            if (
                                hasStagedUploads &&
                                !window.confirm(
                                    'Files have already been uploaded to Google Drive but were not accepted into the task. Leaving now may leave unreferenced files in Drive. Leave anyway?',
                                )
                            ) {
                                return
                            }

                            onCancel()
                        }}
                        disabled={
                            isSubmitting
                        }
                    >
                        Cancel
                    </button>


                    <button
                        type="submit"
                        className="task-creator__create"
                        disabled={
                            !title.trim() ||
                            isSubmitting
                        }
                    >
                        {isSubmitting
                            ? 'Submitting...'
                            : initialTask
                                ? 'Save Changes'
                                : 'Create Task'}
                    </button>

                </div>
            </div>
        </form>
    )
}