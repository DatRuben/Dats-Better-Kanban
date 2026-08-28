import type { BoardColumn, Task } from '../types/board'
import { TaskCard } from './TaskCard'

interface KanbanColumnProps {
  column: BoardColumn
  tasks: Task[]
}

export function KanbanColumn({
  column,
  tasks,
}: KanbanColumnProps) {
  return (
    <section className="kanban-column">
      <header className="kanban-column__header">
        <h2>{column.title}</h2>
        <span className="kanban-column__count">{tasks.length}</span>
      </header>

      <div className="kanban-column__content">
        {tasks.length === 0 && (
          <p className="kanban-column__empty">No tasks</p>
        )}

        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
          />
        ))}
      </div>
    </section>
  )
}