
# Dat's: Better Kanban

**Version 1.0.0**

A customizable Kanban project-management application built with React and TypeScript.

Dat's: Better Kanban provides customizable workflows, task organization, and Google Drive-based project storage without requiring a centralized Dat's project database.

## Live Demo

https://datsbetterkanban.dragooninteractive.com

Use Demo Mode to explore the application without connecting a Google account. Demo changes are not persisted.

## Features

### Task Management

- Customizable Kanban pipeline sections
- Drag-and-drop tasks and pipeline sections
- Task priorities, deadlines, descriptions, tags, and assignees
- Priority/deadline and assignee sorting
- Manual ordering for tied tasks
- Timeline and My Tasks views
- Completed-task history
- Configurable completion sections

### Attachments

Supported attachments include:

- Images and GIFs
- MP4 videos
- Blender `.blend` files
- `.glb` 3D models

Images, GIFs, and MP4 videos can be previewed in task cards.

GLB models support interactive 3D preview.

Blender files are preserved as source files. Dat's does not automatically convert `.blend` files into GLB models.

### Google Drive Integration

- Google Drive project storage
- Shared projects
- Owner, editor, and viewer roles
- Project switching
- Periodic synchronization between sessions
- Conflict detection for simultaneous edits
- Google Picker integration
- Attachment authorization and recovery controls

## Project Storage

Dat's uses the Google Drive API with the `drive.file` OAuth scope.

Project data is stored in Google Drive rather than a centralized Dat's database.

The canonical `dats-project.json` document contains project information, members, columns, tasks, and attachment references.

Attachments are stored as separate Google Drive files.

Example:

```text
Dat's: Better Kanban/
└── Projects/
    └── Project/
        ├── dats-project.json
        └── attachments/
            ├── image.png
            ├── video.mp4
            ├── model.blend
            └── model.glb
```

Legacy project formats can be migrated into the canonical project document.

## Collaboration

Project owners can share Google Drive projects with other users.

Dat's supports three project roles:

- **Owner:** Manage project settings, members, and tasks
- **Editor:** Modify shared project tasks and workflow data
- **Viewer:** Read-only access within the application

Users may need to authorize the shared project document, attachments folder, or individual files through Google Picker.

Google Drive sharing permissions and app-level file authorization are separate requirements.

### Synchronization

Each session periodically checks the shared project document for updates.

Independent task changes can be merged through the application's three-way merge system.

Conflicting edits are reported instead of automatically choosing an unsafe local overwrite.

Synchronization is periodic rather than transactional or instantaneous. Simultaneous saves require care, and Google Drive access is subject to the user's permissions.

## Tech Stack

- React
- TypeScript
- Vite
- CSS
- dnd-kit
- Google Identity Services
- Google Drive API
- Google Picker API
- Google Model Viewer
- Three.js

## Running Locally

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Build for production:

```bash
npm run build
```

Google Drive features additionally require valid Google Cloud OAuth and Picker configuration.

## Version 1.0

Version 1.0 establishes the initial Kanban, project persistence, collaboration, and attachment workflows.

The application continues to evolve, with future improvements planned for the user interface, synchronization, and shared-file experience.