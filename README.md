# Dat's: Better Kanban

**Version 1.0.0**

### A customizable, Google Drive-backed project workspace built for collaborative and visual workflows.

Dat's: Better Kanban is a project-management application built with **React and TypeScript** that combines flexible Kanban boards, user-owned cloud storage, and visual asset management.

Rather than relying on a centralized application database, Dat's stores project data directly in Google Drive while supporting shared projects, conflict-aware synchronization, and customizable workflows.

Designed with creative and technical projects in mind, Dat's allows teams to organize tasks alongside images, animations, videos, Blender files, and interactive 3D models.

### [Launch Dat's: Better Kanban](https://datsbetterkanban.dragooninteractive.com)

**Try Demo** to explore the application without connecting a Google account. Demo Mode provides a sample workspace with temporary local changes.

---

## What Makes It Different?

### 1. Google Drive as the Project Database

Dat's uses Google Drive as its primary storage system instead of maintaining a centralized database for project content.

Project information is stored in a canonical `dats-project.json` document, while attachments are stored separately as Google Drive files.

This architecture provides:

- **User-owned storage:** Project information remains in Google Drive.
- **No dedicated application database:** The client communicates directly with Google Drive.
- **Portable project data:** Projects use structured JSON rather than a proprietary hosted database.
- **Google account integration:** Users can create, access, and share projects through Google Drive.
- **Restricted OAuth access:** The application uses Google's `drive.file` scope instead of requesting unrestricted Drive access.

This design keeps project storage under the user's control while supporting collaboration through Google Drive's existing infrastructure.

### 2. Visual Asset Management and Interactive 3D Previews

Dat's extends traditional Kanban task management by allowing users to organize visual assets directly alongside their work.

Tasks support multiple attachments, including:

| Format | Preview | Download |
|---|---|---|
| Images (PNG, JPG, etc.) | Yes | Yes |
| Animated GIFs | Yes | Yes |
| MP4 videos | Yes | Yes |
| GLB 3D models | Interactive | Yes |
| Blender `.blend` files | Source file only | Yes |

**Interactive 3D Model Viewer**

GLB files can be inspected directly within the application using an interactive 3D viewer, including camera rotation and zoom controls.

**Media Carousel**

Tasks display supported media through a navigable attachment carousel, making visual references accessible without leaving the Kanban board.

**Blender Asset Support**

Original `.blend` project files can be attached and downloaded alongside GLB exports. Blender files are preserved in their original format rather than being automatically converted.

**Attachment Management**

Multiple-file uploads, original-file downloads, individual attachment removal, preview retries, and Google Drive file authorization are integrated into the task workflow.

These features make Dat's particularly suitable for projects involving game development, 3D modeling, design, and other visual production workflows.

### 3. Collaboration Without a Dedicated Backend

Dat's supports shared project workflows using Google Drive permissions, periodic synchronization, and conflict-aware updates.

Instead of relying on a custom collaboration server, the application communicates with Google Drive directly from the browser.

**Project Sharing**

Projects support three access roles:

| Role | Access |
|---|---|
| Owner | Project configuration, membership, and task management |
| Editor | Shared task and workflow editing |
| Viewer | Read-only project access |

**Three-Way Synchronization**

To manage changes across multiple sessions, Dat's compares three versions of project data:

1. The previously synchronized state
2. The local state
3. The latest remote state from Google Drive

Independent changes can be merged, while conflicting edits are identified rather than silently overwritten.

Synchronization uses periodic updates rather than instantaneous Google Docs-style collaboration.

**Shared File Authorization**

Google Picker integration helps collaborators authorize access to project documents, attachment folders, and individual shared files while respecting Google Drive permissions.

### 4. Flexible Kanban Workflows

Dat's is designed around customizable workflows rather than a fixed set of Kanban stages.

Users can define their own pipeline sections, reorder them, and choose which sections represent completed work.

**Separate Editing Modes**

- **Pipeline Edit:** Customize the workflow structure, section order, and completion settings.
- **Task Edit:** Create, modify, organize, and move tasks.

Keeping these modes separate reduces accidental edits during normal project viewing.

**Configurable Task Organization**

Tasks support priorities, deadlines, assignments, descriptions, and tags.

Automatic sorting can use priority and deadline information, while manual ordering is available for otherwise-equal tasks.

Completed sections default to newest-completed-first ordering but can use priority/deadline ordering instead.

---

## Additional Project Features

Alongside its main differentiators, Dat's includes standard task-management functionality and several ways to explore project work.

| Feature | Description |
|---|---|
| Kanban Board | Organize tasks using draggable, customizable pipeline sections |
| Timeline | Browse tasks in a timeline-style layout with detailed task information |
| My Tasks | Focus on active tasks assigned to the current Google account |
| Completed History | Review completed work using timeline and list presentations |
| Task Organization | Priorities, deadlines, assignments, descriptions, and up to three tags |
| Project Management | Multiple projects, editable project information, and member management |
| Demo Mode | Explore a sample workspace without connecting Google Drive |

---

## Technical Architecture

Dat's is a client-side application that integrates directly with Google services.

```text
                         React + TypeScript
                                |
                         Application UI
                                |
                 Project / Task State Management
                                |
               Synchronization and Conflict Handling
                                |
                     Google Drive API
                                |
                 User-Owned Project Storage
                         /             \
                Project JSON        Attachments
```

### Data Storage

A project uses the canonical `dats-project.json` document to store:

- Project information and settings
- Pipeline configuration
- Tasks and task metadata
- Member information and access roles
- Attachment references

Attachments are stored separately in Google Drive and referenced by file ID.

Example:

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

### Engineering Considerations

The implementation addresses several challenges beyond standard task CRUD:

- Synchronizing project state across independent browser sessions
- Detecting conflicting modifications without a central server
- Separating Google Drive sharing permissions from application-level file authorization
- Managing attachment references independently from task metadata
- Preserving project data during attachment changes and cleanup
- Supporting browser-based 3D rendering within reusable React components
- Maintaining customizable ordering rules across different workflow sections

---

## Technology Stack

| Technology | Usage |
|---|---|
| **React** | Component-based user interface |
| **TypeScript** | Typed application logic and data models |
| **Vite** | Development tooling and production builds |
| **CSS** | Custom styling and responsive layouts |
| **dnd-kit** | Drag-and-drop task and pipeline interactions |
| **Google Identity Services** | OAuth authentication |
| **Google Drive API** | Project persistence, sharing, and attachments |
| **Google Picker API** | Shared-file selection and authorization |
| **Google Model Viewer** | Interactive GLB previews |
| **Three.js** | 3D rendering support |

---

## Running Locally

### Requirements

- Node.js and npm
- A modern web browser
- Google Cloud configuration for Google Drive functionality

### Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/DatRuben/Dats-Better-Kanban.git
cd Dats-Better-Kanban
npm install
```

Start the development server:

```bash
npm run dev
```

Open the local address displayed by Vite.

### Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Start the development server |
| `npm run build` | Compile TypeScript and create a production build |
| `npm run preview` | Preview the production build |
| `npm run lint` | Run ESLint |

On Windows PowerShell, `npm.cmd` can be used instead of `npm` if script execution restrictions apply.

### Google Drive Configuration

Google Drive integration requires Google Cloud OAuth and API configuration.

Set the following environment variables in a local `.env.local` file:

```env
VITE_GOOGLE_CLIENT_ID=your-google-oauth-client-id
VITE_GOOGLE_PICKER_API_KEY=your-google-picker-api-key
VITE_GOOGLE_APP_ID=your-google-cloud-project-number
```

Configure the appropriate APIs and authorized JavaScript origins in Google Cloud.

Variables prefixed with `VITE_` are exposed to browser code and must not contain private client secrets.

**Demo Mode is available without Google Drive configuration.**

---

## Privacy and Data Ownership

Dat's stores project documents and attachments in Google Drive rather than a centralized Dat's-owned project database.

Google Drive access uses the OAuth scope:

`https://www.googleapis.com/auth/drive.file`

This limits the application to files created or authorized for use with Dat's instead of requesting unrestricted access to a user's entire Drive.

Shared project access remains subject to Google Drive permissions and application authorization.

A Privacy Policy is available within the application.

---

## Version 1.0

Dat's: Better Kanban combines **customizable Kanban workflows, user-owned Google Drive storage, conflict-aware collaboration, and interactive visual asset management** in a single project workspace.

Built with React and TypeScript, the project explores how existing cloud infrastructure can support a collaborative application without requiring a dedicated project database or backend server.

**[Try Dat's: Better Kanban](https://datsbetterkanban.dragooninteractive.com)**
