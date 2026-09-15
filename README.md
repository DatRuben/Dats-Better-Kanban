# Dat's: Better Kanban

A customizable Kanban project-management application built with React and TypeScript.

Dat's: Better Kanban focuses on giving users control over their workflow while keeping their project data in their own Google Drive instead of a central Dat's project database.

## Live Demo

https://datsbetterkanban.dragooninteractive.com

You can explore the application using Demo Mode without connecting Google Drive.

## Features

- Customizable Kanban pipeline sections
- Drag-and-drop tasks and pipeline sections
- Task priorities, deadlines, descriptions, and assignees
- Automatic task sorting by priority and deadline
- Task image attachments
- Timeline view for upcoming work
- Completed-task history
- Configurable completion sections
- Responsive layout for smaller screens
- Google Drive project persistence
- Near-live synchronization between sessions
- Demo Mode for trying the application without saving data

## Google Drive Storage

When Google Drive mode is used, project files are stored inside the user's own Google Drive.

Dat's creates its own project folder containing project metadata, column data, individual task files, and attachment files.

The application uses Google's `drive.file` permission so it can work with files created for the application without requesting general access to the user's entire Drive.

## Project Structure

A saved project is organized approximately like this:

```text
Dat's: Better Kanban
└── Projects
    └── Project Name
        ├── project.json
        ├── columns.json
        ├── tasks
        │   └── Task Name.json
        └── attachments
            └── image.png