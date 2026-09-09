import { useDroppable } from '@dnd-kit/react'
import type { BoardColumn, DemoUser, Task } from '../types/board'
import { TaskCard } from './TaskCard'

interface KanbanColumnProps {
  column: BoardColumn
  tasks: Task[]
  members: DemoUser[]
  isPipelineEditing: boolean
  onColumnTitleChange: (
    columnId: string,
    title: string,
  ) => void
  onColumnCompletionChange: (
    columnId: string,
    countsAsCompleted: boolean,
  ) => void
  onDeleteColumn: (columnId: string) => void
}

export function KanbanColumn({
  column,
  tasks,
  members,
  isPipelineEditing,
  onColumnTitleChange,
  onColumnCompletionChange,
  onDeleteColumn,
}: KanbanColumnProps) {
  const { ref } = useDroppable({
    id: column.id,
  })

  return (
    <section
      ref={ref}
      className={`kanban-column ${isPipelineEditing
        ? 'kanban-column--editing'
        : ''
        }`}
    >
      <header className="kanban-column__header">
        {isPipelineEditing ? (
          <div className="kanban-column__editor">
            <input
              className="kanban-column__title-input"
              type="text"
              value={column.title}
              onChange={(event) =>
                onColumnTitleChange(
                  column.id,
                  event.target.value,
                )
              }
            />
            <div className="kanban-column__editor-options">
              <label className="kanban-column__completion-setting">
                <input
                  type="checkbox"
                  checked={column.countsAsCompleted}
                  onChange={(event) =>
                    onColumnCompletionChange(
                      column.id,
                      event.target.checked,
                    )
                  }
                />
                Counts as completed
              </label>

              <button
                type="button"
                className="kanban-column__delete-button"
                disabled={tasks.length > 0}
                title={
                  tasks.length > 0
                    ? 'Move all tasks out before deleting this section.'
                    : `Delete ${column.title}`
                }
                onClick={() => onDeleteColumn(column.id)}
              >
                Delete
              </button>
            </div>
          </div>
        ) : (
          <h2>{column.title}</h2>
        )}
        <span className="kanban-column__count">{tasks.length}</span>
      </header>

      <div className="kanban-column__content">
        {tasks.length === 0 && (
          <p className="kanban-column__empty">No tasks</p>
        )}

        {tasks.map((task, index) => {
          const assignee =
            members.find(
              (member) => member.id === task.assigneeId,
            ) ?? null

          return (
            <TaskCard
              key={task.id}
              task={task}
              assignee={assignee}
              taskNumber={index + 1}
              isPipelineEditing={isPipelineEditing}
            />
          )
        })}
      </div>
    </section>
  )
}