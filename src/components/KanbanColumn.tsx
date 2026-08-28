import type { BoardColumn, DemoUser, Task } from '../types/board'
import { TaskCard } from './TaskCard'

interface KanbanColumnProps {
  column: BoardColumn
  tasks: Task[]
  members: DemoUser[]
}

export function KanbanColumn({
  column,
  tasks,
  members,
}: KanbanColumnProps) {
  return (
    <section className="kanban-column">
      <header className="kanban-column__header">
        <h2>{column.title}</h2>
        <span className="kanban-column__count">{tasks.length}</span>
      </header>

      <div className="kanban-column__content">
        {tasks.map((task) => {
          const assignee = members.find((member) => member.id === task.assigneeId) ?? null

          return (
            <TaskCard
              key={task.id}
              task={task}
              assignee={assignee}
            />
          )
        })}
      </div>
    </section>
  )
}