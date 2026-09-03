export type Priority = 'critical' | 'high' | 'medium' | 'low'

export interface DemoUser {
  id: string
  displayName: string
  role: string
}

export interface Attachment {
  id: string
  fileName: string
  mimeType: string
  previewUrl: string
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
  completedAt: string | null
}

export interface BoardColumn {
  id: string
  title: string
  order: number
  countsAsCompleted: boolean
}

export interface Project {
  id: string
  name: string
  columns: BoardColumn[]
  tasks: Task[]
  members: DemoUser[]
}