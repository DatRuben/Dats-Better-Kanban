# Dat's: Better Kanban

A customizable Kanban project-management application built with React and TypeScript.

Dat's: Better Kanban focuses on customizable workflows, Google Drive-based project ownership, and lightweight collaboration without requiring a central Dat's project database.

## Live Demo

https://datsbetterkanban.dragooninteractive.com

You can explore the application using Demo Mode without connecting Google Drive.

## Features

- Customizable Kanban pipeline sections
- Drag-and-drop tasks and pipeline sections
- Task priorities, deadlines, descriptions, tags, and assignees
- Priority/deadline and assignee sorting
- Manual ordering for tied tasks
- Image, GIF, and MP4 task attachments
- Timeline view for upcoming work
- Clickable Timeline task details
- Completed-task history
- Clickable Completed History task details
- Configurable completion sections
- Optional priority display for completed sections
- My Tasks view
- Owner, editor, and viewer project roles
- Shared Google Drive projects
- Project switching and remembered projects
- Near-live synchronization between sessions
- Conflict detection for simultaneous edits
- Responsive layouts for smaller screens
- Demo Mode for trying the application without saving data

## Google Drive Storage

When Google Drive mode is used, project data is stored in the user's own Google Drive.

Dat's uses Google's `drive.file` permission rather than requesting general access to the user's entire Drive.

Each project uses a canonical `dats-project.json` document containing the project's Kanban state, including:

- project information
- members
- pipeline sections
- tasks
- task metadata

Attachments are stored as separate Drive files and referenced by the project document.

Using one canonical project document allows a collaborator to explicitly authorize the shared project file while Dat's continues to use the narrower `drive.file` permission.

## Project Structure

A project is organized approximately like this:

```text
Dat's: Better Kanban
└── Projects
    └── Project
        ├── dats-project.json
        └── attachments
            ├── image.png
            └── video.mp4
```

Older project storage formats can be migrated into the canonical project document.

## Collaboration

Projects can be shared through Google Drive.

Dat's supports owner, editor, and viewer roles.

Editors can modify project tasks and workflow data while viewers receive read-only access inside the application.

Project changes are saved to the shared `dats-project.json` document and other sessions periodically check for updates.

When different tasks are changed independently, Dat's attempts to merge both changes.

When conflicting edits are detected, Dat's blocks unsafe automatic overwrites rather than silently replacing another user's work.

## Tech Stack

- React
- TypeScript
- Vite
- CSS
- dnd-kit
- Google Identity Services
- Google Drive API
- Google Picker API

## Running Locally

Clone the repository and install the dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Then open the local address shown by Vite in your browser.


To create a production build:

```bash
npm run build
```


## Current Status

Dat's: Better Kanban is under active development.

The current version demonstrates the core Kanban workflow, customizable pipelines, timeline/history views, Google Drive persistence, synchronization, and task attachments.

Additional project-management features and further UI improvements are planned for future versions.