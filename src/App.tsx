import './App.css'
import {
  useEffect,
  useRef,
  useState,
} from 'react'
import { KanbanColumn } from './components/KanbanColumn'
import { demoProject } from './data/demoProject'
import type { NewTaskInput, Task } from './types/board'
import type { WheelEvent } from 'react'
import { moveTaskToColumn } from './utility/moveTask'
import { DragDropProvider } from '@dnd-kit/react'
import { isSortable } from '@dnd-kit/react/sortable'
import { createProjectSnapshot } from './storage/projectSnapshot'
import {
  clearStoredGoogleAccessToken,
  getStoredGoogleAccessToken,
  requestGoogleAccessToken,
} from './auth/googleAuth'
import { createBlankProject } from './data/createBlankProject'
import {
  createProjectOnDrive,
  deleteTaskFromDrive,
  ensureDatsDriveFolder,
  ensureProjectsDriveFolder,
  loadFirstProjectFromDrive,
  saveColumnsToDrive,
  saveProjectMetadataToDrive,
  saveTaskToDrive,
  verifyGoogleDriveAccess,
} from './storage/googleDriveApi'

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

function App() {
  const [project, setProject] =
    useState(demoProject)
  const [isDemoMode, setIsDemoMode] =
    useState(true)
  const [isRestoringGoogle, setIsRestoringGoogle] =
    useState(
      () =>
        getStoredGoogleAccessToken() !== null,
    )
  const [columns, setColumns] =
    useState(project.columns)
  const [tasks, setTasks] =
    useState(project.tasks)

  const [googleAccessToken, setGoogleAccessToken] =
    useState<string | null>(null)

  const [googleProjectFolderId, setGoogleProjectFolderId] =
    useState<string | null>(null)

  const [googleTasksFolderId, setGoogleTasksFolderId] =
    useState<string | null>(null)

  const lastSavedTasksRef =
    useRef<Task[]>([])

  const [isGoogleConnecting, setIsGoogleConnecting] =
    useState(false)

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

  const pendingSavesRef =
    useRef(0)

  const currentProject = createProjectSnapshot(
    project,
    columns,
    tasks,
  )

  const [googleProjectsFolderId, setGoogleProjectsFolderId] =
    useState<string | null>(null)

  function beginSave(): boolean {
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
      isDemoMode ||
      !googleAccessToken ||
      !googleProjectsFolderId ||
      !googleProjectFolderId
    ) {
      return
    }

    const timeout =
      window.setTimeout(() => {
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
    }
  }, [
    project,
    isDemoMode,
    googleAccessToken,
    googleProjectsFolderId,
    googleProjectFolderId,
  ])

  useEffect(() => {
    if (
      isDemoMode ||
      !googleAccessToken ||
      !googleProjectFolderId
    ) {
      return
    }

    const timeout =
      window.setTimeout(() => {
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

    const timeout =
      window.setTimeout(() => {
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
                !currentIds.has(task.id),
            )
            .map((task) => task.id)

        if (!beginSave()) {
          return
        }

        void Promise.all([
          ...changedTasks.map((task) =>
            saveTaskToDrive(
              googleAccessToken,
              googleTasksFolderId,
              task,
            ),
          ),

          ...deletedTaskIds.map((taskId) =>
            deleteTaskFromDrive(
              googleAccessToken,
              googleTasksFolderId,
              taskId,
            ),
          ),
        ])
          .then(() => {
            lastSavedTasksRef.current =
              tasks

            completeSave()
          })
          .catch((error) => {
            failSave(error)
          })
      }, 1000)

    return () => {
      window.clearTimeout(timeout)
    }
  }, [
    tasks,
    isDemoMode,
    googleAccessToken,
    googleTasksFolderId,
  ])

  const [activeView, setActiveView] =
    useState<'board' | 'timeline' | 'history'>('board')
  const orderedColumns = [...columns].sort(
    (firstColumn, secondColumn) =>
      firstColumn.order - secondColumn.order,
  )
  const [isPipelineEditing, setIsPipelineEditing] = useState(false)

  const [creatingTaskColumnId, setCreatingTaskColumnId] = useState<string | null>(null)

  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)


  const timelineTasks = tasks
    .filter((task) => {
      const taskColumn = columns.find(
        (column) => column.id === task.columnId,
      )


      return !taskColumn?.countsAsCompleted
    })
    .sort(compareTasks)

  const timelineGroups: Task[][] = []

  const completedTasks = tasks
    .filter((task) => {
      const taskColumn = columns.find(
        (column) => column.id === task.columnId,
      )

      return taskColumn?.countsAsCompleted
    })
    .sort((firstTask, secondTask) => {
      if (firstTask.completedAt && secondTask.completedAt) {
        return secondTask.completedAt.localeCompare(firstTask.completedAt)
      }

      if (firstTask.completedAt) {
        return -1
      }

      if (secondTask.completedAt) {
        return 1
      }

      return 0
    })

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

  function handleColumnCompletionChange(
    columnId: string,
    countsAsCompleted: boolean,
  ) {
    const column = columns.find(
      (column) => column.id === columnId,
    )

    if (!column) {
      return
    }

    const columnTasks = tasks.filter(
      (task) => task.columnId === columnId,
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
      attachments: [],
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
            updatedAt,
            revision: task.revision + 1,
          }
          : task,
      ),
    )

    setEditingTaskId(null)
  }

  function handleDeleteTask(taskId: string) {
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

  async function connectGoogleWithToken(
    accessToken: string,
  ) {
    await verifyGoogleDriveAccess(accessToken)

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

    let loadedDriveProject =
      await loadFirstProjectFromDrive(
        accessToken,
        projectsFolderId,
      )

    if (!loadedDriveProject) {
      const blankProject =
        createBlankProject()

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
    }

    const activeProject =
      loadedDriveProject.project

    lastSavedTasksRef.current =
      activeProject.tasks

    setGoogleProjectFolderId(
      loadedDriveProject.projectFolderId,
    )

    setGoogleTasksFolderId(
      loadedDriveProject.tasksFolderId,
    )

    setProject(activeProject)
    setColumns(activeProject.columns)
    setTasks(activeProject.tasks)

    setActiveView('board')
    setIsDemoMode(false)

    setGoogleAccessToken(accessToken)
  }

  useEffect(() => {
    const storedAccessToken =
      getStoredGoogleAccessToken()

    if (!storedAccessToken) {
      setIsRestoringGoogle(false)
      return
    }

    void connectGoogleWithToken(
      storedAccessToken,
    )
      .catch((error) => {
        setGoogleAccessToken(null)

        setGoogleAuthError(
          error instanceof Error
            ? error.message
            : 'Google session restore failed.',
        )
      })
      .finally(() => {
        setIsRestoringGoogle(false)
      })
  }, [])

  async function handleConnectGoogle() {
    setIsGoogleConnecting(true)
    setGoogleAuthError(null)

    try {
      const storedAccessToken =
        getStoredGoogleAccessToken()

      const accessToken =
        storedAccessToken ??
        await requestGoogleAccessToken()

      if (isDemoMode) {
        await connectGoogleWithToken(
          accessToken,
        )
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
      setGoogleAccessToken(null)

      setGoogleAuthError(
        error instanceof Error
          ? error.message
          : 'Google authorization failed.',
      )
    } finally {
      setIsGoogleConnecting(false)
    }
  }

  if (isRestoringGoogle) {
    return (
      <main className="app-loading">
        <div className="app-loading__content">
          <h1>Dat's: Better Kanban</h1>
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

    pendingSavesRef.current = 0

    setSaveStatus('error')

    setSaveError(
      'Google Drive session expired. Reconnect to continue saving.',
    )
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <p className="product-name">
            Dat&apos;s: Better Kanban
          </p>

          <input
            className="project-title-input"
            type="text"
            value={project.name}
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
          <a
            className="privacy-policy-button"
            href="/privacy.html"
          >
            Privacy Policy
          </a>

          <button
            type="button"
            className="google-connect-button"
            onClick={handleConnectGoogle}
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
              {saveStatus === 'saving' && 'Saving…'}
              {saveStatus === 'saved' && 'Saved'}
              {saveStatus === 'error' && 'Save failed'}
            </span>
          )}

          {isDemoMode && (
            <span className="demo-badge">
              Demo Mode
            </span>
          )}
        </div>
      </header>
      {googleAuthError && (
        <p className="google-auth-error">
          {googleAuthError}
        </p>
      )}

      {saveError && (
        <p className="save-error">
          {saveError}
        </p>
      )}

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

        <button
          type="button"
          onClick={() => setActiveView('history')}
        >
          Completed History
        </button>
      </nav>

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
            className="kanban-board"
            aria-label={`${currentProject.name} Kanban board`}
          >
            {orderedColumns.map((column) => {
              const columnTasks = tasks.filter(
                (task) => task.columnId === column.id,
              )

              const sortedColumnTasks = [...columnTasks].sort(compareTasks)

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
                />
              )
            })}
          </section>
        </DragDropProvider>
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

      {activeView === 'board' && (
        <div className="pipeline-controls">
          <button
            type="button"
            className={`pipeline-controls__button ${isPipelineEditing
              ? 'pipeline-controls__button--active'
              : ''
              }`}
            onClick={() =>
              setIsPipelineEditing((currentValue) => !currentValue)
            }
          >
            {isPipelineEditing
              ? 'Exit Pipeline Edit Mode'
              : 'Edit Pipeline'}
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
    </main>
  )

  function handleMoveTask(taskId: string, targetColumnId: string) {
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
}

export default App