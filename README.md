
# Dat's: Better Kanban

**Version 1.0.0**

A customizable Kanban project-management application built with React, TypeScript, and Google Drive integration.

Dat's: Better Kanban helps individuals and teams organize projects, manage tasks, customize workflows, and work with visual attachments, including interactive 3D models.

Unlike traditional project-management applications that depend on a centralized application database, Dat's stores project information directly in the project owner's Google Drive.

## Live Demo

https://datsbetterkanban.dragooninteractive.com

**Try Demo** lets visitors explore the application without connecting a Google account.

Demo Mode includes sample project data and supports local task editing and attachments. Changes made in Demo Mode are temporary and are not saved across sessions.

Google Drive integration is required for persistent projects and collaboration.

## Features

### Kanban Board and Task Management

- Customizable pipeline sections with drag-and-drop reordering
- Up to 100 pipeline sections
- Separate Pipeline Edit and Task Edit modes
- Task creation, editing, deletion, and movement between sections
- Critical, high, medium, and low task priorities
- Deadlines, descriptions, and assignees
- Up to three tags per task with project-wide tag suggestions
- Assignee filtering and sorting
- Priority and deadline-based task ordering
- Manual ordering for otherwise-equal tasks
- Editable project name and description

### Workflow Customization

Pipeline sections can be marked as completed sections.

Completed sections normally display recently completed tasks first, but can optionally use priority/deadline ordering.

The application also supports hiding priority labels on completed task cards.

Task Edit and Pipeline Edit are separate modes to help prevent accidental changes during ordinary project viewing.

### Project Views

**Board**

The main Kanban view for organizing tasks, managing pipeline stages, and updating task status.

**Timeline**

A timeline-style presentation of tasks. Selecting a task opens a detailed view containing its description, priority, deadline, assignee, tags, and attachments.

**My Tasks**

Shows active tasks assigned to the connected Google account.

**Completed History**

Tracks completed work using completion timestamps. Supports both Timeline and List layouts, with Timeline as the default.

### Attachments and Media

Tasks support multiple attachments, including:

| File type | Browser preview | Download |
|-----------|-----------------|----------|
| PNG, JPG, and other supported images | Yes | Yes |
| Animated GIF | Yes | Yes |
| MP4 video | Yes | Yes |
| GLB 3D model | Interactive 3D | Yes |
| Blender `.blend` | No | Yes |

Images, videos, and GLB models appear in an attachment carousel on task cards and in task details.

GLB previews support interactive camera controls and model rotation.

Additional attachment functionality includes:

- Selecting and uploading multiple files
- Adding files through multiple selection batches
- Preventing duplicate selections
- Removing individual attachments
- Downloading original files
- Retrying failed previews
- Google Drive file-access and authorization controls
- Google Drive resumable upload sessions for file transfers

Blender `.blend` files are stored as original source attachments. They are not automatically converted into GLB models. To preview a Blender model interactively, a GLB version must be provided separately.

### Google Drive Integration

Dat's supports:

- Creating and opening projects stored in Google Drive
- Switching between available projects
- Sharing projects with other Google accounts
- Project member management
- Owner, editor, and viewer roles
- Periodic project synchronization
- Detection of conflicting edits
- Google Picker authorization for shared files
- Attachment upload, download, and recovery handling

Project data remains in Google Drive rather than a centralized Dat's project database.

## Collaboration and Permissions

Projects can be shared with multiple users.

The application supports three roles:

| Role | Access |
|------|--------|
| Owner | Manage project settings, members, workflows, and tasks |
| Editor | Edit shared project tasks and workflows |
| Viewer | Read-only access within Dat's |

Google Drive permissions and application-level file authorization are separate requirements.

A collaborator may need to select an existing shared file or the project's attachments folder through Google Picker before Dat's can access it.

### Synchronization

Dat's periodically checks Google Drive for changes made by other sessions.

The application uses three-way merging and conflict detection to help preserve independent changes and identify conflicting edits.

Synchronization is not instantaneous or transactional. Simultaneous edits can still require manual resolution.

Dat's is designed for practical collaboration rather than Google Docs-style real-time editing.

## Project Storage

Dat's uses the Google Drive API with the following OAuth scope:

`https://www.googleapis.com/auth/drive.file`

This allows Dat's to work with files created or authorized for the application without requesting unrestricted access to the user's entire Google Drive.

Project information is stored in a canonical `dats-project.json` document.

The project document includes:

- Project information and description
- Pipeline sections and settings
- Tasks and their metadata
- Members and access roles
- Attachment file references

Attachments are stored as separate Google Drive files.

Example project structure:

```text
Dat's: Better Kanban/
└── Projects/
    └── My Project/
        ├── dats-project.json
        └── attachments/
            ├── reference.png
            ├── animation.gif
            ├── demonstration.mp4
            ├── character.blend
            └── character.glb
```

Legacy project formats have migration support.

### Attachment Removal

Shared attachment cleanup uses a grace period before attempting to move unreferenced files to Google Drive Trash.

Cleanup is subject to Google Drive permissions and successful project synchronization.

## Technology Stack

| Technology | Purpose |
|------------|---------|
| React | User interface |
| TypeScript | Application logic and type safety |
| Vite | Development and production builds |
| CSS | Styling and responsive layouts |
| dnd-kit | Task and pipeline drag-and-drop |
| Google Identity Services | Google authentication |
| Google Drive API | Project and attachment storage |
| Google Picker API | File selection and authorization |
| Google Model Viewer | Interactive GLB previews |
| Three.js | 3D rendering support |

## Running Locally

### Requirements

- Node.js and npm
- A modern web browser
- Google Cloud configuration for Google Drive features

### Installation

Clone the repository:

```bash
git clone https://github.com/DatRuben/Dats-Better-Kanban.git
```

Enter the project directory:

```bash
cd Dats-Better-Kanban
```

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Open the local URL displayed by Vite.

### Validation

Production build:

```bash
npm run build
```

Lint:

```bash
npm run lint
```

Preview the production build locally:

```bash
npm run preview
```

On Windows PowerShell, `npm.cmd` can be used in place of `npm` if PowerShell script execution restrictions prevent the npm command from running.

### Google Drive Configuration

To use Google Drive features in a local development environment, configure the Google Cloud OAuth client, Drive API, and Picker API.

The application reads these Vite environment variables:

```env
VITE_GOOGLE_CLIENT_ID=your-google-oauth-client-id
VITE_GOOGLE_PICKER_API_KEY=your-google-picker-api-key
VITE_GOOGLE_APP_ID=your-google-cloud-project-number
```

These may be placed in a local `.env.local` file.

Configure the appropriate authorized JavaScript origins for your development or deployed environment in Google Cloud.

Vite variables prefixed with `VITE_` are exposed to the browser. Do not place private client secrets or other sensitive credentials in them.

Demo Mode can be used without Google Drive configuration.

## Privacy and Data Ownership

Dat's uses Google Drive as its primary project storage system.

The application does not require a centralized Dat's-owned project database for project content.

Google Drive access depends on the connected user's authorization and the permissions granted to individual files and folders.

The deployed application includes a Privacy Policy accessible from its interface.

## Version 1.0 Status

Version 1.0 includes the planned Kanban, workflow customization, task-management, timeline, history, collaboration, and attachment systems.

The core feature set is implemented in the repository.

Manual release verification is still needed for the latest attachment upload changes, shared-project permissions, and end-to-end workflows before treating the release as fully validated.
