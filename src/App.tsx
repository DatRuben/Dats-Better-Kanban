import './App.css'
import { useState } from 'react'
import { KanbanColumn } from './components/KanbanColumn'
import { demoProject } from './data/demoProject'
import type { Task } from './types/board'
import type { WheelEvent } from 'react'
import { moveTaskToColumn } from './utility/moveTask'
import { DragDropProvider } from '@dnd-kit/react'

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
  const [tasks, setTasks] = useState(demoProject.tasks)
  const [activeView, setActiveView] =
    useState<'board' | 'timeline' | 'history'>('board')
  const orderedColumns = [...demoProject.columns].sort(
    (firstColumn, secondColumn) =>
      firstColumn.order - secondColumn.order,
  )

  const [isPipelineEditing, setIsPipelineEditing] = useState(false)

  const timelineTasks = tasks
    .filter((task) => {
      const taskColumn = demoProject.columns.find(
        (column) => column.id === task.columnId,
      )


      return !taskColumn?.countsAsCompleted
    })
    .sort(compareTasks)

  const timelineGroups: Task[][] = []

  const completedTasks = tasks
    .filter((task) => {
      const taskColumn = demoProject.columns.find(
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

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <p className="product-name">Dat&apos;s: Better Kanban</p>
          <h1>{demoProject.name}</h1>
        </div>

        <span className="demo-badge">Demo Mode</span>
      </header>

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
            aria-label={`${demoProject.name} Kanban board`}
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
                  members={demoProject.members}
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
        <button
          type="button"
          onClick={() =>
            setIsPipelineEditing((currentValue) => !currentValue)
          }
        >
          {isPipelineEditing
            ? 'Exit Pipeline Edit Mode'
            : 'Edit Pipeline'}
        </button>
      )}
    </main>
  )

  function handleMoveTask(taskId: string, targetColumnId: string) {
    const task = tasks.find((task) => task.id === taskId)
    const targetColumn = demoProject.columns.find(
      (column) => column.id === targetColumnId,
    )

    if (!task || !targetColumn) {
      return
    }

    const currentColumn = demoProject.columns.find(
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