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

      <p className="task-card__assignee">
        {assignee?.displayName ?? 'Unassigned'}
      </p>
    </article>
  )
}