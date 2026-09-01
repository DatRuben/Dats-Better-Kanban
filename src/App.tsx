import './App.css'
import { KanbanColumn } from './components/KanbanColumn'
import { demoProject } from './data/demoProject'

const priorityOrder = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
}

function App() {
  const sortedColumnTasks = [...columnTasks].sort(
    (firstTask, secondTask) =>
      priorityOrder[firstTask.priority] -
      priorityOrder[secondTask.priority],
  )

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <p className="product-name">Dat&apos;s: Better Kanban</p>
          <h1>{demoProject.name}</h1>
        </div>

        <span className="demo-badge">Demo Mode</span>
      </header>

      <section
        className="kanban-board"
        aria-label={`${demoProject.name} Kanban board`}
      >
        {orderedColumns.map((column) => {
          const columnTasks = demoProject.tasks.filter(
            (task) => task.columnId === column.id,
          )

          const sortedColumnTasks = [...columnTasks].sort(
            (firstTask, secondTask) =>
              priorityOrder[firstTask.priority] -
              priorityOrder[secondTask.priority],
          )

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
    </main>
  )
}

export default App