import type { BoardColumn } from '../types/board'

interface KanbanColumnProps {
  column: BoardColumn
  taskCount: number
}

export function KanbanColumn({
  column,
  taskCount,
}: KanbanColumnProps) {
  return (
    <section className="kanban-column">
      <header className="kanban-column__header">
        <h2>{column.title}</h2>
        <span className="kanban-column__count">{taskCount}</span>
      </header>

      <div className="kanban-column__content">
        {taskCount === 0 && (
          <p className="kanban-column__empty">No tasks</p>
        )}
      </div>
    </section>
  )
}