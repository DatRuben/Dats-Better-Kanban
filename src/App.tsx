import './App.css'
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import { KanbanColumn } from './components/KanbanColumn'
import { demoProject } from './data/demoProject'
import type {
  Attachment,
  NewTaskInput,
  Task,
} from './types/board'
import type { WheelEvent } from 'react'
import { moveTaskToColumn } from './utility/moveTask'
import { DragDropProvider } from '@dnd-kit/react'
import { isSortable } from '@dnd-kit/react/sortable'
import { createProjectSnapshot } from './storage/projectSnapshot'
import {
  clearStoredGoogleAccessToken,
  getStoredGoogleAccessToken,
  requestGoogleAccessToken,
  getStoredGoogleAccessTokenExpiresAt,
} from './auth/googleAuth'
import { createBlankProject } from './data/createBlankProject'
import { APP_VERSION } from './config/app'
import {
  createProjectOnDrive,
  deleteTaskFromDrive,
  downloadAttachmentFromDrive,
  ensureDatsDriveFolder,
  ensureProjectsDriveFolder,
  loadFirstProjectFromDrive,
  loadFirstRememberedProjectFromDrive,
  loadTaskFromDrive,
  loadTasksFromDrive,
  loadProjectFromDriveFolder,
  loadProjectMetadataFromDrive,
  loadAvailableProjectSummariesFromDrive,
  rememberProjectFolder,
  saveColumnsToDrive,
  saveProjectMetadataToDrive,
  saveTaskToDrive,
  uploadAttachmentToDrive,
  verifyGoogleDriveAccess,
  deleteAttachmentFromDrive,
  getGoogleDriveUser,
  shareProjectFolderWithUser,
  removeProjectFolderPermission,
  updateProjectFolderPermission,
} from './storage/googleDriveApi'
import type {
  GoogleDriveUser,
  LoadedDriveProject,
  DriveProjectSummary,
} from './storage/googleDriveApi'
import {
  pickGoogleDriveFolder,
} from './storage/googleDrivePicker'
import { TaskCard } from './components/TaskCard'

const priorityOrder = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
}

function compareTasks(firstTask: Task, secondTask: Task) {
  const priorityDifference =
    priorityOrder[firstTask.priority] -
    priorityOrder[secondTask.priority]

  if (priorityDifference !== 0) {
    return priorityDifference
  }

  if (firstTask.deadline && secondTask.deadline) {
    const deadlineDifference =
      firstTask.deadline.localeCompare(secondTask.deadline)

    if (deadlineDifference !== 0) {
      return deadlineDifference
    }
  }

  if (firstTask.deadline && !secondTask.deadline) {
    return -1
  }

  if (!firstTask.deadline && secondTask.deadline) {
    return 1
  }

  return firstTask.createdAt.localeCompare(secondTask.createdAt)
}

function compareCompletedTasks(
  firstTask: Task,
  secondTask: Task,
) {
  if (
    firstTask.completedAt &&
    secondTask.completedAt
  ) {
    return secondTask.completedAt.localeCompare(
      firstTask.completedAt,
    )
  }

  if (firstTask.completedAt) {
    return -1
  }

  if (secondTask.completedAt) {
    return 1
  }

  return 0
}

function formatDeadline(deadline: string) {
  const date = new Date(`${deadline}T00:00:00`)

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

function formatCompletedAt(completedAt: string) {
  const date = new Date(completedAt)

  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

interface TaskSyncConflict {
  taskId: string
  localTask: Task | null
  remoteTask: Task | null
}

function App() {
  const [project, setProject] =
    useState(demoProject)
  const [isDemoMode, setIsDemoMode] =
    useState(true)
  const [hasChosenMode, setHasChosenMode] =
    useState(false)
  const [columns, setColumns] =
    useState(project.columns)
  const [tasks, setTasks] =
    useState(project.tasks)

  const [googleAccessToken, setGoogleAccessToken] =
    useState<string | null>(null)

  const [googleUser, setGoogleUser] =
    useState<GoogleDriveUser | null>(null)

  const [updatingMemberId, setUpdatingMemberId] =
    useState<string | null>(null)

  const [
    googleTokenExpiresAt,
    setGoogleTokenExpiresAt,
  ] = useState<number | null>(null)

  const [
    googleTokenMinutesRemaining,
    setGoogleTokenMinutesRemaining,
  ] = useState<number | null>(null)

  const [googleProjectFolderId, setGoogleProjectFolderId] =
    useState<string | null>(null)

  const [googleTasksFolderId, setGoogleTasksFolderId] =
    useState<string | null>(null)

  const [
    googleAttachmentsFolderId,
    setGoogleAttachmentsFolderId,
  ] = useState<string | null>(null)

  const lastSavedTasksRef =
    useRef<Task[]>([])

  const tasksRef =
    useRef<Task[]>(tasks)

  const [
    taskSyncConflicts,
    setTaskSyncConflicts,
  ] = useState<TaskSyncConflict[]>([])

  const taskSyncConflictIdsRef =
    useRef<Set<string>>(new Set())

  const [isGoogleConnecting, setIsGoogleConnecting] =
    useState(false)

  const [
    isOpeningSharedProject,
    setIsOpeningSharedProject,
  ] = useState(false)

  const [
    isProjectChooserOpen,
    setIsProjectChooserOpen,
  ] = useState(false)

  const [
    availableProjectSummaries,
    setAvailableProjectSummaries,
  ] = useState<DriveProjectSummary[]>([])

  const [
    isLoadingProjectSummaries,
    setIsLoadingProjectSummaries,
  ] = useState(false)

  const [
    projectChooserError,
    setProjectChooserError,
  ] = useState<string | null>(null)

  const [
    openingProjectFolderId,
    setOpeningProjectFolderId,
  ] = useState<string | null>(null)

  const [
    sharedProjectError,
    setSharedProjectError,
  ] = useState<string | null>(null)

  const [googleAuthError, setGoogleAuthError] =
    useState<string | null>(null)

  type SaveStatus =
    | 'idle'
    | 'saving'
    | 'saved'
    | 'error'

  const [saveStatus, setSaveStatus] =
    useState<SaveStatus>('idle')

  const [saveError, setSaveError] =
    useState<string | null>(null)

  const [syncError, setSyncError] =
    useState<string | null>(null)

  const [
    projectSyncError,
    setProjectSyncError,
  ] = useState<string | null>(null)

  const pendingSavesRef =
    useRef(0)

  const scheduledSavesRef =
    useRef(0)

  const currentProject = createProjectSnapshot(
    project,
    columns,
    tasks,
  )

  const isCurrentUserProjectOwner =
    googleUser !== null &&
    currentProject.members.some(
      (member) =>
        member.id === googleUser.permissionId &&
        member.accessRole === 'owner',
    )

  const currentProjectMember =
    googleUser
      ? currentProject.members.find(
        (member) =>
          member.id === googleUser.permissionId,
      )
      : undefined

  const canCurrentUserEditProject =
    isDemoMode ||
    currentProjectMember?.accessRole === 'owner' ||
    currentProjectMember?.accessRole === 'editor'

  const canCurrentUserEditProjectSettings =
    isDemoMode ||
    isCurrentUserProjectOwner

  const [googleProjectsFolderId, setGoogleProjectsFolderId] =
    useState<string | null>(null)


  const handleLoadAttachment =
    useCallback(
      async (
        attachment: Attachment,
      ): Promise<Blob | null> => {
        if (
          !googleAccessToken ||
          !attachment.driveFileId
        ) {
          return null
        }

        return downloadAttachmentFromDrive(
          googleAccessToken,
          attachment.driveFileId,
        )
      },
      [googleAccessToken],
    )

  function beginSave(): boolean {
    if (!canCurrentUserEditProject) {
      return false
    }

    const storedAccessToken =
      getStoredGoogleAccessToken()

    if (!storedAccessToken) {
      expireGoogleSession()
      return false
    }

    pendingSavesRef.current += 1

    setSaveStatus('saving')
    setSaveError(null)

    return true
  }

  function registerScheduledSave() {
    scheduledSavesRef.current += 1

    let released = false

    return () => {
      if (released) {
        return
      }

      released = true

      scheduledSavesRef.current =
        Math.max(
          0,
          scheduledSavesRef.current - 1,
        )
    }
  }

  function hasPendingProjectSaves() {
    return (
      scheduledSavesRef.current > 0 ||
      pendingSavesRef.current > 0
    )
  }

  function completeSave() {
    pendingSavesRef.current =
      Math.max(
        0,
        pendingSavesRef.current - 1,
      )

    if (pendingSavesRef.current === 0) {
      setSaveStatus((currentStatus) =>
        currentStatus === 'error'
          ? 'error'
          : 'saved',
      )
    }
  }

  function failSave(error: unknown) {
    if (isGoogleUnauthorizedError(error)) {
      expireGoogleSession()
      return
    }

    pendingSavesRef.current =
      Math.max(
        0,
        pendingSavesRef.current - 1,
      )

    setSaveStatus('error')

    setSaveError(
      error instanceof Error
        ? error.message
        : 'Save failed.',
    )
  }

  useEffect(() => {
    if (
      !canCurrentUserEditProjectSettings ||
      !googleAccessToken ||
      !googleProjectsFolderId ||
      !googleProjectFolderId
    ) {
      return
    }

    const releaseScheduledSave =
      registerScheduledSave()

    const timeout =
      window.setTimeout(() => {
        releaseScheduledSave()

        if (!beginSave()) {
          return
        }

        void saveProjectMetadataToDrive(
          googleAccessToken,
          googleProjectsFolderId,
          googleProjectFolderId,
          project,
        )
          .then(() => {
            completeSave()
          })
          .catch((error) => {
            failSave(error)
          })
      }, 1000)

    return () => {
      window.clearTimeout(timeout)
      releaseScheduledSave()
    }
  }, [
    project,
    canCurrentUserEditProjectSettings,
    googleAccessToken,
    googleProjectsFolderId,
    googleProjectFolderId,
  ])

  useEffect(() => {
    if (
      !googleAccessToken ||
      !googleTokenExpiresAt
    ) {
      setGoogleTokenMinutesRemaining(null)
      return
    }

    const tokenExpiresAt =
      googleTokenExpiresAt

    function updateTokenTimeRemaining() {
      const millisecondsRemaining =
        tokenExpiresAt - Date.now()

      if (millisecondsRemaining <= 0) {
        setGoogleTokenMinutesRemaining(0)
        expireGoogleSession()
        return
      }

      setGoogleTokenMinutesRemaining(
        Math.ceil(
          millisecondsRemaining / 60000,
        ),
      )
    }

    updateTokenTimeRemaining()

    const interval =
      window.setInterval(
        updateTokenTimeRemaining,
        30000,
      )

    return () => {
      window.clearInterval(interval)
    }
  }, [
    googleAccessToken,
    googleTokenExpiresAt,
  ])

  useEffect(() => {
    if (
      isDemoMode ||
      !googleAccessToken ||
      !googleProjectFolderId
    ) {
      return
    }

    const releaseScheduledSave =
      registerScheduledSave()

    const timeout =
      window.setTimeout(() => {
        releaseScheduledSave()

        if (!beginSave()) {
          return
        }

        void saveColumnsToDrive(
          googleAccessToken,
          googleProjectFolderId,
          columns,
        )
          .then(() => {
            completeSave()
          })
          .catch((error) => {
            failSave(error)
          })
      }, 1000)

    return () => {
      window.clearTimeout(timeout)
      releaseScheduledSave()
    }
  }, [
    columns,
    isDemoMode,
    googleAccessToken,
    googleProjectFolderId,
  ])

  useEffect(() => {
    if (
      isDemoMode ||
      !googleAccessToken ||
      !googleTasksFolderId
    ) {
      return
    }

    const releaseScheduledSave =
      registerScheduledSave()

    const timeout =
      window.setTimeout(() => {
        releaseScheduledSave()

        const previousTasks =
          lastSavedTasksRef.current

        const previousById =
          new Map(
            previousTasks.map(
              (task) => [task.id, task],
            ),
          )

        const currentIds =
          new Set(
            tasks.map((task) => task.id),
          )

        const changedTasks =
          tasks.filter((task) => {
            if (
              taskSyncConflictIdsRef.current.has(
                task.id,
              )
            ) {
              return false
            }

            const previousTask =
              previousById.get(task.id)

            return (
              !previousTask ||
              JSON.stringify(previousTask) !==
              JSON.stringify(task)
            )
          })

        const deletedTaskIds =
          previousTasks
            .filter(
              (task) =>
                !currentIds.has(task.id) &&
                !taskSyncConflictIdsRef.current.has(
                  task.id,
                ),
            )
            .map((task) => task.id)

        if (
          changedTasks.length === 0 &&
          deletedTaskIds.length === 0
        ) {
          return
        }

        if (!beginSave()) {
          return
        }

        void (async () => {
          const safeChangedTasks: Task[] = []
          const safeDeletedTaskIds: string[] = []

          const alreadySyncedChangedTasks: Task[] = []
          const alreadyDeletedTaskIds: string[] = []

          const detectedConflicts: TaskSyncConflict[] = []

          for (const task of changedTasks) {
            const previousTask =
              previousById.get(task.id) ?? null

            const remoteTask =
              await loadTaskFromDrive(
                googleAccessToken,
                googleTasksFolderId,
                task.id,
              )

            const remoteMatchesBaseline =
              taskVersionsMatch(
                remoteTask,
                previousTask,
              )

            const remoteAlreadyMatchesLocal =
              taskVersionsMatch(
                remoteTask,
                task,
              )

            if (remoteAlreadyMatchesLocal) {
              alreadySyncedChangedTasks.push(task)
              continue
            }

            if (!remoteMatchesBaseline) {
              detectedConflicts.push({
                taskId: task.id,
                localTask: task,
                remoteTask,
              })

              continue
            }

            safeChangedTasks.push(task)
          }

          for (const taskId of deletedTaskIds) {
            const previousTask =
              previousById.get(taskId)

            if (!previousTask) {
              continue
            }

            const remoteTask =
              await loadTaskFromDrive(
                googleAccessToken,
                googleTasksFolderId,
                taskId,
              )

            if (remoteTask === null) {
              alreadyDeletedTaskIds.push(taskId)
              continue
            }

            if (
              !taskVersionsMatch(
                remoteTask,
                previousTask,
              )
            ) {
              detectedConflicts.push({
                taskId,
                localTask: null,
                remoteTask,
              })

              continue
            }

            safeDeletedTaskIds.push(taskId)
          }

          for (const conflict of detectedConflicts) {
            taskSyncConflictIdsRef.current.add(
              conflict.taskId,
            )
          }

          setTaskSyncConflicts(
            (currentConflicts) => {
              const conflictsById =
                new Map(
                  currentConflicts.map(
                    (conflict) => [
                      conflict.taskId,
                      conflict,
                    ],
                  ),
                )

              for (const conflict of detectedConflicts) {
                conflictsById.set(
                  conflict.taskId,
                  conflict,
                )
              }

              return [...conflictsById.values()]
            },
          )

          await Promise.all([
            ...safeChangedTasks.map((task) =>
              saveTaskToDrive(
                googleAccessToken,
                googleTasksFolderId,
                task,
              ),
            ),

            ...safeDeletedTaskIds.map((taskId) =>
              deleteTaskFromDrive(
                googleAccessToken,
                googleTasksFolderId,
                taskId,
              ),
            ),
          ])

          const syncedChangedTasks = [
            ...safeChangedTasks,
            ...alreadySyncedChangedTasks,
          ]

          const syncedDeletedTaskIds = [
            ...safeDeletedTaskIds,
            ...alreadyDeletedTaskIds,
          ]

          const attachmentIdsToDelete: string[] = []

          for (const task of syncedChangedTasks) {
            const previousTask =
              previousById.get(task.id)

            if (!previousTask) {
              continue
            }

            const currentAttachmentIds =
              new Set(
                task.attachments
                  .map(
                    (attachment) =>
                      attachment.driveFileId,
                  )
                  .filter(
                    (fileId): fileId is string =>
                      Boolean(fileId),
                  ),
              )

            for (
              const previousAttachment
              of previousTask.attachments
            ) {
              if (
                previousAttachment.driveFileId &&
                !currentAttachmentIds.has(
                  previousAttachment.driveFileId,
                )
              ) {
                attachmentIdsToDelete.push(
                  previousAttachment.driveFileId,
                )
              }
            }
          }

          for (const taskId of syncedDeletedTaskIds) {
            const deletedTask =
              previousById.get(taskId)

            if (!deletedTask) {
              continue
            }

            for (
              const attachment
              of deletedTask.attachments
            ) {
              if (attachment.driveFileId) {
                attachmentIdsToDelete.push(
                  attachment.driveFileId,
                )
              }
            }
          }

          const attachmentCleanupResults =
            await Promise.allSettled(
              attachmentIdsToDelete.map((fileId) =>
                deleteAttachmentFromDrive(
                  googleAccessToken,
                  fileId,
                ),
              ),
            )

          for (
            const cleanupResult
            of attachmentCleanupResults
          ) {
            if (cleanupResult.status === 'rejected') {
              console.error(
                'Failed to clean up an unused attachment:',
                cleanupResult.reason,
              )
            }
          }

          const nextSavedTasksById =
            new Map(
              lastSavedTasksRef.current.map(
                (task) => [task.id, task],
              ),
            )
          for (const task of syncedChangedTasks) {
            nextSavedTasksById.set(
              task.id,
              task,
            )
          }

          for (const taskId of syncedDeletedTaskIds) {
            nextSavedTasksById.delete(
              taskId,
            )
          }

          lastSavedTasksRef.current =
            [...nextSavedTasksById.values()]

          completeSave()
        })().catch((error) => {
          failSave(error)
        })
      }, 1000)

    return () => {
      window.clearTimeout(timeout)
      releaseScheduledSave()
    }
  }, [
    tasks,
    isDemoMode,
    googleAccessToken,
    googleTasksFolderId,
  ])

  const [activeView, setActiveView] =
    useState<
      'board' |
      'mine' |
      'timeline' |
      'history'
    >('board')
  const [
    assigneeFilter,
    setAssigneeFilter,
  ] = useState<string>('all')

  const [
    taskSortMode,
    setTaskSortMode,
  ] = useState<'priority' | 'assignee'>(
    'priority',
  )
  const orderedColumns = [...columns].sort(
    (firstColumn, secondColumn) =>
      firstColumn.order - secondColumn.order,
  )
  const [isPipelineEditing, setIsPipelineEditing] = useState(false)

  const [isMemberPanelOpen, setIsMemberPanelOpen] = useState(false)

  const [memberEmail, setMemberEmail] = useState('')

  const [memberAccessRole, setMemberAccessRole] = useState<'editor' | 'viewer'>('editor')

  const [isInvitingMember, setIsInvitingMember] = useState(false)

  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null)

  const [memberInviteError, setMemberInviteError] = useState<string | null>(null)

  const [isTaskEditing, setIsTaskEditing] = useState(false)

  const [creatingTaskColumnId, setCreatingTaskColumnId] = useState<string | null>(null)

  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)

  useEffect(() => {
    if (
      assigneeFilter === 'all' ||
      assigneeFilter === 'unassigned'
    ) {
      return
    }

    const memberStillExists =
      currentProject.members.some(
        (member) =>
          member.id === assigneeFilter,
      )

    if (!memberStillExists) {
      setAssigneeFilter('all')
    }
  }, [
    assigneeFilter,
    currentProject.members,
  ])

  useEffect(() => {
    if (canCurrentUserEditProject) {
      return
    }

    setIsPipelineEditing(false)
    setIsTaskEditing(false)
    setEditingTaskId(null)
    setCreatingTaskColumnId(null)
  }, [canCurrentUserEditProject])

  const timelineTasks = tasks
    .filter(matchesAssigneeFilter)
    .filter((task) => {
      const taskColumn = columns.find(
        (column) => column.id === task.columnId,
      )


      return !taskColumn?.countsAsCompleted
    })
    .sort(compareVisibleTasks)

  const timelineGroups: Task[][] = []

  const myTasks =
    googleUser
      ? tasks
        .filter((task) => {
          if (
            task.assigneeId !==
            googleUser.permissionId
          ) {
            return false
          }

          const taskColumn =
            columns.find(
              (column) =>
                column.id === task.columnId,
            )

          return !taskColumn?.countsAsCompleted
        })
        .sort(compareTasks)
      : []

  function matchesAssigneeFilter(
    task: Task,
  ) {
    if (assigneeFilter === 'all') {
      return true
    }

    if (assigneeFilter === 'unassigned') {
      return task.assigneeId === null
    }

    return task.assigneeId === assigneeFilter
  }
  const completedTasks = tasks
    .filter(matchesAssigneeFilter)
    .filter((task) => {
      const taskColumn = columns.find(
        (column) => column.id === task.columnId,
      )

      return taskColumn?.countsAsCompleted
    })
    .sort(compareCompletedTasks)

  for (const task of timelineTasks) {
    const lastGroup = timelineGroups[timelineGroups.length - 1]
    const firstTaskInGroup = lastGroup?.[0]

    const matchesLastGroup =
      task.deadline !== null &&
      firstTaskInGroup?.deadline === task.deadline &&
      firstTaskInGroup.priority === task.priority

    if (matchesLastGroup) {
      lastGroup.push(task)
    } else {
      timelineGroups.push([task])
    }
  }

  function compareTasksByAssignee(
    firstTask: Task,
    secondTask: Task,
  ) {
    const firstAssignee =
      currentProject.members.find(
        (member) =>
          member.id === firstTask.assigneeId,
      )

    const secondAssignee =
      currentProject.members.find(
        (member) =>
          member.id === secondTask.assigneeId,
      )

    if (firstAssignee && !secondAssignee) {
      return -1
    }

    if (!firstAssignee && secondAssignee) {
      return 1
    }

    if (
      firstAssignee &&
      secondAssignee
    ) {
      const nameDifference =
        firstAssignee.displayName.localeCompare(
          secondAssignee.displayName,
        )

      if (nameDifference !== 0) {
        return nameDifference
      }
    }

    return compareTasks(
      firstTask,
      secondTask,
    )
  }

  function compareVisibleTasks(
    firstTask: Task,
    secondTask: Task,
  ) {
    return taskSortMode === 'assignee'
      ? compareTasksByAssignee(
        firstTask,
        secondTask,
      )
      : compareTasks(
        firstTask,
        secondTask,
      )
  }

  function handleTimelineWheel(event: WheelEvent<HTMLElement>) {
    const timeline = event.currentTarget

    const scrollingRight = event.deltaY > 0
    const scrollingLeft = event.deltaY < 0

    const canScrollLeft = timeline.scrollLeft > 0
    const canScrollRight =
      timeline.scrollLeft <
      timeline.scrollWidth - timeline.clientWidth

    const shouldScrollTimeline =
      (scrollingRight && canScrollRight) ||
      (scrollingLeft && canScrollLeft)

    if (!shouldScrollTimeline) {
      return
    }

    event.preventDefault()
    timeline.scrollLeft += event.deltaY
  }

  function handleAddColumn() {
    if (!canCurrentUserEditProject) {
      return
    }

    setColumns((currentColumns) => {
      if (currentColumns.length >= 100) {
        return currentColumns
      }

      const nextOrder =
        currentColumns.length === 0
          ? 0
          : Math.max(
            ...currentColumns.map((column) => column.order),
          ) + 1

      return [
        ...currentColumns,
        {
          id: crypto.randomUUID(),
          title: 'New Section',
          order: nextOrder,
          countsAsCompleted: false,
        },
      ]
    })
  }

  function handleColumnTitleChange(
    columnId: string,
    title: string,
  ) {
    if (!canCurrentUserEditProject) {
      return
    }

    setColumns((currentColumns) =>
      currentColumns.map((column) =>
        column.id === columnId
          ? {
            ...column,
            title,
          }
          : column,
      ),
    )
  }

  function handleColumnOrderingChange(
    columnId: string,
    usePriorityDeadlineOrdering: boolean,
  ) {
    if (!canCurrentUserEditProject) {
      return
    }

    setColumns((currentColumns) =>
      currentColumns.map((column) =>
        column.id === columnId
          ? {
            ...column,
            usePriorityDeadlineOrdering,
          }
          : column,
      ),
    )
  }

  function handleColumnCompletionChange(
    columnId: string,
    countsAsCompleted: boolean,
  ) {
    if (!canCurrentUserEditProject) {
      return
    }

    const column = columns.find(
      (column) => column.id === columnId,
    )

    if (!column) {
      return
    }

    const columnTasks =
      tasks.filter(
        (task) =>
          task.columnId === column.id,
      )

    if (columnTasks.length > 0) {
      const message = countsAsCompleted
        ? 'All tasks in this section will be marked as completed. Continue?'
        : 'All tasks in this section will be removed from Completed History. Continue?'

      const confirmed = window.confirm(message)

      if (!confirmed) {
        return
      }
    }

    const completionTime = new Date().toISOString()

    setColumns((currentColumns) =>
      currentColumns.map((currentColumn) =>
        currentColumn.id === columnId
          ? {
            ...currentColumn,
            countsAsCompleted,
          }
          : currentColumn,
      ),
    )

    setTasks((currentTasks) =>
      currentTasks.map((task) => {
        if (task.columnId !== columnId) {
          return task
        }

        return {
          ...task,
          completedAt: countsAsCompleted
            ? completionTime
            : null,
          updatedAt: completionTime,
          revision: task.revision + 1,
        }
      }),
    )
  }

  function handleDeleteColumn(columnId: string) {
    if (!canCurrentUserEditProject) {
      return
    }

    const column = columns.find(
      (column) => column.id === columnId,
    )

    if (!column) {
      return
    }

    const hasTasks = tasks.some(
      (task) => task.columnId === columnId,
    )

    if (hasTasks) {
      return
    }

    const confirmed = window.confirm(
      `Delete "${column.title}"? This cannot be undone.`,
    )

    if (!confirmed) {
      return
    }

    setColumns((currentColumns) =>
      currentColumns
        .filter((column) => column.id !== columnId)
        .map((column, index) => ({
          ...column,
          order: index,
        })),
    )
  }

  function handleMoveColumn(
    initialIndex: number,
    targetIndex: number,
  ) {
    if (!canCurrentUserEditProject) {
      return
    }

    if (initialIndex === targetIndex) {
      return
    }

    setColumns((currentColumns) => {
      const reorderedColumns = [...currentColumns].sort(
        (firstColumn, secondColumn) =>
          firstColumn.order - secondColumn.order,
      )

      const [movedColumn] = reorderedColumns.splice(
        initialIndex,
        1,
      )

      if (!movedColumn) {
        return currentColumns
      }

      reorderedColumns.splice(
        targetIndex,
        0,
        movedColumn,
      )

      return reorderedColumns.map((column, index) => ({
        ...column,
        order: index,
      }))
    })
  }

  function handleCreateTask(
    columnId: string,
    taskInput: NewTaskInput,
  ) {
    if (!canCurrentUserEditProject) {
      return
    }

    const column = columns.find(
      (column) => column.id === columnId,
    )

    if (!column) {
      return
    }

    const createdAt = new Date().toISOString()

    const newTask: Task = {
      id: crypto.randomUUID(),
      title: taskInput.title,
      description: taskInput.description,
      columnId,
      priority: taskInput.priority,
      assigneeId: taskInput.assigneeId,
      deadline: taskInput.deadline,
      tags: taskInput.tags,
      attachments: taskInput.attachments,
      createdAt,
      completedAt: column.countsAsCompleted
        ? createdAt
        : null,
      updatedAt: createdAt,
      revision: 1,
    }

    setTasks((currentTasks) => [
      ...currentTasks,
      newTask,
    ])

    setCreatingTaskColumnId(null)
  }

  function handleUpdateTask(
    taskId: string,
    taskInput: NewTaskInput,
  ) {
    if (!canCurrentUserEditProject) {
      return
    }

    const updatedAt = new Date().toISOString()
    setTasks((currentTasks) =>
      currentTasks.map((task) =>
        task.id === taskId
          ? {
            ...task,
            title: taskInput.title,
            description: taskInput.description,
            priority: taskInput.priority,
            assigneeId: taskInput.assigneeId,
            deadline: taskInput.deadline,
            tags: taskInput.tags,
            updatedAt,
            revision: task.revision + 1,
            attachments: taskInput.attachments,
          }
          : task,
      ),
    )

    setEditingTaskId(null)
  }

  function taskVersionsMatch(
    firstTask: Task | null | undefined,
    secondTask: Task | null | undefined,
  ) {
    if (!firstTask || !secondTask) {
      return firstTask == null &&
        secondTask == null
    }

    return (
      JSON.stringify(firstTask) ===
      JSON.stringify(secondTask)
    )
  }

  function handleDeleteTask(taskId: string) {
    if (!canCurrentUserEditProject) {
      return
    }

    const task = tasks.find(
      (task) => task.id === taskId,
    )

    if (!task) {
      return
    }

    const confirmed = window.confirm(
      `Delete "${task.title}"? This cannot be undone.`,
    )

    if (!confirmed) {
      return
    }

    setTasks((currentTasks) =>
      currentTasks.filter(
        (task) => task.id !== taskId,
      ),
    )

    setEditingTaskId(null)
  }

  function activateDriveProject(
    loadedDriveProject: LoadedDriveProject,
  ) {
    setAssigneeFilter('all')
    setTaskSortMode('priority')
    const activeProject =
      loadedDriveProject.project

    lastSavedTasksRef.current =
      activeProject.tasks

    tasksRef.current =
      activeProject.tasks

    taskSyncConflictIdsRef.current =
      new Set()

    setTaskSyncConflicts([])

    setGoogleProjectFolderId(
      loadedDriveProject.projectFolderId,
    )

    setGoogleTasksFolderId(
      loadedDriveProject.tasksFolderId,
    )

    setGoogleAttachmentsFolderId(
      loadedDriveProject.attachmentsFolderId,
    )

    setProject(activeProject)
    setColumns(activeProject.columns)
    setTasks(activeProject.tasks)

    setSaveStatus('idle')
    setSaveError(null)
    setSyncError(null)
    setProjectSyncError(null)
    setSharedProjectError(null)

    setIsPipelineEditing(false)
    setIsTaskEditing(false)
    setEditingTaskId(null)
    setCreatingTaskColumnId(null)

    setIsMemberPanelOpen(false)
    setMemberEmail('')
    setMemberAccessRole('editor')
    setMemberInviteError(null)

    setIsProjectChooserOpen(false)
    setProjectChooserError(null)

    setActiveView('board')
    setIsDemoMode(false)
  }

  async function openDriveProject(
    projectFolderId: string,
    isOwned: boolean,
  ) {
    if (
      !googleAccessToken ||
      !googleProjectsFolderId ||
      !googleUser
    ) {
      throw new Error(
        'Google Drive is not connected.',
      )
    }

    let loadedDriveProject =
      await loadProjectFromDriveFolder(
        googleAccessToken,
        projectFolderId,
        isOwned,
      )

    if (!loadedDriveProject) {
      throw new Error(
        'The selected folder is not a Dat’s project.',
      )
    }

    if (isOwned) {
      const hasProjectOwner =
        loadedDriveProject.project.members.some(
          (member) =>
            member.accessRole === 'owner',
        )

      if (!hasProjectOwner) {
        const migratedProject = {
          ...loadedDriveProject.project,

          members: [
            ...loadedDriveProject.project.members,
            {
              id: googleUser.permissionId,
              displayName:
                googleUser.displayName,
              role: '',
              email:
                googleUser.emailAddress,
              accessRole: 'owner' as const,
            },
          ],
        }

        await saveProjectMetadataToDrive(
          googleAccessToken,
          googleProjectsFolderId,
          projectFolderId,
          migratedProject,
        )

        loadedDriveProject = {
          ...loadedDriveProject,
          project: migratedProject,
        }
      }
    } else {
      const currentMember =
        loadedDriveProject.project.members.find(
          (member) =>
            member.id ===
            googleUser.permissionId,
        )

      if (!currentMember) {
        throw new Error(
          'Your Google account is not a member of this project.',
        )
      }
    }

    await rememberProjectFolder(
      googleAccessToken,
      googleProjectsFolderId,
      loadedDriveProject.projectFolderId,
    )

    activateDriveProject(
      loadedDriveProject,
    )
  }

  async function handleToggleProjectChooser() {
    if (isProjectChooserOpen) {
      setIsProjectChooserOpen(false)
      return
    }

    if (
      !googleAccessToken ||
      !googleProjectsFolderId
    ) {
      return
    }

    setIsMemberPanelOpen(false)
    setIsProjectChooserOpen(true)
    setIsLoadingProjectSummaries(true)
    setProjectChooserError(null)

    try {
      const summaries =
        await loadAvailableProjectSummariesFromDrive(
          googleAccessToken,
          googleProjectsFolderId,
        )

      setAvailableProjectSummaries(
        summaries,
      )
    } catch (error) {
      if (isGoogleUnauthorizedError(error)) {
        expireGoogleSession()
        return
      }

      setProjectChooserError(
        error instanceof Error
          ? error.message
          : 'Failed to load projects.',
      )
    } finally {
      setIsLoadingProjectSummaries(false)
    }
  }

  async function handleSelectProject(
    summary: DriveProjectSummary,
  ) {
    if (
      summary.projectFolderId ===
      googleProjectFolderId
    ) {
      setIsProjectChooserOpen(false)
      return
    }

    if (hasPendingProjectSaves()) {
      setProjectChooserError(
        'Wait for the current project to finish saving before switching projects.',
      )
      return
    }

    if (
      isInvitingMember ||
      removingMemberId !== null ||
      updatingMemberId !== null
    ) {
      setProjectChooserError(
        'Wait for the current member change to finish before switching projects.',
      )
      return
    }

    setOpeningProjectFolderId(
      summary.projectFolderId,
    )

    setProjectChooserError(null)

    try {
      await openDriveProject(
        summary.projectFolderId,
        summary.isOwned,
      )

      setIsProjectChooserOpen(false)
    } catch (error) {
      if (isGoogleUnauthorizedError(error)) {
        expireGoogleSession()
        return
      }

      setProjectChooserError(
        error instanceof Error
          ? error.message
          : 'Failed to open project.',
      )
    } finally {
      setOpeningProjectFolderId(null)
    }
  }

  async function handleOpenSharedProject() {
    if (!googleAccessToken) {
      setSharedProjectError(
        'Google Drive is not connected.',
      )

      return
    }

    if (hasPendingProjectSaves()) {
      setSharedProjectError(
        'Wait for the current project to finish saving before switching projects.',
      )

      return
    }

    if (
      isInvitingMember ||
      removingMemberId !== null ||
      updatingMemberId !== null
    ) {
      setSharedProjectError(
        'Wait for the current member change to finish before switching projects.',
      )

      return
    }

    setIsOpeningSharedProject(true)
    setSharedProjectError(null)

    try {
      const projectFolderId =
        await pickGoogleDriveFolder(
          googleAccessToken,
        )

      if (!projectFolderId) {
        return
      }

      if (hasPendingProjectSaves()) {
        setSharedProjectError(
          'Wait for the current project to finish saving before switching projects.',
        )

        return
      }

      await openDriveProject(
        projectFolderId,
        false,
      )
    } catch (error) {
      if (isGoogleUnauthorizedError(error)) {
        expireGoogleSession()
        return
      }

      setSharedProjectError(
        error instanceof Error
          ? error.message
          : 'Failed to open the selected project.',
      )
    } finally {
      setIsOpeningSharedProject(false)
    }
  }

  async function connectGoogleWithToken(
    accessToken: string,
  ) {
    await verifyGoogleDriveAccess(accessToken)

    const connectedGoogleUser =
      await getGoogleDriveUser(accessToken)

    setGoogleUser(connectedGoogleUser)

    const datsFolderId =
      await ensureDatsDriveFolder(accessToken)

    const projectsFolderId =
      await ensureProjectsDriveFolder(
        accessToken,
        datsFolderId,
      )

    setGoogleProjectsFolderId(
      projectsFolderId,
    )

    let loadedFromOwnedProjectSearch = false

    let loadedDriveProject =
      await loadFirstRememberedProjectFromDrive(
        accessToken,
        projectsFolderId,
      )

    if (!loadedDriveProject) {
      loadedDriveProject =
        await loadFirstProjectFromDrive(
          accessToken,
          projectsFolderId,
        )

      loadedFromOwnedProjectSearch =
        loadedDriveProject !== null
    }

    if (!loadedDriveProject) {
      const blankProject =
        createBlankProject()

      blankProject.members = [
        {
          id: connectedGoogleUser.permissionId,
          displayName: connectedGoogleUser.displayName,
          role: '',
          email: connectedGoogleUser.emailAddress,
          accessRole: 'owner',
        },
      ]

      const location =
        await createProjectOnDrive(
          accessToken,
          projectsFolderId,
          blankProject,
        )

      loadedDriveProject = {
        project: blankProject,
        ...location,
      }

      loadedFromOwnedProjectSearch = true
    }

    const activeProject =
      loadedDriveProject.project

    const hasProjectOwner =
      activeProject.members.some(
        (member) =>
          member.accessRole === 'owner',
      )

    if (
      loadedFromOwnedProjectSearch &&
      !hasProjectOwner
    ) {
      activeProject.members = [
        ...activeProject.members,
        {
          id: connectedGoogleUser.permissionId,
          displayName: connectedGoogleUser.displayName,
          role: '',
          email: connectedGoogleUser.emailAddress,
          accessRole: 'owner',
        },
      ]
    }

    await rememberProjectFolder(
      accessToken,
      projectsFolderId,
      loadedDriveProject.projectFolderId,
    )

    activateDriveProject(
      loadedDriveProject,
    )

    setGoogleAccessToken(accessToken)
  }

  useEffect(() => {
    tasksRef.current = tasks
  }, [tasks])

  useEffect(() => {
    if (
      isDemoMode ||
      !googleAccessToken ||
      !googleProjectFolderId ||
      !googleUser
    ) {
      return
    }

    const accessToken =
      googleAccessToken

    const projectFolderId =
      googleProjectFolderId

    const googlePermissionId =
      googleUser.permissionId

    let isChecking = false
    let isCancelled = false

    async function syncRemoteProjectMetadata() {
      if (
        isChecking ||
        hasPendingProjectSaves() ||
        isInvitingMember ||
        removingMemberId !== null ||
        updatingMemberId !== null
      ) {
        return
      }

      isChecking = true

      try {
        const remoteMetadata =
          await loadProjectMetadataFromDrive(
            accessToken,
            projectFolderId,
          )

        if (isCancelled) {
          return
        }

        if (!remoteMetadata) {
          setProjectSyncError(
            'Google Drive project metadata could not be found.',
          )

          return
        }

        setProject((currentProject) => {
          const metadataMatches =
            currentProject.schemaVersion ===
            remoteMetadata.schemaVersion &&
            currentProject.id ===
            remoteMetadata.id &&
            currentProject.name ===
            remoteMetadata.name &&
            JSON.stringify(
              currentProject.members,
            ) ===
            JSON.stringify(
              remoteMetadata.members,
            )

          if (metadataMatches) {
            return currentProject
          }

          return {
            ...currentProject,
            schemaVersion:
              remoteMetadata.schemaVersion,
            id:
              remoteMetadata.id,
            name:
              remoteMetadata.name,
            members:
              remoteMetadata.members,
          }
        })

        setProjectSyncError(null)
      } catch (error) {
        if (isCancelled) {
          return
        }

        if (isGoogleUnauthorizedError(error)) {
          expireGoogleSession()
          return
        }

        if (
          error instanceof Error &&
          error.message.includes('status 403')
        ) {
          setProject((currentProject) => ({
            ...currentProject,

            members:
              currentProject.members.filter(
                (member) =>
                  member.id !==
                  googlePermissionId,
              ),
          }))

          setProjectSyncError(
            'You no longer have access to this project.',
          )

          return
        }

        setProjectSyncError(
          error instanceof Error
            ? error.message
            : 'Project metadata sync failed.',
        )
      } finally {
        isChecking = false
      }
    }

    void syncRemoteProjectMetadata()

    const interval =
      window.setInterval(() => {
        void syncRemoteProjectMetadata()
      }, 3000)

    return () => {
      isCancelled = true
      window.clearInterval(interval)
    }
  }, [
    isDemoMode,
    googleAccessToken,
    googleProjectFolderId,
    googleUser,
    isInvitingMember,
    removingMemberId,
    updatingMemberId,
  ])

  useEffect(() => {
    if (
      isDemoMode ||
      !googleAccessToken ||
      !googleTasksFolderId
    ) {
      return
    }

    const accessToken =
      googleAccessToken

    const tasksFolderId =
      googleTasksFolderId

    let isChecking = false
    let isCancelled = false

    async function syncRemoteTasks() {
      if (
        isChecking ||
        hasPendingProjectSaves()
      ) {
        return
      }

      isChecking = true

      try {
        const remoteTasks =
          await loadTasksFromDrive(
            accessToken,
            tasksFolderId,
            false,
          )

        if (isCancelled) {
          return
        }

        const localTasks =
          tasksRef.current

        const lastSyncedTasks =
          lastSavedTasksRef.current

        const baseById =
          new Map(
            lastSyncedTasks.map(
              (task) => [task.id, task],
            ),
          )

        const localById =
          new Map(
            localTasks.map(
              (task) => [task.id, task],
            ),
          )

        const remoteById =
          new Map(
            remoteTasks.map(
              (task) => [task.id, task],
            ),
          )

        const allTaskIds =
          new Set([
            ...baseById.keys(),
            ...localById.keys(),
            ...remoteById.keys(),
          ])

        const mergedTasks: Task[] = []
        const nextSyncedTasks: Task[] = []
        const conflicts: TaskSyncConflict[] = []

        for (const taskId of allTaskIds) {
          const baseTask =
            baseById.get(taskId)

          const localTask =
            localById.get(taskId)

          const remoteTask =
            remoteById.get(taskId)

          const localChanged =
            !taskVersionsMatch(
              localTask,
              baseTask,
            )

          const remoteChanged =
            !taskVersionsMatch(
              remoteTask,
              baseTask,
            )

          const localAndRemoteMatch =
            taskVersionsMatch(
              localTask,
              remoteTask,
            )

          if (
            localChanged &&
            remoteChanged &&
            !localAndRemoteMatch
          ) {
            conflicts.push({
              taskId,
              localTask:
                localTask ?? null,
              remoteTask:
                remoteTask ?? null,
            })

            if (localTask) {
              mergedTasks.push(localTask)
            }

            if (baseTask) {
              nextSyncedTasks.push(baseTask)
            }

            continue
          }

          if (
            remoteChanged &&
            !localChanged
          ) {
            if (remoteTask) {
              mergedTasks.push(remoteTask)
              nextSyncedTasks.push(remoteTask)
            }

            continue
          }

          if (
            localChanged &&
            !remoteChanged
          ) {
            if (localTask) {
              mergedTasks.push(localTask)
            }

            if (baseTask) {
              nextSyncedTasks.push(baseTask)
            }

            continue
          }

          if (
            localChanged &&
            remoteChanged &&
            localAndRemoteMatch
          ) {
            if (localTask) {
              mergedTasks.push(localTask)
              nextSyncedTasks.push(localTask)
            }

            continue
          }

          if (localTask) {
            mergedTasks.push(localTask)
          }

          if (baseTask) {
            nextSyncedTasks.push(baseTask)
          }
        }

        if (
          !taskListsMatch(
            tasksRef.current,
            localTasks,
          ) ||
          !taskListsMatch(
            lastSavedTasksRef.current,
            lastSyncedTasks,
          )
        ) {
          return
        }

        taskSyncConflictIdsRef.current =
          new Set(
            conflicts.map(
              (conflict) =>
                conflict.taskId,
            ),
          )

        setTaskSyncConflicts(conflicts)

        lastSavedTasksRef.current =
          nextSyncedTasks

        if (
          !taskListsMatch(
            mergedTasks,
            localTasks,
          )
        ) {
          tasksRef.current =
            mergedTasks

          setTasks(mergedTasks)
        }

        setSyncError(null)
      } catch (error) {
        if (isCancelled) {
          return
        }

        if (
          isGoogleUnauthorizedError(error)
        ) {
          expireGoogleSession()
          return
        }

        setSyncError(
          error instanceof Error
            ? error.message
            : 'Google Drive sync failed.',
        )
      } finally {
        isChecking = false
      }
    }

    void syncRemoteTasks()

    const interval =
      window.setInterval(() => {
        void syncRemoteTasks()
      }, 3000)

    return () => {
      isCancelled = true
      window.clearInterval(interval)
    }
  }, [
    isDemoMode,
    googleAccessToken,
    googleTasksFolderId,
  ])

  useEffect(() => {
    if (
      activeView === 'mine' &&
      !googleUser
    ) {
      setActiveView('board')
    }
  }, [
    activeView,
    googleUser,
  ])

  async function handleConnectGoogle(
    forceNewToken = false,
  ) {
    const previousAccessToken =
      googleAccessToken

    const previousExpiresAt =
      googleTokenExpiresAt

    setIsGoogleConnecting(true)
    setGoogleAuthError(null)

    try {
      const storedAccessToken =
        forceNewToken
          ? null
          : getStoredGoogleAccessToken()

      const accessToken =
        storedAccessToken ??
        await requestGoogleAccessToken()

      setGoogleTokenExpiresAt(
        getStoredGoogleAccessTokenExpiresAt(),
      )

      if (isDemoMode) {
        await connectGoogleWithToken(
          accessToken,
        )

        setHasChosenMode(true)
      } else {
        await verifyGoogleDriveAccess(
          accessToken,
        )

        setGoogleAccessToken(
          accessToken,
        )

        setSaveError(null)
        setSaveStatus('idle')
      }
    } catch (error) {
      const previousTokenStillValid =
        forceNewToken &&
        previousAccessToken !== null &&
        previousExpiresAt !== null &&
        Date.now() < previousExpiresAt

      if (previousTokenStillValid) {
        setGoogleAccessToken(
          previousAccessToken,
        )

        setGoogleTokenExpiresAt(
          previousExpiresAt,
        )
      } else {
        setGoogleAccessToken(null)
        setGoogleTokenExpiresAt(null)
        setGoogleTokenMinutesRemaining(null)
      }

      setGoogleAuthError(
        error instanceof Error
          ? error.message
          : 'Google authorization failed.',
      )
    } finally {
      setIsGoogleConnecting(false)
    }
  }

  function handleEnterDemo() {
    setIsDemoMode(true)
    setHasChosenMode(true)
  }

  if (
    isGoogleConnecting &&
    isDemoMode
  ) {
    return (
      <main className="app-loading">
        <div className="app-loading__content">
          <h1>
            Dat&apos;s: Better Kanban
            <span className="app-version">
              v{APP_VERSION}
            </span>
          </h1>
          <p>Loading your project from Google Drive…</p>

          <div
            className="app-loading__bar"
            role="progressbar"
            aria-label="Loading project"
          >
            <div className="app-loading__bar-fill" />
          </div>
        </div>
      </main>
    )
  }
  if (!hasChosenMode) {
    return (
      <main className="welcome-screen">
        <section className="welcome-screen__content">
          <img
            className="welcome-screen__logo"
            src="/favicon.png"
            alt="favicon"
          />
          <p className="product-name">
            Dat&apos;s: Better Kanban
            <span className="app-version">
              v{APP_VERSION}
            </span>
          </p>

          <h1>
            Project management,
            built around your workflow.
          </h1>

          <p className="welcome-screen__description">
            Dat&apos;s: Better Kanban is a customizable
            project-management tool for organizing tasks,
            priorities, deadlines, pipelines, timelines,
            and completed work.
          </p>

          <div className="welcome-screen__choices">
            <button
              className="welcome-choice"
              type="button"
              onClick={handleEnterDemo}
            >
              <strong>Try Demo</strong>

              <span>
                Explore Dat&apos;s with a sample project.
                Demo changes are not saved.
              </span>
            </button>

            <button
              className="welcome-choice"
              type="button"
              onClick={() => {
                void handleConnectGoogle()
              }}
            >
              <strong>Connect Google Drive</strong>

              <span>
                Load and save your project using your
                own Google Drive.
              </span>
            </button>
          </div>

          <p className="welcome-screen__storage-note">
            Your project files are stored in your Google Drive,
            not in a central Dat&apos;s project database.
          </p>

          {googleAuthError && (
            <p className="google-auth-error">
              {googleAuthError}
            </p>
          )}

          {sharedProjectError && (
            <p className="google-auth-error">
              {sharedProjectError}
            </p>
          )}

        </section>
      </main>
    )

  }

  function isGoogleUnauthorizedError(
    error: unknown,
  ) {
    return (
      error instanceof Error &&
      error.message.includes('status 401')
    )
  }

  function expireGoogleSession() {
    clearStoredGoogleAccessToken()

    setGoogleAccessToken(null)
    setGoogleUser(null)

    setGoogleTokenExpiresAt(null)
    setGoogleTokenMinutesRemaining(0)

    pendingSavesRef.current = 0

    setSaveStatus('error')

    setSaveError(
      'Google Drive session expired. Reconnect to continue saving.',
    )
  }

  async function handleUploadImage(
    file: File,
  ): Promise<Attachment> {
    if (isDemoMode) {
      return {
        id: crypto.randomUUID(),
        fileName: file.name,
        mimeType: file.type,
        previewUrl:
          URL.createObjectURL(file),
      }
    }

    if (
      !googleAccessToken ||
      !googleAttachmentsFolderId
    ) {
      throw new Error(
        'Google Drive is not ready for image uploads.',
      )
    }

    const driveFileId =
      await uploadAttachmentToDrive(
        googleAccessToken,
        googleAttachmentsFolderId,
        file,
      )

    return {
      id: crypto.randomUUID(),
      fileName: file.name,
      mimeType:
        file.type ||
        'application/octet-stream',
      driveFileId,
    }
  }

  async function handleUploadMedia(
    files: File[],
  ): Promise<Attachment[]> {
    if (!canCurrentUserEditProject) {
      throw new Error(
        'You do not have permission to upload attachments to this project.',
      )
    }

    const uploadResults =
      await Promise.allSettled(
        files.map((file) =>
          handleUploadImage(file),
        ),
      )

    const uploadedAttachments =
      uploadResults.flatMap(
        (result) =>
          result.status === 'fulfilled'
            ? [result.value]
            : [],
      )

    const failedUpload =
      uploadResults.find(
        (result) =>
          result.status === 'rejected',
      )

    if (!failedUpload) {
      return uploadedAttachments
    }

    const cleanupResults =
      await Promise.allSettled(
        uploadedAttachments.map(
          async (attachment) => {
            if (isDemoMode) {
              if (attachment.previewUrl) {
                URL.revokeObjectURL(
                  attachment.previewUrl,
                )
              }

              return
            }

            if (
              !googleAccessToken ||
              !attachment.driveFileId
            ) {
              return
            }

            await deleteAttachmentFromDrive(
              googleAccessToken,
              attachment.driveFileId,
            )
          },
        ),
      )

    for (const cleanupResult of cleanupResults) {
      if (
        cleanupResult.status ===
        'rejected'
      ) {
        console.error(
          'Failed to clean up an attachment after a batch upload failure:',
          cleanupResult.reason,
        )
      }
    }

    if (
      failedUpload.status ===
      'rejected' &&
      failedUpload.reason instanceof Error
    ) {
      throw failedUpload.reason
    }

    throw new Error(
      'Media upload failed.',
    )
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <p className="product-name">
            Dat&apos;s: Better Kanban
            <span className="app-version">
              v{APP_VERSION}
            </span>
          </p>

          <input
            className="project-title-input"
            type="text"
            value={project.name}
            readOnly={!canCurrentUserEditProjectSettings}
            onChange={(event) => {
              setProject((currentProject) => ({
                ...currentProject,
                name: event.target.value,
              }))
            }}
            aria-label="Project name"
          />

          <p className="app-description">
            A customizable Kanban project-management tool for organizing
            tasks, timelines, and project workflows.
          </p>
        </div>

        <div className="app-header__actions">
          {isCurrentUserProjectOwner &&
            !isDemoMode &&
            googleAccessToken && (
              <button
                type="button"
                className="google-connect-button"
                onClick={() => {
                  setIsProjectChooserOpen(false)

                  setIsMemberPanelOpen(
                    (currentValue) => !currentValue,
                  )
                }}
              >
                {isMemberPanelOpen
                  ? 'Close Members'
                  : `Members (${currentProject.members.length})`}
              </button>
            )}

          {!isDemoMode &&
            googleAccessToken && (
              <button
                type="button"
                className="google-connect-button"
                disabled={
                  isOpeningSharedProject ||
                  isLoadingProjectSummaries
                }
                onClick={() => {
                  void handleToggleProjectChooser()
                }}
              >
                {isProjectChooserOpen
                  ? 'Close Projects'
                  : 'Projects'}
              </button>
            )}

          <a
            className="privacy-policy-button"
            href="/privacy.html"
          >
            Privacy Policy
          </a>

          <button
            type="button"
            className="google-connect-button"
            onClick={() => {
              void handleConnectGoogle()
            }}
            disabled={
              isGoogleConnecting ||
              googleAccessToken !== null
            }
          >
            {isGoogleConnecting
              ? 'Connecting...'
              : googleAccessToken
                ? 'Google Drive Connected'
                : isDemoMode
                  ? 'Connect Google Drive'
                  : 'Reconnect Google Drive'}
          </button>

          {!isDemoMode && (
            <span className="save-status">
              {taskSyncConflicts.length > 0
                ? `Sync conflict (${taskSyncConflicts.length})`
                : syncError || projectSyncError
                  ? 'Sync failed'
                  : saveStatus === 'saving'
                    ? 'Saving…'
                    : saveStatus === 'saved'
                      ? 'Saved'
                      : saveStatus === 'error'
                        ? 'Save failed'
                        : ''}
            </span>
          )}

          {isDemoMode && (
            <span className="demo-badge">
              Demo Mode
            </span>
          )}
        </div>
      </header>

      {isProjectChooserOpen &&
        !isDemoMode && (
          <section className="project-chooser">
            <div className="project-chooser__header">
              <div>
                <h2>Projects</h2>

                <p>
                  Switch between your remembered
                  and owned projects.
                </p>
              </div>

              <button
                type="button"
                className="google-connect-button"
                disabled={
                  isOpeningSharedProject ||
                  openingProjectFolderId !== null
                }
                onClick={() => {
                  void handleOpenSharedProject()
                }}
              >
                {isOpeningSharedProject
                  ? 'Opening...'
                  : 'Open another Drive project'}
              </button>
            </div>

            {projectChooserError && (
              <p className="save-error">
                {projectChooserError}
              </p>
            )}

            {isLoadingProjectSummaries ? (
              <p className="project-chooser__status">
                Loading projects…
              </p>
            ) : (
              <div className="project-chooser__list">
                {availableProjectSummaries.map(
                  (summary) => {
                    const isCurrentProject =
                      summary.projectFolderId ===
                      googleProjectFolderId

                    const member =
                      googleUser
                        ? summary.metadata.members.find(
                          (projectMember) =>
                            projectMember.id ===
                            googleUser.permissionId,
                        )
                        : undefined

                    const accessLabel =
                      summary.isOwned
                        ? 'Owner'
                        : member?.accessRole ??
                        'Shared'

                    return (
                      <button
                        key={
                          summary.projectFolderId
                        }
                        type="button"
                        className={`project-chooser__project ${isCurrentProject
                          ? 'project-chooser__project--current'
                          : ''
                          }`}
                        disabled={
                          isCurrentProject ||
                          openingProjectFolderId !==
                          null
                        }
                        onClick={() => {
                          void handleSelectProject(
                            summary,
                          )
                        }}
                      >
                        <strong>
                          {summary.metadata.name}
                        </strong>

                        <span>
                          {isCurrentProject
                            ? 'Current project'
                            : openingProjectFolderId ===
                              summary.projectFolderId
                              ? 'Opening…'
                              : accessLabel}
                        </span>
                      </button>
                    )
                  },
                )}
              </div>
            )}
          </section>
        )}

      {isMemberPanelOpen &&
        isCurrentUserProjectOwner && (
          <section className="member-panel">
            <h2>Project Members</h2>

            <div className="member-panel__invite">
              <input
                type="email"
                value={memberEmail}
                placeholder="member@example.com"
                aria-label="Member email"
                disabled={isInvitingMember}
                onChange={(event) =>
                  setMemberEmail(event.target.value)
                }
              />

              <select
                value={memberAccessRole}
                disabled={isInvitingMember}
                onChange={(event) =>
                  setMemberAccessRole(
                    event.target.value as
                    'editor' | 'viewer',
                  )
                }
              >
                <option value="editor">
                  Editor
                </option>

                <option value="viewer">
                  Viewer
                </option>
              </select>

              <button
                type="button"
                disabled={
                  !memberEmail.trim() ||
                  isInvitingMember
                }
                onClick={() => {
                  void handleInviteMember()
                }}
              >
                {isInvitingMember
                  ? 'Adding...'
                  : 'Add Member'}
              </button>
            </div>

            {memberInviteError && (
              <p className="save-error">
                {memberInviteError}
              </p>
            )}

            {currentProject.members.map(
              (member) => (
                <div key={member.id}>
                  <strong>
                    {member.displayName}
                  </strong>

                  {member.accessRole === 'owner' ? (
                    <span>
                      {' '}
                      — owner
                    </span>
                  ) : (
                    <select
                      value={
                        member.accessRole === 'editor'
                          ? 'editor'
                          : 'viewer'
                      }
                      disabled={
                        updatingMemberId !== null ||
                        removingMemberId !== null
                      }
                      onChange={(event) => {
                        void handleUpdateMemberAccessRole(
                          member.id,
                          event.target.value as
                          'editor' | 'viewer',
                        )
                      }}
                    >
                      <option value="editor">
                        Editor
                      </option>

                      <option value="viewer">
                        Viewer
                      </option>
                    </select>
                  )}

                  {member.email && (
                    <span>
                      {' '}
                      — {member.email}
                    </span>
                  )}

                  {member.accessRole !== 'owner' && (
                    <button
                      type="button"
                      disabled={
                        removingMemberId !== null ||
                        updatingMemberId !== null
                      }
                      onClick={() => {
                        void handleRemoveMember(
                          member.id,
                        )
                      }}
                    >
                      {removingMemberId === member.id
                        ? 'Removing...'
                        : 'Remove'}
                    </button>
                  )}
                </div>
              ),
            )}
          </section>
        )}

      {!isDemoMode &&
        googleAccessToken &&
        googleTokenMinutesRemaining !== null &&
        googleTokenMinutesRemaining <= 10 && (
          <div className="google-session-warning">
            <span>
              Google Drive session expires in{' '}
              <strong>
                {googleTokenMinutesRemaining} min
              </strong>
              . Reconnect to keep saving uninterrupted.
            </span>

            <button
              type="button"
              onClick={() => {
                void handleConnectGoogle(true)
              }}
              disabled={isGoogleConnecting}
            >
              {isGoogleConnecting
                ? 'Reconnecting...'
                : 'Reconnect'}
            </button>
          </div>
        )}

      {googleAuthError && (
        <p className="google-auth-error">
          {googleAuthError}
        </p>
      )}

      {sharedProjectError && (
        <p className="google-auth-error">
          {sharedProjectError}
        </p>
      )}

      {saveError && (
        <p className="save-error">
          {saveError}
        </p>
      )}

      {syncError && (
        <p className="save-error">
          {syncError}
        </p>
      )}

      {projectSyncError && (
        <p className="save-error">
          {projectSyncError}
        </p>
      )}

      <div className="board-toolbar">
        <nav className="view-tabs">
          <button
            type="button"
            onClick={() => setActiveView('board')}
          >
            Board
          </button>

          <button
            type="button"
            onClick={() => setActiveView('timeline')}
          >
            Timeline
          </button>

          {!isDemoMode && googleUser && (
            <button
              type="button"
              onClick={() =>
                setActiveView('mine')
              }
            >
              My Tasks
            </button>
          )}

          <button
            type="button"
            onClick={() => setActiveView('history')}
          >
            Completed History
          </button>
        </nav>

        {activeView !== 'mine' && (
          <label className="assignee-filter">
            <span>Assignee</span>

            <select
              value={assigneeFilter}
              onChange={(event) =>
                setAssigneeFilter(
                  event.target.value,
                )
              }
            >
              <option value="all">
                Everyone
              </option>

              <option value="unassigned">
                Unassigned
              </option>

              {[...currentProject.members]
                .sort((firstMember, secondMember) =>
                  firstMember.displayName.localeCompare(
                    secondMember.displayName,
                  ),
                )
                .map((member) => (
                  <option
                    key={member.id}
                    value={member.id}
                  >
                    {member.displayName}
                  </option>
                ))}
            </select>
          </label>
        )}

        {(
          activeView === 'board' ||
          activeView === 'timeline'
        ) && (
            <label className="task-sort">
              <span>Sort</span>

              <select
                value={taskSortMode}
                onChange={(event) =>
                  setTaskSortMode(
                    event.target.value as
                    'priority' | 'assignee',
                  )
                }
              >
                <option value="priority">
                  Priority / Deadline
                </option>

                <option value="assignee">
                  Assignee
                </option>
              </select>
            </label>
          )}

        {activeView === 'board' &&
          canCurrentUserEditProject && (
            <div className="board-toolbar__edit-controls">
              <button
                type="button"
                className={`pipeline-controls__button ${isPipelineEditing
                  ? 'pipeline-controls__button--active'
                  : ''
                  }`}
                onClick={() => {
                  setIsPipelineEditing(
                    (currentValue) => !currentValue,
                  )
                  setIsTaskEditing(false)
                  setEditingTaskId(null)
                  setCreatingTaskColumnId(null)
                }}
              >
                {isPipelineEditing
                  ? 'Exit Pipeline Edit Mode'
                  : 'Edit Pipeline'}
              </button>

              <button
                type="button"
                className={`pipeline-controls__button ${isTaskEditing
                  ? 'pipeline-controls__button--active'
                  : ''
                  }`}
                onClick={() => {
                  setIsTaskEditing(
                    (currentValue) => !currentValue,
                  )
                  setIsPipelineEditing(false)
                  setEditingTaskId(null)
                  setCreatingTaskColumnId(null)
                }}
              >
                {isTaskEditing
                  ? 'Exit Task Edit Mode'
                  : 'Edit Tasks'}
              </button>

              {isPipelineEditing && (
                <button
                  type="button"
                  className="pipeline-controls__button pipeline-controls__button--secondary"
                  onClick={handleAddColumn}
                  disabled={columns.length >= 100}
                >
                  + Add Section
                </button>
              )}
            </div>
          )}
      </div>

      {activeView === 'board' && (
        <DragDropProvider
          onDragEnd={(event) => {
            if (event.canceled) {
              return
            }

            if (isPipelineEditing) {
              const source = event.operation.source

              if (!isSortable(source)) {
                return
              }

              handleMoveColumn(
                source.initialIndex,
                source.index,
              )

              return
            }

            if (!isTaskEditing) {
              return
            }

            const sourceId = event.operation.source?.id
            const targetId = event.operation.target?.id

            if (sourceId === undefined || targetId === undefined) {
              return
            }

            handleMoveTask(
              String(sourceId),
              String(targetId),
            )
          }}
        >
          <section
            className={`kanban-board ${orderedColumns.length > 6
              ? 'kanban-board--scrolling'
              : ''
              }`}
            aria-label={`${currentProject.name} Kanban board`}
          >
            {orderedColumns.map((column) => {
              const columnTasks =
                tasks.filter(
                  (task) =>
                    task.columnId === column.id &&
                    (
                      isPipelineEditing ||
                      matchesAssigneeFilter(task)
                    ),
                )

              const sortedColumnTasks =
                [...columnTasks].sort(
                  column.countsAsCompleted &&
                    column.usePriorityDeadlineOrdering !== true &&
                    taskSortMode === 'priority'
                    ? compareCompletedTasks
                    : compareVisibleTasks,
                )

              return (
                <KanbanColumn
                  key={column.id}
                  column={column}
                  tasks={sortedColumnTasks}
                  members={currentProject.members}
                  isPipelineEditing={isPipelineEditing}
                  onColumnTitleChange={handleColumnTitleChange}
                  onColumnCompletionChange={handleColumnCompletionChange}
                  onDeleteColumn={handleDeleteColumn}
                  isCreatingTask={creatingTaskColumnId === column.id}
                  onStartCreatingTask={() => {
                    setEditingTaskId(null)
                    setCreatingTaskColumnId(column.id)
                  }}
                  onCreateTask={(taskInput) =>
                    handleCreateTask(column.id, taskInput)
                  }
                  onCancelCreatingTask={() =>
                    setCreatingTaskColumnId(null)
                  }
                  editingTaskId={editingTaskId}
                  onStartEditingTask={(taskId) => {
                    setCreatingTaskColumnId(null)
                    setEditingTaskId(taskId)
                  }}
                  onUpdateTask={(taskId, taskInput) =>
                    handleUpdateTask(taskId, taskInput)
                  }
                  onCancelEditingTask={() =>
                    setEditingTaskId(null)
                  }
                  onDeleteTask={(taskId) =>
                    handleDeleteTask(taskId)
                  }
                  onUploadMedia={handleUploadMedia}
                  onLoadAttachment={handleLoadAttachment}
                  onColumnOrderingChange={
                    handleColumnOrderingChange
                  }
                  isTaskEditing={isTaskEditing}
                />
              )
            })}
          </section>
        </DragDropProvider>
      )}

      {activeView === 'mine' && (
        <section className="my-tasks-view">
          <h2>My Tasks</h2>

          {myTasks.length === 0 ? (
            <p className="my-tasks-view__empty">
              No active tasks are assigned to you.
            </p>
          ) : (
            <div className="my-tasks-list">
              {myTasks.map((task, index) => {
                const taskColumn =
                  columns.find(
                    (column) =>
                      column.id === task.columnId,
                  )

                const assignee =
                  currentProject.members.find(
                    (member) =>
                      member.id === task.assigneeId,
                  ) ?? null

                return (
                  <div
                    key={task.id}
                    className="my-tasks-item"
                  >
                    <p className="my-tasks-item__column">
                      {taskColumn?.title ??
                        'Unknown section'}
                    </p>

                    <TaskCard
                      task={task}
                      assignee={assignee}
                      taskNumber={index + 1}
                      isPipelineEditing={false}
                      isEditing={false}
                      isTaskEditing={false}
                      onEdit={() => { }}
                      onLoadAttachment={
                        handleLoadAttachment
                      }
                    />
                  </div>
                )
              })}
            </div>
          )}
        </section>
      )}

      {activeView === 'timeline' && (
        <section
          className="timeline-view"
          onWheel={handleTimelineWheel}
        >
          <h2>Timeline</h2>

          <div className="timeline-list">
            {timelineGroups.map((group) => (
              <div
                key={group[0].id}
                className="timeline-group"
              >
                <div className="timeline-group__cards">
                  {group.map((task) => (
                    <article
                      key={task.id}
                      className="timeline-item"
                    >
                      <div className="timeline-item__content">
                        {task.deadline && (
                          <p className="timeline-item__deadline">
                            {formatDeadline(task.deadline)}
                          </p>
                        )}

                        <h3>{task.title}</h3>

                        <p
                          className={`timeline-item__priority timeline-item__priority--${task.priority}`}
                        >
                          {task.priority}
                        </p>
                      </div>
                    </article>
                  ))}
                </div>

                <div className="timeline-group__marker" />
              </div>
            ))}
          </div>
        </section>
      )}

      {activeView === 'history' && (
        <section className="history-view">
          <h2>Completed History</h2>

          <div className="history-list">
            {completedTasks.map((task) => (
              <article
                key={task.id}
                className="history-item"
              >
                <div>
                  <h3>{task.title}</h3>

                  <p className="history-item__completed-at">
                    {task.completedAt
                      ? formatCompletedAt(task.completedAt)
                      : 'Completion time unknown'}
                  </p>
                </div>

                <span
                  className={`timeline-item__priority timeline-item__priority--${task.priority}`}
                >
                  {task.priority}
                </span>
              </article>
            ))}
          </div>
        </section>
      )}
    </main>
  )

  function handleMoveTask(taskId: string, targetColumnId: string) {
    if (!canCurrentUserEditProject) {
      return
    }

    const task = tasks.find((task) => task.id === taskId)
    const targetColumn = columns.find(
      (column) => column.id === targetColumnId,
    )

    if (!task || !targetColumn) {
      return
    }

    const currentColumn = columns.find(
      (column) => column.id === task.columnId,
    )

    if (!currentColumn) {
      return
    }

    const leavingCompleted =
      currentColumn.countsAsCompleted &&
      !targetColumn.countsAsCompleted

    if (leavingCompleted) {
      const confirmed = window.confirm(
        'This task will be removed from Completed History. Continue?',
      )

      if (!confirmed) {
        return
      }
    }

    const updatedTask = moveTaskToColumn(
      task,
      currentColumn,
      targetColumn,
      new Date().toISOString(),
    )

    setTasks((currentTasks) =>
      currentTasks.map((currentTask) =>
        currentTask.id === taskId
          ? updatedTask
          : currentTask,
      ),
    )
  }

  function taskListsMatch(
    firstTasks: Task[],
    secondTasks: Task[],
  ) {
    if (
      firstTasks.length !==
      secondTasks.length
    ) {
      return false
    }

    const secondTasksById =
      new Map(
        secondTasks.map(
          (task) => [task.id, task],
        ),
      )

    return firstTasks.every((task) => {
      const matchingTask =
        secondTasksById.get(task.id)

      return (
        matchingTask !== undefined &&
        JSON.stringify(task) ===
        JSON.stringify(matchingTask)
      )
    })
  }

  async function handleInviteMember() {
    const emailAddress =
      memberEmail.trim().toLowerCase()

    if (
      !emailAddress ||
      !isCurrentUserProjectOwner ||
      !googleAccessToken ||
      !googleProjectFolderId ||
      !googleProjectsFolderId
    ) {
      return
    }

    const alreadyMember =
      currentProject.members.some(
        (member) =>
          member.email?.toLowerCase() ===
          emailAddress,
      )

    if (alreadyMember) {
      setMemberInviteError(
        'That user is already a project member.',
      )
      return
    }

    setIsInvitingMember(true)
    setMemberInviteError(null)

    let permissionId: string | null = null

    try {
      permissionId =
        await shareProjectFolderWithUser(
          googleAccessToken,
          googleProjectFolderId,
          emailAddress,
          memberAccessRole,
        )

      const nextProject = {
        ...project,

        members: [
          ...project.members,
          {
            id: permissionId,
            displayName: emailAddress,
            role: '',
            email: emailAddress,
            accessRole: memberAccessRole,
          },
        ],
      }

      await saveProjectMetadataToDrive(
        googleAccessToken,
        googleProjectsFolderId,
        googleProjectFolderId,
        nextProject,
      )

      setProject(nextProject)
      setMemberEmail('')
    } catch (error) {
      if (permissionId) {
        try {
          await removeProjectFolderPermission(
            googleAccessToken,
            googleProjectFolderId,
            permissionId,
          )
        } catch (rollbackError) {
          console.error(
            'Failed to roll back project permission:',
            rollbackError,
          )
        }
      }

      setMemberInviteError(
        error instanceof Error
          ? error.message
          : 'Failed to add project member.',
      )
    } finally {
      setIsInvitingMember(false)
    }
  }

  async function handleRemoveMember(
    memberId: string,
  ) {
    const member =
      currentProject.members.find(
        (member) => member.id === memberId,
      )

    if (
      !member ||
      member.accessRole === 'owner' ||
      !googleAccessToken ||
      !googleProjectFolderId ||
      !googleProjectsFolderId
    ) {
      return
    }

    const confirmed =
      window.confirm(
        `Remove ${member.displayName} from this project?`,
      )

    if (!confirmed) {
      return
    }

    setRemovingMemberId(member.id)
    setMemberInviteError(null)

    const nextProject = {
      ...project,

      members:
        project.members.filter(
          (projectMember) =>
            projectMember.id !== member.id,
        ),
    }

    let metadataUpdated = false

    try {
      await saveProjectMetadataToDrive(
        googleAccessToken,
        googleProjectsFolderId,
        googleProjectFolderId,
        nextProject,
      )

      metadataUpdated = true

      await removeProjectFolderPermission(
        googleAccessToken,
        googleProjectFolderId,
        member.id,
      )

      setProject(nextProject)
    } catch (error) {
      if (metadataUpdated) {
        try {
          await saveProjectMetadataToDrive(
            googleAccessToken,
            googleProjectsFolderId,
            googleProjectFolderId,
            project,
          )
        } catch (rollbackError) {
          console.error(
            'Failed to restore project member metadata:',
            rollbackError,
          )
        }
      }

      setMemberInviteError(
        error instanceof Error
          ? error.message
          : 'Failed to remove project member.',
      )
    } finally {
      setRemovingMemberId(null)
    }
  }

  async function handleUpdateMemberAccessRole(
    memberId: string,
    nextAccessRole: 'editor' | 'viewer',
  ) {
    const member =
      currentProject.members.find(
        (member) => member.id === memberId,
      )

    if (
      !member ||
      member.accessRole === 'owner' ||
      (
        member.accessRole !== 'editor' &&
        member.accessRole !== 'viewer'
      ) ||
      member.accessRole === nextAccessRole ||
      !isCurrentUserProjectOwner ||
      !googleAccessToken ||
      !googleProjectFolderId ||
      !googleProjectsFolderId
    ) {
      return
    }

    const previousAccessRole =
      member.accessRole

    setUpdatingMemberId(member.id)
    setMemberInviteError(null)

    let drivePermissionUpdated = false

    try {
      await updateProjectFolderPermission(
        googleAccessToken,
        googleProjectFolderId,
        member.id,
        nextAccessRole,
      )

      drivePermissionUpdated = true

      const nextProject = {
        ...project,

        members:
          project.members.map(
            (projectMember) =>
              projectMember.id === member.id
                ? {
                  ...projectMember,
                  accessRole: nextAccessRole,
                }
                : projectMember,
          ),
      }

      await saveProjectMetadataToDrive(
        googleAccessToken,
        googleProjectsFolderId,
        googleProjectFolderId,
        nextProject,
      )

      setProject(nextProject)
    } catch (error) {
      if (drivePermissionUpdated) {
        try {
          await updateProjectFolderPermission(
            googleAccessToken,
            googleProjectFolderId,
            member.id,
            previousAccessRole,
          )
        } catch (rollbackError) {
          console.error(
            'Failed to restore previous Drive permission:',
            rollbackError,
          )
        }
      }

      setMemberInviteError(
        error instanceof Error
          ? error.message
          : 'Failed to update member access.',
      )
    } finally {
      setUpdatingMemberId(null)
    }
  }
}

export default App