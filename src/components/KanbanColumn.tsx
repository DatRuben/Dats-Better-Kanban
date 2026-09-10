import { useSortable } from '@dnd-kit/react/sortable'
import type { BoardColumn, DemoUser, NewTaskInput, Task } from '../types/board'
import { TaskCard } from './TaskCard'
import { TaskCreator } from './TaskCreator'

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
  isCreatingTask: boolean
  onStartCreatingTask: () => void
  onCreateTask: (task: NewTaskInput) => void
  onCancelCreatingTask: () => void
  editingTaskId: string | null
  onStartEditingTask: (taskId: string) => void
  onUpdateTask: (
    taskId: string,
    task: NewTaskInput,
  ) => void
  onCancelEditingTask: () => void
  onDeleteTask: (taskId: string) => void
}

export function KanbanColumn({
  column,
  tasks,
  members,
  isPipelineEditing,
  onColumnTitleChange,
  onColumnCompletionChange,
  onDeleteColumn,
  isCreatingTask,
  onStartCreatingTask,
  onCreateTask,
  onCancelCreatingTask,
  editingTaskId,
  onStartEditingTask,
  onUpdateTask,
  onCancelEditingTask,
  onDeleteTask

}: KanbanColumnProps) {
  const {
    ref,
    handleRef,
    isDragging,
  } = useSortable({
    id: column.id,
    index: column.order,
    disabled: {
      draggable: !isPipelineEditing,
      droppable: false,
    },
  })

  return (
    <section
      ref={ref}
      className={`kanban-column ${isPipelineEditing
        ? 'kanban-column--editing'
        : ''
        } ${isDragging
          ? 'kanban-column--dragging'
          : ''
        }`}
    >
      <header className="kanban-column__header">
        {isPipelineEditing ? (
          <div className="kanban-column__editor">
            <div className="kanban-column__title-row">
              <button
                ref={handleRef}
                type="button"
                className="kanban-column__drag-handle"
                aria-label={`Reorder ${column.title}`}
                title="Drag to reorder section"
              >
                ⠿
              </button>

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
            </div>
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

          if (editingTaskId === task.id) {
            return (
              <TaskCreator
                key={task.id}
                columnTitle={column.title}
                members={members}
                initialTask={task}
                onCreate={(taskInput) =>
                  onUpdateTask(task.id, taskInput)
                }
                onCancel={onCancelEditingTask}
                onDelete={() => onDeleteTask(task.id)}
              />
            )
          }

          return (
            <TaskCard
              key={task.id}
              task={task}
              assignee={assignee}
              taskNumber={index + 1}
              isPipelineEditing={isPipelineEditing}
              isEditing={false}
              onEdit={() => onStartEditingTask(task.id)}
            />
          )
        })}

        {!isPipelineEditing && !isCreatingTask && (
          <button
            type="button"
            className="kanban-column__add-task"
            onClick={onStartCreatingTask}
          >
            + Add Task
          </button>
        )}

        {!isPipelineEditing && isCreatingTask && (
          <TaskCreator
            columnTitle={column.title}
            members={members}
            onCreate={onCreateTask}
            onCancel={onCancelCreatingTask}
          />
        )}
      </div>
    </section>
  )
}