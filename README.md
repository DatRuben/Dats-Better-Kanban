# Dat's: Better Kanban

**Version 1.0.0**

A customizable Kanban project-management application built with **React, TypeScript, and Google Drive integration**.

Dat's: Better Kanban helps individuals and teams organize tasks, customize workflows, collaborate on projects, and manage visual references—including interactive 3D models. Project data is stored directly in Google Drive rather than in a centralized Dat's project database.

## Live Application

**[Open Dat's: Better Kanban](https://datsbetterkanban.dragooninteractive.com)**

Choose **Try Demo** to explore a sample project without connecting a Google account. Demo Mode supports task management and attachments, but changes are temporary. Connect Google Drive for persistent projects and collaboration.

---

## Features

### Kanban Board and Task Management

- Customizable pipeline sections with drag-and-drop reordering
- Up to 100 pipeline sections
- Separate **Task Edit** and **Pipeline Edit** modes
- Task creation, editing, deletion, and movement between sections
- Four priority levels: **Critical**, **High**, **Medium**, and **Low**
- Task descriptions, deadlines, and assignees
- Up to three tags per task, with autocomplete based on existing project tags
- Filtering and sorting by assignee
- Automatic priority/deadline ordering and manual ordering for otherwise-equal tasks
- Editable project names and descriptions
- Responsive layouts for different screen sizes

### Workflow Customization

**Pipeline Edit Mode** lets users add, rename, reorder, and delete empty sections. Each section can be configured as a completed stage.

Completed sections show the most recently completed tasks first by default. They can instead use **Priority/Deadline Ordering**, and priority labels can be hidden on completed task cards.

**Task Edit Mode** separates task changes from ordinary board viewing, including task movement between sections.

### Project Views

| View | Purpose |
|---|---|
| **Board** | Organize tasks across configurable Kanban sections. |
| **Timeline** | Browse tasks in a timeline-style layout and open full task details. |
| **My Tasks** | View active tasks assigned to the connected Google account. |
| **Completed History** | Review finished tasks by completion time using Timeline or List layouts. |

Selecting a Timeline or Completed History item opens task details, including its title, description, status, priority, deadline, assignee, tags, attachments, and timestamps.

### Attachments and Media

Tasks can contain multiple attachments. Visual attachments appear in a carousel on task cards and in task details.

| File type | Browser preview | Download |
|---|---|---|
| PNG, JPG, and other supported images | Yes | Yes |
| Animated GIF | Yes | Yes |
| MP4 video | Yes | Yes |
| GLB 3D model | Interactive 3D | Yes |
| Blender `.blend` | No | Yes |

Attachment management includes:

- Multiple file uploads and selection across separate batches
- Duplicate selection prevention and individual attachment removal
- Original-file downloads for every supported attachment type
- Retry controls for failed previews
- Google Drive file authorization and recovery controls
- Google Drive resumable upload sessions

**3D previews:** GLB files can be viewed interactively with camera controls, zoom, and rotation. The viewer uses Google Model Viewer and Three.js.

**Blender source files:** `.blend` files are kept as downloadable original assets. Dat's does **not** automatically convert `.blend` to `.glb`; a GLB export can be attached separately for browser preview.

---

## Google Drive Integration

Dat's uses Google Drive for persistent projects and attachments without requiring a centralized application database.

- Create, open, and switch between projects
- Store project data and file attachments in Google Drive
- Share projects with other Google accounts
- Manage project members and access roles
- Synchronize changes periodically between sessions
- Detect and report conflicting edits
- Authorize existing shared files and folders with Google Picker

### Collaboration and Permissions

| Role | Access within Dat's |
|---|---|
| **Owner** | Manage project settings, members, workflows, and tasks. |
| **Editor** | Modify tasks and workflows in a shared project. |
| **Viewer** | Read-only project access. |

Google Drive sharing permissions and authorization to access a file through the app are distinct. Collaborators can use Google Picker to authorize shared project documents, attachment folders, or individual files as needed.

### Synchronization

Dat's periodically checks Google Drive for updates and uses **three-way merging** to compare previously synchronized state, local changes, and remote changes. Independent edits can be merged, while conflicts are identified rather than silently overwritten.

Synchronization is periodic rather than Google Docs-style instantaneous editing.

### Project Storage

The canonical `dats-project.json` document stores project information, descriptions, members, sections, tasks, and attachment references. Attachments are stored separately in the project's Google Drive folder.

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

### Attachment Cleanup

Unreferenced shared attachments are eligible for cleanup after a grace period. Cleanup uses Google Drive Trash and respects current attachment references and Drive permissions.

---

## Technology Stack

| Technology | Purpose |
|---|---|
| **React** | Component-based user interface |
| **TypeScript** | Application logic and type safety |
| **Vite** | Development server and production builds |
| **CSS** | Styling and responsive layouts |
| **dnd-kit** | Task and pipeline drag-and-drop |
| **Google Identity Services** | Google authentication |
| **Google Drive API** | Project and attachment storage |
| **Google Picker API** | File selection and authorization |
| **Google Model Viewer** | Interactive GLB previews |
| **Three.js** | 3D rendering support |

The client-side application separates UI components, task and project data models, Google Drive operations, authorization, synchronization, and attachment handling.

---

## Running Locally

### Requirements

- Node.js and npm
- A modern web browser
- Google Cloud configuration to use Google Drive features

### Installation

```bash
git clone https://github.com/DatRuben/Dats-Better-Kanban.git
cd Dats-Better-Kanban
npm install
npm run dev
```

Open the development URL displayed by Vite.

### Commands

| Command | Description |
|---|---|
| `npm run dev` | Start the development server |
| `npm run build` | Compile TypeScript and build for production |
| `npm run preview` | Preview the production build |
| `npm run lint` | Run ESLint |

On Windows PowerShell, use `npm.cmd` instead of `npm` if script execution restrictions apply.

### Google Drive Configuration

Configure a Google Cloud OAuth client, the Google Drive API, Google Picker API, and appropriate authorized JavaScript origins.

Dat's reads these Vite environment variables:

```env
VITE_GOOGLE_CLIENT_ID=your-google-oauth-client-id
VITE_GOOGLE_PICKER_API_KEY=your-google-picker-api-key
VITE_GOOGLE_APP_ID=your-google-cloud-project-number
```

Store local values in `.env.local`. Vite variables prefixed with `VITE_` are exposed to the browser; do not put private client secrets in them.

**Demo Mode does not require Google Drive configuration.**

---

## Privacy and Data Ownership

Project documents and attachments are stored in Google Drive rather than a centralized Dat's-owned database.

The app uses the Google Drive OAuth scope:

```text
https://www.googleapis.com/auth/drive.file
```

This provides access to files created or authorized for the app without requesting unrestricted access to the user's entire Drive. Shared-file access also depends on the relevant Google Drive permissions.

A Privacy Policy is available in the application.

---

## Version 1.0

Version 1.0 includes the planned Kanban board, customizable workflows, task management, assignment and sorting, Timeline and Completed History views, Google Drive-backed projects, shared project roles, periodic synchronization, and visual attachments with interactive 3D previews.

**Dat's: Better Kanban combines configurable Kanban workflows, user-owned storage, and visual asset management in one project workspace.**