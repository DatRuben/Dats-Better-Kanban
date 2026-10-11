import { useMemo, useState } from 'react'
import type { Task } from '../types/board'
import './completedHistory.css'

interface CompletedHistoryProps {
  tasks: Task[]
  onOpenTask: (taskId: string) => void
}

type HistoryLayout = 'timeline' | 'list'

function completionTime(task: Task): number {
  const time = Date.parse(task.completedAt ?? task.updatedAt)
  return Number.isFinite(time) ? time : 0
}

function completionLabel(task: Task): string {
  const time = completionTime(task)
  return time === 0
    ? 'Completion time unknown'
    : new Date(time).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
}

function completionDay(task: Task): string {
  const time = completionTime(task)
  return time === 0
    ? 'Unknown date'
    : new Date(time).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
}

export function CompletedHistory({ tasks, onOpenTask }: CompletedHistoryProps) {
  const [layout, setLayout] = useState<HistoryLayout>('timeline')

  const sortedTasks = useMemo(
    () => [...tasks].sort((a, b) =>
      completionTime(b) - completionTime(a) || a.id.localeCompare(b.id),
    ),
    [tasks],
  )

  const timelineGroups = useMemo(() => {
    const groups: Array<{ day: string; tasks: Task[] }> = []

    for (const task of sortedTasks) {
      const day = completionDay(task)
      const lastGroup = groups[groups.length - 1]
      if (lastGroup?.day === day) lastGroup.tasks.push(task)
      else groups.push({ day, tasks: [task] })
    }
    return groups
  }, [sortedTasks])

  return (
    <section className="history-view" aria-label="Completed History">
      <div className="completed-history__toolbar">
        <h2>Completed History</h2>
        <div className="completed-history__mode" aria-label="History view">
          <button type="button" aria-pressed={layout === 'timeline'} onClick={() => setLayout('timeline')}>
            Timeline
          </button>
          <button type="button" aria-pressed={layout === 'list'} onClick={() => setLayout('list')}>
            List
          </button>
        </div>
      </div>

      {sortedTasks.length === 0 && (
        <p className="completed-history__empty">No completed tasks yet.</p>
      )}

      {sortedTasks.length > 0 && layout === 'timeline' && (
        <div className="completed-history__scroll">
          <div className="timeline-list completed-history__timeline">
            {timelineGroups.map((group) => (
              <div key={group.day} className="timeline-group">
                <div className="timeline-group__cards">
                  {group.tasks.map((task) => (
                    <button
                      key={task.id}
                      className="timeline-item"
                      type="button"
                      onClick={() => onOpenTask(task.id)}
                    >
                      <div className="timeline-item__content">
                        <p className="timeline-item__deadline">{completionLabel(task)}</p>
                        <h3>{task.title}</h3>
                        <p className={`timeline-item__priority timeline-item__priority--${task.priority}`}>
                          {task.priority}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
                <div className="timeline-group__marker" aria-label={group.day} />
                <div className="completed-history__date">{group.day}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {sortedTasks.length > 0 && layout === 'list' && (
        <div className="history-list">
          {sortedTasks.map((task) => (
            <button
              key={task.id}
              type="button"
              className="history-item"
              onClick={() => onOpenTask(task.id)}
            >
              <div>
                <h3>{task.title}</h3>
                <p className="history-item__completed-at">{completionLabel(task)}</p>
              </div>
              <span className={`timeline-item__priority timeline-item__priority--${task.priority}`}>
                {task.priority}
              </span>
            </button>
          ))}
        </div>
      )}
    </section>
  )
}
