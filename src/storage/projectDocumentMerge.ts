import type {
    Project,
    Task,
} from '../types/board'

export interface TaskSyncConflict {
    taskId: string
    localTask: Task | null
    remoteTask: Task | null
}

export interface ProjectDocumentMergeResult {
    localProject: Project
    projectToSave: Project
    taskConflicts: TaskSyncConflict[]
    projectConflict: boolean
}

function valuesMatch(
    firstValue: unknown,
    secondValue: unknown,
) {
    return (
        JSON.stringify(firstValue) ===
        JSON.stringify(secondValue)
    )
}

function mergeValue<T>(
    baseValue: T,
    localValue: T,
    remoteValue: T,
): {
    localValue: T
    saveValue: T
    conflict: boolean
} {
    const localChanged =
        !valuesMatch(
            localValue,
            baseValue,
        )

    const remoteChanged =
        !valuesMatch(
            remoteValue,
            baseValue,
        )

    const localAndRemoteMatch =
        valuesMatch(
            localValue,
            remoteValue,
        )

    if (
        localChanged &&
        remoteChanged &&
        !localAndRemoteMatch
    ) {
        return {
            localValue,
            saveValue: remoteValue,
            conflict: true,
        }
    }

    if (
        remoteChanged &&
        !localChanged
    ) {
        return {
            localValue: remoteValue,
            saveValue: remoteValue,
            conflict: false,
        }
    }

    return {
        localValue,
        saveValue: localValue,
        conflict: false,
    }
}

export function mergeProjectDocuments(
    baseProject: Project,
    localProject: Project,
    remoteProject: Project,
    blockedTaskIds:
        ReadonlySet<string> = new Set(),
): ProjectDocumentMergeResult {
    const nameMerge =
        mergeValue(
            baseProject.name,
            localProject.name,
            remoteProject.name,
        )

    const memberMerge =
        mergeValue(
            baseProject.members,
            localProject.members,
            remoteProject.members,
        )

    const columnMerge =
        mergeValue(
            baseProject.columns,
            localProject.columns,
            remoteProject.columns,
        )

    const baseById =
        new Map(
            baseProject.tasks.map(
                (task) => [
                    task.id,
                    task,
                ],
            ),
        )

    const localById =
        new Map(
            localProject.tasks.map(
                (task) => [
                    task.id,
                    task,
                ],
            ),
        )

    const remoteById =
        new Map(
            remoteProject.tasks.map(
                (task) => [
                    task.id,
                    task,
                ],
            ),
        )

    const allTaskIds =
        new Set([
            ...baseById.keys(),
            ...localById.keys(),
            ...remoteById.keys(),
        ])

    const localTasks: Task[] = []
    const tasksToSave: Task[] = []
    const taskConflicts:
        TaskSyncConflict[] = []

    for (const taskId of allTaskIds) {
        const baseTask =
            baseById.get(taskId)

        const localTask =
            localById.get(taskId)

        const remoteTask =
            remoteById.get(taskId)

        const localChanged =
            !valuesMatch(
                localTask,
                baseTask,
            )

        const remoteChanged =
            !valuesMatch(
                remoteTask,
                baseTask,
            )

        const localAndRemoteMatch =
            valuesMatch(
                localTask,
                remoteTask,
            )

        const hasConflict =
            (
                localChanged &&
                remoteChanged &&
                !localAndRemoteMatch
            ) ||
            (
                blockedTaskIds.has(taskId) &&
                !localAndRemoteMatch
            )

        if (hasConflict) {
            taskConflicts.push({
                taskId,
                localTask:
                    localTask ?? null,
                remoteTask:
                    remoteTask ?? null,
            })

            /*
             * Keep the user's local version visible,
             * but preserve the remote version in Drive.
             */
            if (localTask) {
                localTasks.push(localTask)
            }

            if (remoteTask) {
                tasksToSave.push(remoteTask)
            }

            continue
        }

        if (
            remoteChanged &&
            !localChanged
        ) {
            if (remoteTask) {
                localTasks.push(remoteTask)
                tasksToSave.push(remoteTask)
            }

            continue
        }

        if (localTask) {
            localTasks.push(localTask)
            tasksToSave.push(localTask)
        }
    }

    const projectConflict =
        baseProject.id !==
        remoteProject.id ||
        baseProject.id !==
        localProject.id ||
        nameMerge.conflict ||
        memberMerge.conflict ||
        columnMerge.conflict

    const schemaVersion =
        Math.max(
            baseProject.schemaVersion,
            localProject.schemaVersion,
            remoteProject.schemaVersion,
        )

    return {
        localProject: {
            ...localProject,

            schemaVersion,

            name:
                nameMerge.localValue,

            members:
                memberMerge.localValue,

            columns:
                columnMerge.localValue,

            tasks:
                localTasks,
        },

        projectToSave: {
            ...remoteProject,

            schemaVersion,

            name:
                nameMerge.saveValue,

            members:
                memberMerge.saveValue,

            columns:
                columnMerge.saveValue,

            tasks:
                tasksToSave,
        },

        taskConflicts,

        projectConflict,
    }
}

export function getRemovedAttachmentFileIds(
    previousProject: Project,
    nextProject: Project,
): string[] {
    const nextAttachmentIds =
        new Set(
            nextProject.tasks.flatMap(
                (task) =>
                    task.attachments
                        .map(
                            (attachment) =>
                                attachment.driveFileId,
                        )
                        .filter(
                            (
                                fileId,
                            ): fileId is string =>
                                Boolean(fileId),
                        ),
            ),
        )

    return [
        ...new Set(
            previousProject.tasks.flatMap(
                (task) =>
                    task.attachments
                        .map(
                            (attachment) =>
                                attachment.driveFileId,
                        )
                        .filter(
                            (
                                fileId,
                            ): fileId is string =>
                                typeof fileId === 'string' &&
                                !nextAttachmentIds.has(
                                    fileId,
                                ),
                        ),
            ),
        ),
    ]
}