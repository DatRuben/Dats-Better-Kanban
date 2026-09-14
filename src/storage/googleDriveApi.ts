import type {
  BoardColumn,
  DemoUser,
  Project,
  Task,
} from '../types/board'

const GOOGLE_DRIVE_FILES_URL =
  'https://www.googleapis.com/drive/v3/files'

const GOOGLE_DRIVE_FOLDER_MIME_TYPE =
  'application/vnd.google-apps.folder'

const DATS_FOLDER_NAME =
  "Dat's: Better Kanban"

const PROJECTS_FOLDER_NAME =
  'Projects'

const PROJECT_FILE_NAME =
  'project.json'

const TASKS_FOLDER_NAME =
  'tasks'

const COLUMNS_FILE_NAME =
  'columns.json'

const CURRENT_SCHEMA_VERSION =
  2

interface StoredProjectMetadata {
  schemaVersion: number
  id: string
  name: string
  members: DemoUser[]
}

export interface LoadedDriveProject {
  project: Project
  projectFolderId: string
  tasksFolderId: string
}

export async function verifyGoogleDriveAccess(
  accessToken: string,
): Promise<void> {
  const url = new URL(GOOGLE_DRIVE_FILES_URL)

  url.searchParams.set('pageSize', '1')
  url.searchParams.set('fields', 'files(id)')

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })

  if (!response.ok) {
    throw new Error(
      `Google Drive request failed with status ${response.status}.`,
    )
  }
}

function escapeDriveQueryValue(value: string) {
  return value
    .replaceAll('\\', '\\\\')
    .replaceAll("'", "\\'")
}

async function findFolder(
  accessToken: string,
  folderName: string,
  parentFolderId?: string,
): Promise<string | null> {
  const url = new URL(GOOGLE_DRIVE_FILES_URL)

  const escapedFolderName =
    escapeDriveQueryValue(folderName)

  const queryParts = [
    `name = '${escapedFolderName}'`,
    `mimeType = '${GOOGLE_DRIVE_FOLDER_MIME_TYPE}'`,
    'trashed = false',
  ]

  if (parentFolderId) {
    queryParts.push(
      `'${parentFolderId}' in parents`,
    )
  }

  url.searchParams.set(
    'q',
    queryParts.join(' and '),
  )

  url.searchParams.set(
    'fields',
    'files(id,name)',
  )

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })

  if (!response.ok) {
    throw new Error(
      `Google Drive folder search failed with status ${response.status}.`,
    )
  }

  const data = await response.json() as {
    files: Array<{
      id: string
      name: string
    }>
  }

  return data.files[0]?.id ?? null
}

async function createFolder(
  accessToken: string,
  folderName: string,
  parentFolderId?: string,
): Promise<string> {
  const folderMetadata: {
    name: string
    mimeType: string
    parents?: string[]
  } = {
    name: folderName,
    mimeType: GOOGLE_DRIVE_FOLDER_MIME_TYPE,
  }

  if (parentFolderId) {
    folderMetadata.parents = [parentFolderId]
  }

  const response = await fetch(
    GOOGLE_DRIVE_FILES_URL,
    {
      method: 'POST',

      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },

      body: JSON.stringify(folderMetadata),
    },
  )

  if (!response.ok) {
    throw new Error(
      `Google Drive folder creation failed with status ${response.status}.`,
    )
  }

  const folder = await response.json() as {
    id: string
  }

  return folder.id
}

export async function ensureDatsDriveFolder(
  accessToken: string,
): Promise<string> {
  const existingFolderId =
    await findFolder(
      accessToken,
      DATS_FOLDER_NAME,
    )

  if (existingFolderId) {
    return existingFolderId
  }

  return createFolder(
    accessToken,
    DATS_FOLDER_NAME,
  )
}

export async function ensureProjectsDriveFolder(
  accessToken: string,
  datsFolderId: string,
): Promise<string> {
  const existingFolderId =
    await findFolder(
      accessToken,
      PROJECTS_FOLDER_NAME,
      datsFolderId,
    )

  if (existingFolderId) {
    return existingFolderId
  }

  return createFolder(
    accessToken,
    PROJECTS_FOLDER_NAME,
    datsFolderId,
  )
}

export async function ensureProjectTasksFolder(
  accessToken: string,
  projectsFolderId: string,
  projectId: string,
): Promise<string> {
  const projectFolderId =
    await findFolder(
      accessToken,
      projectId,
      projectsFolderId,
    )

  if (!projectFolderId) {
    throw new Error(
      'Google Drive project folder could not be found.',
    )
  }

  const existingTasksFolderId =
    await findFolder(
      accessToken,
      TASKS_FOLDER_NAME,
      projectFolderId,
    )

  if (existingTasksFolderId) {
    return existingTasksFolderId
  }

  return createFolder(
    accessToken,
    TASKS_FOLDER_NAME,
    projectFolderId,
  )
}

export async function createProjectOnDrive(
  accessToken: string,
  projectsFolderId: string,
  project: Project,
): Promise<{
  projectFolderId: string
  tasksFolderId: string
}> {
  const projectFolderId =
    await createFolder(
      accessToken,
      project.id,
      projectsFolderId,
    )

  const tasksFolderId =
    await createFolder(
      accessToken,
      TASKS_FOLDER_NAME,
      projectFolderId,
    )

  await saveColumnsToDrive(
    accessToken,
    projectFolderId,
    project.columns,
  )

  await Promise.all(
    project.tasks.map((task) =>
      saveTaskToDrive(
        accessToken,
        tasksFolderId,
        task,
      ),
    ),
  )

  await saveProjectMetadataToDrive(
    accessToken,
    projectFolderId,
    {
      ...project,
      schemaVersion:
        CURRENT_SCHEMA_VERSION,
    },
  )

  return {
    projectFolderId,
    tasksFolderId,
  }
}

export async function loadFirstProjectFromDrive(
  accessToken: string,
  projectsFolderId: string,
): Promise<LoadedDriveProject | null> {
  const foldersUrl =
    new URL(GOOGLE_DRIVE_FILES_URL)

  foldersUrl.searchParams.set(
    'q',
    [
      `'${projectsFolderId}' in parents`,
      `mimeType = '${GOOGLE_DRIVE_FOLDER_MIME_TYPE}'`,
      'trashed = false',
    ].join(' and '),
  )

  foldersUrl.searchParams.set(
    'fields',
    'files(id)',
  )

  foldersUrl.searchParams.set(
    'pageSize',
    '100',
  )

  const foldersResponse =
    await fetch(foldersUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

  if (!foldersResponse.ok) {
    throw new Error(
      `Google Drive project search failed with status ${foldersResponse.status}.`,
    )
  }

  const foldersData =
    await foldersResponse.json() as {
      files: Array<{
        id: string
      }>
    }

  for (const folder of foldersData.files) {
    const storedProject =
      await readJsonFile<StoredProjectMetadata>(
        accessToken,
        folder.id,
        PROJECT_FILE_NAME,
      )

    if (!storedProject) {
      continue
    }

    const columns =
      await readJsonFile<BoardColumn[]>(
        accessToken,
        folder.id,
        COLUMNS_FILE_NAME,
      )

    if (!columns) {
      throw new Error(
        'Google Drive columns file could not be found.',
      )
    }

    let tasksFolderId =
      await findFolder(
        accessToken,
        TASKS_FOLDER_NAME,
        folder.id,
      )

    if (!tasksFolderId) {
      tasksFolderId =
        await createFolder(
          accessToken,
          TASKS_FOLDER_NAME,
          folder.id,
        )
    }

    const tasks =
      await loadTasksFromDrive(
        accessToken,
        tasksFolderId,
      )

    const project: Project = {
      ...storedProject,
      columns,
      tasks,
    }

    return {
      project,
      projectFolderId: folder.id,
      tasksFolderId,
    }
  }

  return null
}

async function findFile(
  accessToken: string,
  fileName: string,
  parentFolderId: string,
): Promise<string | null> {
  const url =
    new URL(GOOGLE_DRIVE_FILES_URL)

  const escapedFileName =
    escapeDriveQueryValue(fileName)

  url.searchParams.set(
    'q',
    [
      `name = '${escapedFileName}'`,
      `'${parentFolderId}' in parents`,
      'trashed = false',
    ].join(' and '),
  )

  url.searchParams.set(
    'fields',
    'files(id)',
  )

  url.searchParams.set(
    'pageSize',
    '1',
  )

  const response =
    await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

  if (!response.ok) {
    throw new Error(
      `Google Drive file search failed with status ${response.status}.`,
    )
  }

  const data =
    await response.json() as {
      files: Array<{
        id: string
      }>
    }

  return data.files[0]?.id ?? null
}

async function writeJsonFile(
  accessToken: string,
  parentFolderId: string,
  fileName: string,
  value: unknown,
): Promise<void> {
  let fileId =
    await findFile(
      accessToken,
      fileName,
      parentFolderId,
    )

  if (!fileId) {
    const createResponse =
      await fetch(
        GOOGLE_DRIVE_FILES_URL,
        {
          method: 'POST',

          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },

          body: JSON.stringify({
            name: fileName,
            mimeType: 'application/json',
            parents: [parentFolderId],
          }),
        },
      )

    if (!createResponse.ok) {
      throw new Error(
        `Google Drive file creation failed with status ${createResponse.status}.`,
      )
    }

    const createdFile =
      await createResponse.json() as {
        id: string
      }

    fileId = createdFile.id
  }

  const uploadResponse =
    await fetch(
      `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`,
      {
        method: 'PATCH',

        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },

        body: JSON.stringify(
          value,
          null,
          2,
        ),
      },
    )

  if (!uploadResponse.ok) {
    throw new Error(
      `Google Drive file save failed with status ${uploadResponse.status}.`,
    )
  }
}

async function readJsonFile<T>(
  accessToken: string,
  parentFolderId: string,
  fileName: string,
): Promise<T | null> {
  const fileId =
    await findFile(
      accessToken,
      fileName,
      parentFolderId,
    )

  if (!fileId) {
    return null
  }

  const response =
    await fetch(
      `${GOOGLE_DRIVE_FILES_URL}/${fileId}?alt=media`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    )

  if (!response.ok) {
    throw new Error(
      `Google Drive file download failed with status ${response.status}.`,
    )
  }

  return await response.json() as T
}

function createStoredProjectMetadata(
  project: Project,
): StoredProjectMetadata {
  return {
    schemaVersion:
      CURRENT_SCHEMA_VERSION,

    id: project.id,
    name: project.name,
    members: project.members,
  }
}

export async function saveProjectMetadataToDrive(
  accessToken: string,
  projectFolderId: string,
  project: Project,
): Promise<void> {
  await writeJsonFile(
    accessToken,
    projectFolderId,
    PROJECT_FILE_NAME,
    createStoredProjectMetadata(project),
  )
}

export async function saveColumnsToDrive(
  accessToken: string,
  projectFolderId: string,
  columns: BoardColumn[],
): Promise<void> {
  await writeJsonFile(
    accessToken,
    projectFolderId,
    COLUMNS_FILE_NAME,
    columns,
  )
}

export async function saveTaskToDrive(
  accessToken: string,
  tasksFolderId: string,
  task: Task,
): Promise<void> {
  await writeJsonFile(
    accessToken,
    tasksFolderId,
    `${task.id}.json`,
    task,
  )
}

export async function deleteTaskFromDrive(
  accessToken: string,
  tasksFolderId: string,
  taskId: string,
): Promise<void> {
  const fileId =
    await findFile(
      accessToken,
      `${taskId}.json`,
      tasksFolderId,
    )

  if (!fileId) {
    return
  }

  const response =
    await fetch(
      `${GOOGLE_DRIVE_FILES_URL}/${fileId}`,
      {
        method: 'DELETE',

        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    )

  if (!response.ok) {
    throw new Error(
      `Google Drive task deletion failed with status ${response.status}.`,
    )
  }
}

async function loadTasksFromDrive(
  accessToken: string,
  tasksFolderId: string,
): Promise<Task[]> {
  const url =
    new URL(GOOGLE_DRIVE_FILES_URL)

  url.searchParams.set(
    'q',
    [
      `'${tasksFolderId}' in parents`,
      'trashed = false',
    ].join(' and '),
  )

  url.searchParams.set(
    'fields',
    'files(id,name)',
  )

  url.searchParams.set(
    'pageSize',
    '1000',
  )

  const response =
    await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

  if (!response.ok) {
    throw new Error(
      `Google Drive task list failed with status ${response.status}.`,
    )
  }

  const data =
    await response.json() as {
      files: Array<{
        id: string
        name: string
      }>
    }

  const taskFiles =
    data.files.filter(
      (file) =>
        file.name.endsWith('.json'),
    )

  return Promise.all(
    taskFiles.map(async (file) => {
      const taskResponse =
        await fetch(
          `${GOOGLE_DRIVE_FILES_URL}/${file.id}?alt=media`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          },
        )

      if (!taskResponse.ok) {
        throw new Error(
          `Google Drive task download failed with status ${taskResponse.status}.`,
        )
      }

      return await taskResponse.json() as Task
    }),
  )
}