import type {
  BoardColumn,
  Project,
  Task,
} from '../types/board'

export function createProjectSnapshot(
  project: Project,
  columns: BoardColumn[],
  tasks: Task[],
): Project {
  return {
    ...project,
    columns,
    tasks,
  }
}