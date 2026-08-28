import type { DemoUser, Task } from '../types/board'

interface TaskCardProps {
  task: Task
  assignee: DemoUser | null
}

export function TaskCard({
  task,
  assignee,
}: TaskCardProps) {
  return (
    <article className="task-card">
      <p className="task-card__priority">{task.priority}</p>
      <h3>{task.title}</h3>
      <p className="task-card__assignee">
        Assigned: {assignee?.displayName ?? 'Unassigned'}
      </p>
      <p className="task-card__deadline"> Deadline: {task.deadline ?? 'None'}</p>
    </article>
  )
}