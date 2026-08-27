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

  tasks: [],

  members: [
    {
      id: 'ruben',
      displayName: 'Ruben Becerril',
      role: 'Gameplay Developer',
    },
    {
      id: 'maya',
      displayName: 'Maya',
      role: '3D Artist',
    },
    {
      id: 'jordan',
      displayName: 'Jordan',
      role: 'Animator',
    },
    {
      id: 'alex',
      displayName: 'Alex',
      role: 'UI Developer',
    },
  ],
}