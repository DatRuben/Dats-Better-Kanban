import './App.css'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { KanbanColumn } from './components/KanbanColumn'
import { demoProject } from './data/demoProject'
import type {
  Attachment,
  NewTaskInput,
  Project,
  Task,
} from './types/board'
import {
  mergeProjectDocuments,
} from './storage/projectDocumentMerge'
import type {
  TaskSyncConflict,
} from './storage/projectDocumentMerge'
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
  downloadAttachmentFromDrive,
  ensureDatsDriveFolder,
  ensureProjectsDriveFolder,
  loadFirstProjectFromDrive,
  loadFirstRememberedProjectFromDrive,
  loadProjectFromDriveFolder,
  loadAvailableProjectSummariesFromDrive,
  rememberProjectFolder,
  saveProjectMetadataToDrive,
  uploadAttachmentToDrive,
  verifyGoogleDriveAccess,
  deleteAttachmentFromDrive,
  getGoogleDriveUser,
  shareProjectFolderWithUser,
  removeProjectFolderPermission,
  updateProjectFolderPermission,
  saveProjectDocumentToDrive,
  DATS_PROJECT_DOCUMENT_FILE_NAME,
  loadProjectDocumentFromDrive,
  loadProjectFromDriveDocument,
  isProjectAttachmentsFolder,
} from './storage/googleDriveApi'
import type {
  GoogleDriveUser,
  LoadedDriveProject,
  DriveProjectSummary,
} from './storage/googleDriveApi'
import {
  pickGoogleDriveAttachmentFiles,
  pickGoogleDriveFolder,
  pickGoogleDriveProjectFile,
} from './storage/googleDrivePicker'
import { TaskCard } from './components/TaskCard'
import {
  TaskDetailsDialog,
} from './components/TaskDetailsDialog'
import {
  isGlbFileName,
  isPreviewableMedia,
} from './utility/attachmentTypes'
import {
  verifySelectedAttachmentAccess,
} from './storage/attachmentAuthorization'
import {
  getPendingUploads,
  recordPendingUpload,
  removePendingUpload,
  reconcilePendingUploads,
} from './storage/pendingAttachmentUploads'
import type {
  PendingAttachmentUpload,
} from './storage/pendingAttachmentUploads'
import { CompletedHistory } from './components/completedHistory'
import {
  processSharedAttachmentDeletions,
} from './storage/sharedAttachmentDeletion'



const priorityOrder = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
}

function getManualOrderKey(
  task: Task,
) {
  return (
    task.manualOrderKey ??
    `${task.createdAt}:${task.id}`
  )
}


function isGoogleUnauthorizedError(
  error: unknown,
): boolean {
  return (
    error instanceof Error &&
    error.message.includes('status 401')
  )
}

function isTokenStillValid(
  expiresAt: number,
): boolean {
  return Date.now() < expiresAt
}


function getRemainingTokenMinutes(
  expiresAt: number,
): number {
  return Math.max(
    0,
    Math.ceil(
      (expiresAt - Date.now()) / 60000,
    ),
  )
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

  if (
    !firstTask.deadline &&
    !secondTask.deadline
  ) {
    const manualOrderDifference =
      getManualOrderKey(
        firstTask,
      ).localeCompare(
        getManualOrderKey(
          secondTask,
        ),
      )

    if (manualOrderDifference !== 0) {
      return manualOrderDifference
    }
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

  const [
    googleProjectFileId,
    setGoogleProjectFileId,
  ] = useState<string | null>(null)

  const [
    googleAttachmentsFolderId,
    setGoogleAttachmentsFolderId,
  ] = useState<string | null>(null)

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

  const [
    isAuthorizingExistingAttachments,
    setIsAuthorizingExistingAttachments,
  ] = useState(false)

  const [
    attachmentAuthorizationStatus,
    setAttachmentAuthorizationStatus,
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

  const currentProject = useMemo(
    () => createProjectSnapshot(
      project,
      columns,
      tasks,
    ),
    [project, columns, tasks],
  )

  const currentProjectRef =
    useRef<Project>(
      currentProject,
    )

  const lastSyncedProjectRef =
    useRef<Project | null>(
      null,
    )

  const projectDocumentConflictRef =
    useRef(false)

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

  const [
    attachmentAccessRevision,
    setAttachmentAccessRevision,
  ] = useState(0)

  const [
    pendingUploads,
    setPendingUploads,
  ] = useState<PendingAttachmentUpload[]>([])

  const handleLoadAttachment =
    useCallback(
      async (
        driveFileId: string,
      ): Promise<Blob | null> => {
        void attachmentAccessRevision

        if (!googleAccessToken) {
          return null
        }

        return downloadAttachmentFromDrive(
          googleAccessToken,
          driveFileId,
        )
      },
      [
        googleAccessToken,
        attachmentAccessRevision,
      ],
    )


  const expireGoogleSession = useCallback(() => {
    clearStoredGoogleAccessToken()

    setGoogleAccessToken(null)
    setGoogleUser(null)

    setGoogleTokenExpiresAt(null)
    setGoogleTokenMinutesRemaining(0)
    setPendingUploads([])

    pendingSavesRef.current = 0

    setSaveStatus('error')
    setSaveError(
      'Google Drive session expired. Reconnect to continue saving.',
    )
  }, [])

  const beginSave = useCallback((): boolean => {
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
  }, [
    canCurrentUserEditProject,
    expireGoogleSession,
  ])


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

  const failSave = useCallback(
    (error: unknown): void => {
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
    },
    [expireGoogleSession],
  )


  useEffect(() => {
    if (
      !googleAccessToken ||
      !googleTokenExpiresAt
    ) {
      return
    }

    const interval = window.setInterval(() => {
      const millisecondsRemaining =
        googleTokenExpiresAt - Date.now()

      if (millisecondsRemaining <= 0) {
        expireGoogleSession()
        return
      }

      setGoogleTokenMinutesRemaining(
        Math.ceil(
          millisecondsRemaining / 60000,
        ),
      )
    }, 30000)

    return () => {
      window.clearInterval(interval)
    }
  }, [
    googleAccessToken,
    googleTokenExpiresAt,
    expireGoogleSession,
  ])


  useEffect(() => {
    currentProjectRef.current =
      currentProject
  }, [currentProject])

  useEffect(() => {
    if (
      isDemoMode ||
      !googleAccessToken ||
      !googleProjectFileId ||
      !canCurrentUserEditProject ||
      projectDocumentConflictRef.current
    ) {
      return
    }

    const baseline =
      lastSyncedProjectRef.current

    if (!baseline) {
      return
    }

    const localProject =
      currentProject

    if (
      JSON.stringify(localProject) ===
      JSON.stringify(baseline)
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

        void (async () => {
          const latestLocalProject =
            currentProjectRef.current

          const latestBaseline =
            lastSyncedProjectRef.current

          if (!latestBaseline) {
            completeSave()
            return
          }

          const remoteDocument =
            await loadProjectDocumentFromDrive(
              googleAccessToken,
              googleProjectFileId,
            )

          const mergeResult =
            mergeProjectDocuments(
              latestBaseline,
              latestLocalProject,
              remoteDocument.project,
              taskSyncConflictIdsRef.current,
            )

          if (mergeResult.projectConflict) {
            projectDocumentConflictRef.current =
              true
          }

          if (mergeResult.projectConflict) {
            setProjectSyncError(
              'The pipeline or project settings changed in two places at the same time. Reload the project before continuing.',
            )

            completeSave()
            return
          }

          taskSyncConflictIdsRef.current =
            new Set(
              mergeResult.taskConflicts.map(
                (conflict) =>
                  conflict.taskId,
              ),
            )

          setTaskSyncConflicts(
            mergeResult.taskConflicts,
          )

          if (
            JSON.stringify(
              mergeResult.projectToSave,
            ) !==
            JSON.stringify(
              remoteDocument.project,
            )
          ) {
            await saveProjectDocumentToDrive(
              googleAccessToken,
              googleProjectFileId,
              mergeResult.projectToSave,
            )
          }

          if (googleUser) {
            setPendingUploads(
              reconcilePendingUploads(
                googleUser.permissionId,
                googleProjectFileId,
                mergeResult.projectToSave,
              ),
            )
          }

          if (
            canCurrentUserEditProjectSettings &&
            googleProjectsFolderId &&
            googleProjectFolderId
          ) {
            try {
              await saveProjectMetadataToDrive(
                googleAccessToken,
                googleProjectsFolderId,
                googleProjectFolderId,
                mergeResult.projectToSave,
              )
            } catch (error) {
              console.error(
                'Failed to mirror legacy project metadata:',
                error,
              )
            }
          }

          lastSyncedProjectRef.current =
            mergeResult.projectToSave

          currentProjectRef.current =
            mergeResult.localProject

          setProject(
            mergeResult.localProject,
          )

          setColumns(
            mergeResult.localProject.columns,
          )

          setTasks(
            mergeResult.localProject.tasks,
          )

          setProjectSyncError(null)
          setSyncError(null)

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
    project,
    columns,
    tasks,
    isDemoMode,
    googleAccessToken,
    googleProjectFileId,
    googleProjectFolderId,
    googleProjectsFolderId,
    googleUser,
    canCurrentUserEditProject,
    canCurrentUserEditProjectSettings,
    currentProject,
    beginSave,
    failSave,
  ])



  function queueAttachmentDeletions(
    attachments: Attachment[],
  ) {
    if (isDemoMode) {
      return
    }

    const fileIds = [
      ...new Set(
        attachments.flatMap((attachment) =>
          attachment.driveFileId
            ? [attachment.driveFileId]
            : [],
        ),
      ),
    ]

    if (fileIds.length === 0) {
      return
    }

    const requestedAt = new Date().toISOString()

    setProject((currentProject) => {
      const existingRequests =
        currentProject.attachmentDeletionRequests ?? []

      const existingIds = new Set(
        existingRequests.map(
          (request) => request.driveFileId,
        ),
      )

      const newRequests = fileIds
        .filter((fileId) => !existingIds.has(fileId))
        .map((driveFileId) => ({
          driveFileId,
          requestedAt,
        }))

      if (newRequests.length === 0) {
        return currentProject
      }

      return {
        ...currentProject,
        attachmentDeletionRequests: [
          ...existingRequests,
          ...newRequests,
        ],
      }
    })
  }

  const [activeView, setActiveView] =
    useState<
      'board' |
      'mine' |
      'timeline' |
      'history'
    >('board')
  const effectiveActiveView =
    activeView === 'mine' && !googleUser
      ? 'board'
      : activeView
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

  const [
    selectedTaskId,
    setSelectedTaskId,
  ] = useState<string | null>(null)

  const selectedTask =
    selectedTaskId
      ? tasks.find(
        (task) =>
          task.id === selectedTaskId,
      ) ?? null
      : null

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
    const currentUserId =
      googleUser?.permissionId ?? null

    if (currentUserId) {
      const firstIsMine =
        firstTask.assigneeId === currentUserId

      const secondIsMine =
        secondTask.assigneeId === currentUserId

      if (firstIsMine !== secondIsMine) {
        return firstIsMine ? -1 : 1
      }
    }

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

    if (firstAssignee && secondAssignee) {
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

  function handleColumnPriorityVisibilityChange(
    columnId: string,
    hidePriorityOnCards: boolean,
  ) {
    if (!canCurrentUserEditProject) {
      return
    }

    setColumns((currentColumns) =>
      currentColumns.map((column) =>
        column.id === columnId
          ? {
            ...column,
            hidePriorityOnCards,
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
  ): boolean {
    if (!canCurrentUserEditProject) {
      return false
    }

    const column = columns.find(
      (column) => column.id === columnId,
    )

    if (!column) {
      return false
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

    return true
  }

  function handleUpdateTask(
    taskId: string,
    taskInput: NewTaskInput,
  ): boolean {
    if (!canCurrentUserEditProject) {
      return false
    }

    const existingTask =
      tasks.find(
        (task) =>
          task.id === taskId,
      )

    if (!existingTask) {
      return false
    }

    const remainingAttachmentIds =
      new Set(
        taskInput.attachments.map(
          (attachment) =>
            attachment.id,
        ),
      )

    const explicitlyRemovedAttachments =
      existingTask.attachments.filter(
        (attachment) =>
          !remainingAttachmentIds.has(
            attachment.id,
          ),
      )

    queueAttachmentDeletions(
      explicitlyRemovedAttachments,
    )

    const updatedAt =
      new Date().toISOString()

    setTasks((currentTasks) =>
      currentTasks.map((task) =>
        task.id === taskId
          ? {
            ...task,
            title: taskInput.title,
            description:
              taskInput.description,
            priority:
              taskInput.priority,
            assigneeId:
              taskInput.assigneeId,
            deadline:
              taskInput.deadline,

            manualOrderKey:
              task.priority ===
                taskInput.priority &&
                task.deadline ===
                taskInput.deadline
                ? task.manualOrderKey
                : `${updatedAt}:${task.id}`,

            tags: taskInput.tags,
            updatedAt,
            revision:
              task.revision + 1,
            attachments:
              taskInput.attachments,
          }
          : task,
      ),
    )

    setEditingTaskId(null)
    return true
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

    queueAttachmentDeletions(
      task.attachments,
    )

    setTasks((currentTasks) =>
      currentTasks.filter(
        (task) => task.id !== taskId,
      ),
    )

    setEditingTaskId(null)
  }

  function activateDriveProject(
    loadedDriveProject: LoadedDriveProject,
    userPermissionId: string,
  ) {
    setAssigneeFilter('all')
    setTaskSortMode('priority')

    const activeProject =
      loadedDriveProject.project

    currentProjectRef.current =
      activeProject

    lastSyncedProjectRef.current =
      activeProject

    projectDocumentConflictRef.current =
      false

    taskSyncConflictIdsRef.current =
      new Set()

    setTaskSyncConflicts([])

    setGoogleProjectFolderId(
      loadedDriveProject.projectFolderId,
    )

    setGoogleProjectFileId(
      loadedDriveProject.projectFileId,
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

    try {
      setPendingUploads(
        reconcilePendingUploads(
          userPermissionId,
          loadedDriveProject.projectFileId,
          activeProject,
        ),
      )
    }
    catch (error) {
      setPendingUploads([])

      setSharedProjectError(
        error instanceof Error
          ? error.message
          : 'Could not restore attachment recovery records.',
      )
    }

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

    setAttachmentAuthorizationStatus(null)

    setActiveView('board')
    setIsDemoMode(false)
  }

  async function openDriveProject(
    projectFolderId: string | null,
    isOwned: boolean,
    projectFileId?: string,
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

    let loadedDriveProject:
      LoadedDriveProject | null

    if (projectFileId) {
      loadedDriveProject =
        await loadProjectFromDriveDocument(
          googleAccessToken,
          projectFileId,
        )
    } else if (projectFolderId) {
      loadedDriveProject =
        await loadProjectFromDriveFolder(
          googleAccessToken,
          projectFolderId,
          isOwned,
        )
    } else {
      throw new Error(
        'No Dat’s project was selected.',
      )
    }

    if (!loadedDriveProject) {
      throw new Error(
        'The selected item is not a Dat’s project.',
      )
    }

    if (isOwned) {
      const hasProjectOwner =
        loadedDriveProject.project.members.some(
          (member) =>
            member.accessRole === 'owner',
        )

      if (!hasProjectOwner) {
        const migratedProject: Project = {
          ...loadedDriveProject.project,

          members: [
            ...loadedDriveProject.project.members,
            {
              id:
                googleUser.permissionId,
              displayName:
                googleUser.displayName,
              role: '',
              email:
                googleUser.emailAddress,
              accessRole: 'owner',
            },
          ],
        }

        await saveProjectMetadataToDrive(
          googleAccessToken,
          googleProjectsFolderId,
          loadedDriveProject.projectFolderId,
          migratedProject,
        )

        await saveProjectDocumentToDrive(
          googleAccessToken,
          loadedDriveProject.projectFileId,
          migratedProject,
        )

        loadedDriveProject = {
          ...loadedDriveProject,
          project:
            migratedProject,
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
      loadedDriveProject.projectFileId,
    )

    activateDriveProject(
      loadedDriveProject,
      googleUser.permissionId,
    )
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
        summary.projectFileId,
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
      if (
        isGoogleUnauthorizedError(error)
      ) {
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

  async function handleAuthorizeExistingAttachments(
    targetFileId?: string,
  ) {
    if (
      !googleAccessToken ||
      isAuthorizingExistingAttachments
    ) {
      return
    }

    const attachments =
      currentProject.tasks.flatMap(
        (task) => task.attachments,
      )

    const allFileIds = [
      ...new Set(
        attachments.flatMap((attachment) =>
          attachment.driveFileId
            ? [attachment.driveFileId]
            : [],
        ),
      ),
    ]

    if (
      targetFileId &&
      !allFileIds.includes(targetFileId)
    ) {
      setSharedProjectError(
        'This file is not referenced by the current project.',
      )
      return
    }

    const fileIds = targetFileId
      ? [targetFileId]
      : allFileIds

    if (fileIds.length === 0) {
      setAttachmentAuthorizationStatus(
        'This project has no Google Drive attachments.',
      )
      return
    }

    const accessToken = googleAccessToken

    setIsAuthorizingExistingAttachments(true)
    setSharedProjectError(null)
    setAttachmentAuthorizationStatus(
      `Checking access to ${fileIds.length} file(s)...`,
    )

    try {
      const initialReport =
        await verifySelectedAttachmentAccess(
          accessToken,
          fileIds,
        )

      const missingFileIds =
        initialReport.failures.map(
          (failure) => failure.fileId,
        )

      if (missingFileIds.length === 0) {
        setAttachmentAuthorizationStatus(
          'All selected project files are already accessible.',
        )

        return
      }

      setAttachmentAuthorizationStatus(
        `${missingFileIds.length} file(s) need access. Select them together in Google Picker.`,
      )

      const selectedFileIds =
        await pickGoogleDriveAttachmentFiles(
          accessToken,
          missingFileIds,
        )

      if (selectedFileIds.length === 0) {
        setAttachmentAuthorizationStatus(
          `${missingFileIds.length} file(s) still need access. Authorization was cancelled.`,
        )

        return
      }

      const updatedReport =
        await verifySelectedAttachmentAccess(
          accessToken,
          selectedFileIds,
        )

      if (
        updatedReport.authorizedFileIds.length > 0
      ) {
        setAttachmentAccessRevision(
          (revision) => revision + 1,
        )
      }

      const authorizedIds = new Set(
        updatedReport.authorizedFileIds,
      )

      const remainingFileIds =
        missingFileIds.filter(
          (fileId) => !authorizedIds.has(fileId),
        )

      const accessibleCount =
        fileIds.length - remainingFileIds.length

      setAttachmentAuthorizationStatus(
        `${accessibleCount} of ${fileIds.length} project file(s) are now accessible.`,
      )

      if (remainingFileIds.length === 0) {
        setSharedProjectError(null)
        return
      }

      const failureDetails =
        updatedReport.failures
          .slice(0, 3)
          .map((failure) => {
            const attachment =
              attachments.find(
                (item) =>
                  item.driveFileId === failure.fileId,
              )

            return (
              `${attachment?.fileName ?? failure.fileId}: ` +
              failure.reason
            )
          })
          .join('\n')

      setSharedProjectError(
        `${remainingFileIds.length} file(s) still require access.` +
        (failureDetails
          ? `\n${failureDetails}`
          : ''),
      )
    } catch (error) {
      if (isGoogleUnauthorizedError(error)) {
        expireGoogleSession()
        return
      }

      setSharedProjectError(
        error instanceof Error
          ? error.message
          : 'Attachment authorization failed.',
      )
    } finally {
      setIsAuthorizingExistingAttachments(false)
    }
  }

  async function handleAuthorizeAttachmentsFolder() {
    if (
      !googleAccessToken ||
      !googleProjectFolderId
    ) {
      return
    }

    setSharedProjectError(null)

    try {
      const folderId =
        await pickGoogleDriveFolder(
          googleAccessToken,
        )

      if (!folderId) {
        return
      }

      const isValidFolder =
        await isProjectAttachmentsFolder(
          googleAccessToken,
          folderId,
          googleProjectFolderId,
        )

      if (!isValidFolder) {
        setSharedProjectError(
          'Select the "attachments" folder inside the currently open Dat’s project.',
        )

        return
      }

      setGoogleAttachmentsFolderId(
        folderId,
      )
    } catch (error) {
      setSharedProjectError(
        error instanceof Error
          ? error.message
          : 'Failed to authorize the attachments folder.',
      )
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
      const pickedProject =
        await pickGoogleDriveProjectFile(
          googleAccessToken,
        )

      if (!pickedProject) {
        return
      }

      if (
        pickedProject.name !==
        DATS_PROJECT_DOCUMENT_FILE_NAME
      ) {
        throw new Error(
          `Select the "${DATS_PROJECT_DOCUMENT_FILE_NAME}" file inside the shared Dat’s project folder.`,
        )
      }

      if (hasPendingProjectSaves()) {
        setSharedProjectError(
          'Wait for the current project to finish saving before switching projects.',
        )

        return
      }

      await openDriveProject(
        null,
        false,
        pickedProject.id,
      )
    } catch (error) {
      if (
        isGoogleUnauthorizedError(error)
      ) {
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
          id:
            connectedGoogleUser.permissionId,
          displayName:
            connectedGoogleUser.displayName,
          role: '',
          email:
            connectedGoogleUser.emailAddress,
          accessRole: 'owner',
        },
      ]

      await saveProjectMetadataToDrive(
        accessToken,
        projectsFolderId,
        loadedDriveProject.projectFolderId,
        activeProject,
      )

      await saveProjectDocumentToDrive(
        accessToken,
        loadedDriveProject.projectFileId,
        activeProject,
      )
    }

    await rememberProjectFolder(
      accessToken,
      projectsFolderId,
      loadedDriveProject.projectFolderId,
      loadedDriveProject.projectFileId,
    )

    activateDriveProject(
      loadedDriveProject,
      connectedGoogleUser.permissionId,
    )

    setGoogleAccessToken(accessToken)
  }

  useEffect(() => {
    if (
      isDemoMode ||
      !googleAccessToken ||
      !googleProjectFileId ||
      !googleUser
    ) {
      return
    }

    const accessToken =
      googleAccessToken

    const projectFileId =
      googleProjectFileId

    const googlePermissionId =
      googleUser.permissionId

    let isChecking = false
    let isCancelled = false

    async function syncRemoteProjectDocument() {
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
        const remoteDocument =
          await loadProjectDocumentFromDrive(
            accessToken,
            projectFileId,
          )

        if (isCancelled) {
          return
        }

        const remoteProject =
          remoteDocument.project

        setPendingUploads(
          reconcilePendingUploads(
            googlePermissionId,
            projectFileId,
            remoteProject,
          ),
        )

        const localProject =
          currentProjectRef.current

        const baseline =
          lastSyncedProjectRef.current ??
          remoteProject

        const mergeResult =
          mergeProjectDocuments(
            baseline,
            localProject,
            remoteProject,
            taskSyncConflictIdsRef.current,
          )

        if (mergeResult.projectConflict) {
          projectDocumentConflictRef.current =
            true
        }

        taskSyncConflictIdsRef.current =
          new Set(
            mergeResult.taskConflicts.map(
              (conflict) =>
                conflict.taskId,
            ),
          )

        setTaskSyncConflicts(
          mergeResult.taskConflicts,
        )


        lastSyncedProjectRef.current =
          remoteProject

        currentProjectRef.current =
          mergeResult.localProject

        setProject(mergeResult.localProject)
        setColumns(mergeResult.localProject.columns)
        setTasks(mergeResult.localProject.tasks)

        if (
          googleAttachmentsFolderId &&
          !mergeResult.projectConflict &&
          mergeResult.taskConflicts.length === 0 &&
          !projectDocumentConflictRef.current &&
          !hasPendingProjectSaves()
        ) {
          const completedFileIds =
            await processSharedAttachmentDeletions({
              accessToken,
              projectFileId,
              userPermissionId: googlePermissionId,
              attachmentsFolderId: googleAttachmentsFolderId,
              savedProject: remoteProject,
              localProject: mergeResult.localProject,

              canProceed: () =>
                !isCancelled &&
                !hasPendingProjectSaves() &&
                !projectDocumentConflictRef.current &&
                taskSyncConflictIdsRef.current.size === 0,

              getCurrentLocalProject: () =>
                currentProjectRef.current,
            })

          if (!isCancelled && completedFileIds.length > 0) {
            const completedIds =
              new Set(completedFileIds)

            const completedAt =
              new Date().toISOString()

            setProject((currentProject) => ({
              ...currentProject,
              attachmentDeletionRequests:
                (
                  currentProject.attachmentDeletionRequests
                  ?? []
                ).map((request) =>
                  completedIds.has(request.driveFileId) &&
                    !request.completedAt
                    ? {
                      ...request,
                      completedAt,
                    }
                    : request,
                ),
            }))
          }
        }


        if (
          mergeResult.projectConflict ||
          projectDocumentConflictRef.current
        ) {
          setProjectSyncError(
            'The pipeline or project settings changed in two places at the same time. Reload the project before continuing.',
          )
        } else {
          setProjectSyncError(null)
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

        if (
          error instanceof Error &&
          error.message.includes(
            'status 403',
          )
        ) {
          setProject(
            (currentValue) => ({
              ...currentValue,

              members:
                currentValue.members.filter(
                  (member) =>
                    member.id !==
                    googlePermissionId,
                ),
            }),
          )

          setProjectSyncError(
            'You no longer have access to this project.',
          )

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

    void syncRemoteProjectDocument()

    const interval =
      window.setInterval(() => {
        void syncRemoteProjectDocument()
      }, 5000)

    return () => {
      isCancelled = true
      window.clearInterval(interval)
    }
  }, [
    isDemoMode,
    googleAccessToken,
    googleProjectFileId,
    googleUser,
    isInvitingMember,
    removingMemberId,
    updatingMemberId,
    expireGoogleSession,
    googleAttachmentsFolderId,
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

      const expiresAt =
        getStoredGoogleAccessTokenExpiresAt()

      setGoogleTokenExpiresAt(expiresAt)

      setGoogleTokenMinutesRemaining(
        expiresAt === null
          ? null
          : getRemainingTokenMinutes(expiresAt),
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
        isTokenStillValid(previousExpiresAt)

      if (previousTokenStillValid) {
        setGoogleAccessToken(
          previousAccessToken,
        )

        setGoogleTokenExpiresAt(
          previousExpiresAt,
        )

        setGoogleTokenMinutesRemaining(
          getRemainingTokenMinutes(previousExpiresAt),
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
    setPendingUploads([])
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

  async function handleUploadAttachment(
    file: File,
  ): Promise<Attachment> {
    const mimeType =
      file.type ||
      'application/octet-stream'

    if (isDemoMode) {
      const canPreviewLocally =
        isPreviewableMedia(
          file.type,
        ) ||
        isGlbFileName(
          file.name,
        )

      const previewUrl =
        canPreviewLocally
          ? URL.createObjectURL(file)
          : undefined

      return {
        id: crypto.randomUUID(),
        fileName: file.name,
        mimeType,
        ...(previewUrl
          ? { previewUrl }
          : {}),
      }
    }

    if (
      !googleAccessToken ||
      !googleAttachmentsFolderId ||
      !googleProjectFileId ||
      !googleUser
    ) {
      throw new Error(
        'Google Drive is not ready for attachment uploads.',
      )
    }


    const projectFileId = googleProjectFileId
    const userPermissionId = googleUser.permissionId

    const driveFileId =
      await uploadAttachmentToDrive(
        googleAccessToken,
        googleAttachmentsFolderId,
        file,
      )


    const attachment: Attachment = {
      id: crypto.randomUUID(),
      fileName: file.name,
      mimeType,
      driveFileId,
    }

    try {
      recordPendingUpload({
        projectFileId,
        userPermissionId,
        attachment,
        uploadedAt: new Date().toISOString(),
      })

      setPendingUploads(
        getPendingUploads(
          userPermissionId,
          projectFileId,
        ),
      )
    } catch (error) {
      throw new Error(
        `The file was uploaded to Google Drive, but its recovery information could not be saved. Drive file ID: ${driveFileId}. Do not upload it again until the problem is resolved.`,
        { cause: error },
      )

    }

    return attachment
  }

  async function handleUploadAttachments(
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
          handleUploadAttachment(file),
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

            if (googleUser && googleProjectFileId) {
              removePendingUpload(
                googleUser.permissionId,
                googleProjectFileId,
                attachment.driveFileId,
              )

              setPendingUploads(
                getPendingUploads(
                  googleUser.permissionId,
                  googleProjectFileId,
                ),
              )
            }
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
      'Attachment upload failed.',
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


          {!isDemoMode &&
            googleAccessToken &&
            googleProjectFolderId &&
            !googleAttachmentsFolderId && (
              <div className="shared-project-warning">
                <span>
                  Authorize the project attachments folder
                  to enable file uploads.
                </span>

                <button
                  type="button"
                  onClick={() => {
                    void handleAuthorizeAttachmentsFolder()
                  }}
                >
                  Authorize Attachments Folder
                </button>
              </div>
            )}


          {!isDemoMode &&
            googleAccessToken &&
            pendingUploads.length > 0 && (
              <div className="shared-project-warning">
                <span>
                  {pendingUploads.length} attachment upload(s)
                  awaiting project-save confirmation.
                  Avoid reuploading these files.
                </span>

                <ul>
                  {pendingUploads.map((entry) => {
                    const linkedLocally =
                      currentProject.tasks.some(
                        (task) =>
                          task.attachments.some(
                            (attachment) =>
                              attachment.driveFileId ===
                              entry.attachment.driveFileId,
                          ),
                      )

                    return (
                      <li key={entry.attachment.driveFileId}>
                        {entry.attachment.fileName}
                        {' — '}
                        {linkedLocally
                          ? 'Linked locally; awaiting Drive confirmation'
                          : 'Not linked locally; recovery may be needed'}
                      </li>
                    )
                  })}
                </ul>
              </div>
            )}


          {!isDemoMode &&
            googleAccessToken &&
            currentProject.tasks.some(
              (task) =>
                task.attachments.some(
                  (attachment) =>
                    Boolean(attachment.driveFileId),
                ),
            ) && (
              <div className="shared-project-warning">
                <span>
                  Select existing project files to grant
                  Dat&apos;s access when needed.
                </span>

                <button
                  type="button"
                  disabled={isAuthorizingExistingAttachments}
                  onClick={() => {
                    void handleAuthorizeExistingAttachments()
                  }}
                >
                  {isAuthorizingExistingAttachments
                    ? 'Checking Attachments...'
                    : 'Check Project File Access'}
                </button>
              </div>
            )}


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

      {attachmentAuthorizationStatus && (
        <p
          className="attachment-authorization-status"
          role="status"
        >
          {attachmentAuthorizationStatus}
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

        {effectiveActiveView !== 'mine' && (
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
          effectiveActiveView === 'board' ||
          effectiveActiveView === 'timeline'
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

        {effectiveActiveView === 'board' &&
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

      {effectiveActiveView === 'board' && (
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
                  onUploadAttachments={
                    handleUploadAttachments
                  }

                  onLoadAttachment={
                    handleLoadAttachment
                  }
                  onColumnOrderingChange={
                    handleColumnOrderingChange
                  }
                  isTaskEditing={isTaskEditing}
                  onColumnPriorityVisibilityChange={
                    handleColumnPriorityVisibilityChange
                  }
                  allowManualTaskOrdering={
                    taskSortMode === 'priority' &&
                    assigneeFilter === 'all' &&
                    (
                      !column.countsAsCompleted ||
                      column.usePriorityDeadlineOrdering ===
                      true
                    )
                  }
                  onMoveTiedTask={
                    handleMoveTiedTask
                  }
                  onAuthorizeAttachment={(attachment) => {
                    if (attachment.driveFileId) {
                      void handleAuthorizeExistingAttachments(
                        attachment.driveFileId,
                      )
                    }
                  }}
                />
              )
            })}
          </section>
        </DragDropProvider>
      )}

      {effectiveActiveView === 'mine' && (
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
                      onLoadAttachment={handleLoadAttachment}
                      canMoveManualUp={false}
                      canMoveManualDown={false}
                      onMoveManualUp={() => { }}
                      onMoveManualDown={() => { }}
                      onAuthorizeAttachment={(attachment) => {
                        if (attachment.driveFileId) {
                          void handleAuthorizeExistingAttachments(
                            attachment.driveFileId,
                          )
                        }
                      }}
                    />

                  </div>
                )
              })}
            </div>
          )}
        </section>
      )}

      {effectiveActiveView === 'timeline' && (
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
                    <button
                      key={task.id}
                      type="button"
                      className="timeline-item"
                      onClick={() =>
                        setSelectedTaskId(task.id)
                      }
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
                    </button>
                  ))}
                </div>

                <div className="timeline-group__marker" />
              </div>
            ))}
          </div>
        </section>
      )}

      {effectiveActiveView === 'history' && (
        <CompletedHistory
          tasks={completedTasks}
          onOpenTask={setSelectedTaskId}
        />
      )}

      <TaskDetailsDialog
        task={selectedTask}
        members={currentProject.members}
        columns={columns}
        onClose={() =>
          setSelectedTaskId(null)
        }
      />
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

  function handleMoveTiedTask(
    taskId: string,
    direction: 'up' | 'down',
  ) {
    if (!canCurrentUserEditProject) {
      return
    }

    setTasks((currentTasks) => {
      const task =
        currentTasks.find(
          (currentTask) =>
            currentTask.id === taskId,
        )

      if (
        !task ||
        task.deadline !== null
      ) {
        return currentTasks
      }

      const tiedTasks =
        currentTasks
          .filter(
            (currentTask) =>
              currentTask.columnId ===
              task.columnId &&
              currentTask.priority ===
              task.priority &&
              currentTask.deadline === null,
          )
          .sort(compareTasks)

      const currentIndex =
        tiedTasks.findIndex(
          (tiedTask) =>
            tiedTask.id === taskId,
        )

      if (currentIndex < 0) {
        return currentTasks
      }

      const targetIndex =
        direction === 'up'
          ? currentIndex - 1
          : currentIndex + 1

      const targetTask =
        tiedTasks[targetIndex]

      if (!targetTask) {
        return currentTasks
      }

      const taskOrderKey =
        getManualOrderKey(task)

      const targetOrderKey =
        getManualOrderKey(targetTask)

      const updatedAt =
        new Date().toISOString()

      return currentTasks.map(
        (currentTask) => {
          if (currentTask.id === task.id) {
            return {
              ...currentTask,
              manualOrderKey:
                targetOrderKey,
              updatedAt,
              revision:
                currentTask.revision + 1,
            }
          }

          if (
            currentTask.id ===
            targetTask.id
          ) {
            return {
              ...currentTask,
              manualOrderKey:
                taskOrderKey,
              updatedAt,
              revision:
                currentTask.revision + 1,
            }
          }

          return currentTask
        },
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