import type { Project } from '../types/board'

export const demoProject: Project = {
  id: 'storygame-development',
  name: 'StoryGame Development',

  columns: [
    {
      id: 'backlog',
      title: 'Backlog',
      order: 0,
    },
    {
      id: 'ready',
      title: 'Ready',
      order: 1,
    },
    {
      id: 'in-progress',
      title: 'In Progress',
      order: 2,
    },
    {
      id: 'review',
      title: 'Review',
      order: 3,
    },
    {
      id: 'complete',
      title: 'Complete',
      order: 4,
    },
  ],

  tasks: [
    {
      id: 'night-crawler-hitbox',
      title: 'Create Night Crawler hitbox',
      description: 'Add the first simple hitbox for the Night Crawler.',
      columnId: 'backlog',
      priority: 'medium',
      assigneeId: 'ruben',
      deadline: null,
      attachments: [],
      createdAt: '2026-08-28',
    },
  ],

  members: [
    {
      id: 'ruben',
      displayName: 'Ruben Becerril',
      role: 'Gameplay Developer',
    },
    {
      id: 'sammie',
      displayName: 'Samantha Matthews',
      role: '3D Artist/Animator',
    },
  ],
}