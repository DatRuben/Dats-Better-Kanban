import type { BoardColumn, Task } from '../types/board'

export function moveTaskToColumn(
  task: Task,
  currentColumn: BoardColumn,
  targetColumn: BoardColumn,
  completionTime: string,
) {
  const enteringCompleted =
    !currentColumn.countsAsCompleted &&
    targetColumn.countsAsCompleted

  const leavingCompleted =
    currentColumn.countsAsCompleted &&
    !targetColumn.countsAsCompleted

  let nextCompletedAt = task.completedAt

  if (enteringCompleted) {
    nextCompletedAt = task.completedAt ?? completionTime
  }

  if (leavingCompleted) {
    nextCompletedAt = null
  }

  return {
    ...task,
    columnId: targetColumn.id,
    completedAt: nextCompletedAt,
  }
}