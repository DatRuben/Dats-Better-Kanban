import './App.css'
import { useState } from 'react'
import { KanbanColumn } from './components/KanbanColumn'
import { demoProject } from './data/demoProject'
import type { Task } from './types/board'

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

function App() {
  const [tasks] = useState(demoProject.tasks)
  const [activeView, setActiveView] = useState<'board' | 'timeline'>('board')
  const orderedColumns = [...demoProject.columns].sort(
    (firstColumn, secondColumn) =>
      firstColumn.order - secondColumn.order,
  )

  const timelineTasks = tasks
    .filter((task) => {
      const taskColumn = demoProject.columns.find(
        (column) => column.id === task.columnId,
      )

      return !taskColumn?.countsAsCompleted
    })
    .sort(compareTasks)

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
      </nav>

      {activeView === 'board' && (
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
      )}

      {activeView === 'timeline' && (
        <section className="timeline-view">
          <h2>Timeline</h2>

          <div className="timeline-list">
            {timelineTasks.map((task) => (
              <article
                key={task.id}
                className="timeline-item"
              >
                <div className="timeline-item__marker" />

                <div className="timeline-item__content">
                  <p className="timeline-item__deadline">
                    {task.deadline ?? 'No deadline'}
                  </p>

                  <h3>{task.title}</h3>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
    </main>
  )
}

export default App