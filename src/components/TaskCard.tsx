import type { DemoUser, Task } from '../types/board'

interface TaskCardProps {
  task: Task
  assignee: DemoUser | null
  taskNumber: number
}

export function TaskCard({
  task,
  assignee,
  taskNumber,
}: TaskCardProps) {
  return (
    <article className="task-card">
      <p
        className={`task-card__priority task-card__priority--${task.priority}`}
      >
        {task.priority}
      </p>
      <p className="task-card__number">{taskNumber}</p>
      <h3>{task.title}</h3>
      <p className="task-card__assignee">
        Assigned: {assignee?.displayName ?? 'Unassigned'}
      </p>
      <p className="task-card__deadline"> Deadline: {task.deadline ?? 'None'}</p>
    </article>
  )
}