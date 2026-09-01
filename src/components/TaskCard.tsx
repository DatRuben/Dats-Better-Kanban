import type { DemoUser, Task } from '../types/board'

interface TaskCardProps {
  task: Task
  assignee: DemoUser | null
  taskNumber: number
}

function getInitials(displayName: string) {
  const nameParts = displayName.trim().split(/\s+/)

  const firstInitial = nameParts[0]?.[0] ?? ''
  const lastInitial =
    nameParts.length > 1
      ? nameParts[nameParts.length - 1]?.[0] ?? ''
      : ''

  return `${firstInitial}${lastInitial}`.toUpperCase()
}

export function TaskCard({
  task,
  assignee,
  taskNumber,
}: TaskCardProps) {
  const assigneeInitials = assignee
    ? getInitials(assignee.displayName)
    : '?'

  return (
    <article className="task-card">
      <div className="task-card__top">
        <p
          className={`task-card__priority task-card__priority--${task.priority}`}
        >
          {task.priority}
        </p>

        <div className="task-card__ranking">
          <p className="task-card__number">{taskNumber}</p>
          <p className="task-card__deadline">
            {task.deadline ?? 'No deadline'}
          </p>
        </div>
      </div>

      <h3>{task.title}</h3>

      <p className="task-card__description">
        {task.description}
      </p>

      <div
        className="task-card__assignee"
        title={assignee?.displayName ?? 'Unassigned'}
      >
        {assigneeInitials}
      </div>
    </article>
  )
}