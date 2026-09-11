import type { Project } from '../types/board'

export interface ProjectStorage {
  loadProject(projectId: string): Promise<Project | null>
  saveProject(project: Project): Promise<void>
}