import { useState } from 'react'
import type { FormEvent } from 'react'
import type {
  DemoUser,
  NewTaskInput,
  Priority,
} from '../types/board'

interface TaskCreatorProps {
  columnTitle: string
  members: DemoUser[]
  onCreate: (task: NewTaskInput) => void
  onCancel: () => void
}

export function TaskCreator({
  columnTitle,
  members,
  onCreate,
  onCancel,
}: TaskCreatorProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] =
    useState<Priority>('medium')
  const [assigneeId, setAssigneeId] = useState('')
  const [deadline, setDeadline] = useState('')

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const trimmedTitle = title.trim()

    if (!trimmedTitle) {
      return
    }

    onCreate({
      title: trimmedTitle,
      description: description.trim(),
      priority,
      assigneeId: assigneeId || null,
      deadline: deadline || null,
    })
  }

  return (
    <form
      className="task-creator"
      onSubmit={handleSubmit}
    >
      <div className="task-creator__header">
        <div>
          <p className="task-creator__heading">
            New task
          </p>

          <p className="task-creator__hint">
            Creating in {columnTitle}
          </p>
        </div>
      </div>

      <label className="task-creator__field">
        <span>Title</span>

        <input
          type="text"
          value={title}
          placeholder="Task title"
          autoFocus
          onChange={(event) =>
            setTitle(event.target.value)
          }
        />
      </label>

      <label className="task-creator__field">
        <span>Description</span>

        <textarea
          value={description}
          placeholder="What needs to be done?"
          rows={3}
          onChange={(event) =>
            setDescription(event.target.value)
          }
        />
      </label>

      <div className="task-creator__field-row">
        <label className="task-creator__field">
          <span>Priority</span>

          <select
            value={priority}
            onChange={(event) =>
              setPriority(
                event.target.value as Priority,
              )
            }
          >
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </label>

        <label className="task-creator__field">
          <span>Deadline</span>

          <input
            type="date"
            value={deadline}
            onChange={(event) =>
              setDeadline(event.target.value)
            }
          />
        </label>
      </div>

      <label className="task-creator__field">
        <span>Assignee</span>

        <select
          value={assigneeId}
          onChange={(event) =>
            setAssigneeId(event.target.value)
          }
        >
          <option value="">Unassigned</option>

          {members.map((member) => (
            <option
              key={member.id}
              value={member.id}
            >
              {member.displayName}
            </option>
          ))}
        </select>
      </label>

      <div className="task-creator__actions">
        <button
          type="button"
          className="task-creator__cancel"
          onClick={onCancel}
        >
          Cancel
        </button>

        <button
          type="submit"
          className="task-creator__create"
          disabled={!title.trim()}
        >
          Create Task
        </button>
      </div>
    </form>
  )
}