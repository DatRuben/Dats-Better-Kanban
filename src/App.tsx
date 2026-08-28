import './App.css'
import { KanbanColumn } from './components/KanbanColumn'
import { demoProject } from './data/demoProject'

function App() {
  const orderedColumns = [...demoProject.columns].sort(
    (firstColumn, secondColumn) =>
      firstColumn.order - secondColumn.order,
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

          return (
            <KanbanColumn
              key={column.id}
              column={column}
              tasks={columnTasks}
            />
          )
        })}
      </section>
    </main>
  )
}

export default App