export type Priority = 'critical' | 'high' | 'medium' | 'low'

export type ProjectAccessRole =
  | 'owner'
  | 'editor'
  | 'viewer'

export interface DemoUser {
  id: string
  displayName: string
  role: string
  email?: string
  accessRole?: ProjectAccessRole
}

export interface Attachment {
  id: string
  fileName: string
  mimeType: string
  previewUrl?: string
  driveFileId?: string
}

export interface Task {
  id: string
  title: string
  description: string
  columnId: string
  priority: Priority
  assigneeId: string | null
  deadline: string | null
  attachments: Attachment[]
  createdAt: string
  updatedAt: string
  completedAt: string | null
  revision: number
}

export interface NewTaskInput {
  title: string
  description: string
  priority: Priority
  assigneeId: string | null
  deadline: string | null
  attachments: Attachment[]
}

export interface BoardColumn {
  id: string
  title: string
  order: number
  countsAsCompleted: boolean
  usePriorityDeadlineOrdering?: boolean
}

export interface Project {
  schemaVersion: number
  id: string
  name: string
  columns: BoardColumn[]
  tasks: Task[]
  members: DemoUser[]
}