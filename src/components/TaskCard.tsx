import type { Task } from '../types/board'

interface TaskCardProps {
  task: Task
}

export function TaskCard({ task }: TaskCardProps) {
  return (
    <article className="task-card">
      <p className="task-card__priority">{task.priority}</p>
      <h3>{task.title}</h3>
      <p className="task-card__deadline"> Deadline: {task.deadline ?? 'None'}</p>
    </article>
  )
}