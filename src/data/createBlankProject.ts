import type { Project } from '../types/board'

export function createBlankProject(): Project {
  return {
    schemaVersion: 2,
    id: crypto.randomUUID(),
    name: 'Untitled Project',

    columns: [
      {
        id: 'backlog',
        title: 'Backlog',
        order: 0,
        countsAsCompleted: false,
      },
      {
        id: 'ready',
        title: 'Ready',
        order: 1,
        countsAsCompleted: false,
      },
      {
        id: 'in-progress',
        title: 'In Progress',
        order: 2,
        countsAsCompleted: false,
      },
      {
        id: 'review',
        title: 'Review',
        order: 3,
        countsAsCompleted: false,
      },
      {
        id: 'complete',
        title: 'Complete',
        order: 4,
        countsAsCompleted: true,
      },
    ],

    tasks: [],
    members: [],
  }
}