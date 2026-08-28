import type { Task } from '../types/board'

interface TaskCardProps {
  task: Task
}

export function TaskCard({ task }: TaskCardProps) {
  return (
    <article className="task-card">
      <h3>{task.title}</h3>
    </article>
  )
}