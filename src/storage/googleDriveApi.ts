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

const ATTACHMENTS_FOLDER_NAME =
  'attachments'

const COLUMNS_FILE_NAME =
  'columns.json'

const TASK_ID_PROPERTY =
  'datsTaskId'

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
  attachmentsFolderId: string
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

async function getProjectFolderName(
  accessToken: string,
  projectsFolderId: string,
  projectName: string,
  projectId: string,
  currentProjectFolderId?: string,
): Promise<string> {
  const cleanProjectName =
    projectName.trim() || 'Untitled Project'

  const existingFolderId =
    await findFolder(
      accessToken,
      cleanProjectName,
      projectsFolderId,
    )

  if (
    !existingFolderId ||
    existingFolderId === currentProjectFolderId
  ) {
    return cleanProjectName
  }

  return `${cleanProjectName} - ${projectId}`
}

async function renameFolder(
  accessToken: string,
  folderId: string,
  folderName: string,
): Promise<void> {
  const response =
    await fetch(
      `${GOOGLE_DRIVE_FILES_URL}/${folderId}`,
      {
        method: 'PATCH',

        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },

        body: JSON.stringify({
          name: folderName,
        }),
      },
    )

  if (!response.ok) {
    throw new Error(
      `Google Drive folder rename failed with status ${response.status}.`,
    )
  }
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

export async function createProjectOnDrive(
  accessToken: string,
  projectsFolderId: string,
  project: Project,
): Promise<{
  projectFolderId: string
  tasksFolderId: string
  attachmentsFolderId: string
}> {
  const projectFolderName =
    await getProjectFolderName(
      accessToken,
      projectsFolderId,
      project.name,
      project.id,
    )

  const projectFolderId =
    await createFolder(
      accessToken,
      projectFolderName,
      projectsFolderId,
    )

  const tasksFolderId =
    await createFolder(
      accessToken,
      TASKS_FOLDER_NAME,
      projectFolderId,
    )

  const attachmentsFolderId =
    await createFolder(
      accessToken,
      ATTACHMENTS_FOLDER_NAME,
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
    projectsFolderId,
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
    attachmentsFolderId,
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

    let attachmentsFolderId =
      await findFolder(
        accessToken,
        ATTACHMENTS_FOLDER_NAME,
        folder.id,
      )

    if (!attachmentsFolderId) {
      attachmentsFolderId =
        await createFolder(
          accessToken,
          ATTACHMENTS_FOLDER_NAME,
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
      attachmentsFolderId,
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
  projectsFolderId: string,
  projectFolderId: string,
  project: Project,
): Promise<void> {
  const projectFolderName =
    await getProjectFolderName(
      accessToken,
      projectsFolderId,
      project.name,
      project.id,
      projectFolderId,
    )

  await renameFolder(
    accessToken,
    projectFolderId,
    projectFolderName,
  )

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
  let taskFileId =
    await findTaskFileById(
      accessToken,
      tasksFolderId,
      task.id,
    )

  const taskFileName =
    await getTaskFileName(
      accessToken,
      tasksFolderId,
      task,
      taskFileId ?? undefined,
    )

  if (!taskFileId) {
    const createResponse =
      await fetch(
        GOOGLE_DRIVE_FILES_URL,
        {
          method: 'POST',

          headers: {
            Authorization:
              `Bearer ${accessToken}`,
            'Content-Type':
              'application/json',
          },

          body: JSON.stringify({
            name: taskFileName,
            mimeType: 'application/json',
            parents: [tasksFolderId],

            appProperties: {
              [TASK_ID_PROPERTY]:
                task.id,
            },
          }),
        },
      )

    if (!createResponse.ok) {
      throw new Error(
        `Google Drive task file creation failed with status ${createResponse.status}.`,
      )
    }

    const createdFile =
      await createResponse.json() as {
        id: string
      }

    taskFileId =
      createdFile.id
  } else {
    const renameResponse =
      await fetch(
        `${GOOGLE_DRIVE_FILES_URL}/${taskFileId}`,
        {
          method: 'PATCH',

          headers: {
            Authorization:
              `Bearer ${accessToken}`,
            'Content-Type':
              'application/json',
          },

          body: JSON.stringify({
            name: taskFileName,

            appProperties: {
              [TASK_ID_PROPERTY]:
                task.id,
            },
          }),
        },
      )

    if (!renameResponse.ok) {
      throw new Error(
        `Google Drive task rename failed with status ${renameResponse.status}.`,
      )
    }
  }

  const uploadResponse =
    await fetch(
      `https://www.googleapis.com/upload/drive/v3/files/${taskFileId}?uploadType=media`,
      {
        method: 'PATCH',

        headers: {
          Authorization:
            `Bearer ${accessToken}`,
          'Content-Type':
            'application/json',
        },

        body: JSON.stringify(
          task,
          null,
          2,
        ),
      },
    )

  if (!uploadResponse.ok) {
    throw new Error(
      `Google Drive task save failed with status ${uploadResponse.status}.`,
    )
  }
}

export async function deleteTaskFromDrive(
  accessToken: string,
  tasksFolderId: string,
  taskId: string,
): Promise<void> {
  const fileId =
    await findTaskFileById(
      accessToken,
      tasksFolderId,
      taskId,
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
          Authorization:
            `Bearer ${accessToken}`,
        },
      },
    )

  if (!response.ok) {
    throw new Error(
      `Google Drive task deletion failed with status ${response.status}.`,
    )
  }
}

export async function loadTasksFromDrive(
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

async function findTaskFileById(
  accessToken: string,
  tasksFolderId: string,
  taskId: string,
): Promise<string | null> {
  const url =
    new URL(GOOGLE_DRIVE_FILES_URL)

  const escapedTaskId =
    escapeDriveQueryValue(taskId)

  url.searchParams.set(
    'q',
    [
      `'${tasksFolderId}' in parents`,
      `appProperties has { key='${TASK_ID_PROPERTY}' and value='${escapedTaskId}' }`,
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
        Authorization:
          `Bearer ${accessToken}`,
      },
    })

  if (!response.ok) {
    throw new Error(
      `Google Drive task search failed with status ${response.status}.`,
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

export async function loadTaskFromDrive(
  accessToken: string,
  tasksFolderId: string,
  taskId: string,
): Promise<Task | null> {
  const fileId =
    await findTaskFileById(
      accessToken,
      tasksFolderId,
      taskId,
    )

  if (!fileId) {
    return null
  }

  const response =
    await fetch(
      `${GOOGLE_DRIVE_FILES_URL}/${fileId}?alt=media`,
      {
        headers: {
          Authorization:
            `Bearer ${accessToken}`,
        },
      },
    )

  if (!response.ok) {
    throw new Error(
      `Google Drive task download failed with status ${response.status}.`,
    )
  }

  return await response.json() as Task
}

async function getTaskFileName(
  accessToken: string,
  tasksFolderId: string,
  task: Task,
  currentTaskFileId?: string,
): Promise<string> {
  const cleanTitle =
    task.title.trim() || 'Untitled Task'

  const preferredName =
    `${cleanTitle}.json`

  const existingFileId =
    await findFile(
      accessToken,
      preferredName,
      tasksFolderId,
    )

  if (
    !existingFileId ||
    existingFileId === currentTaskFileId
  ) {
    return preferredName
  }

  return `${cleanTitle} - ${task.id}.json`
}

export async function uploadAttachmentToDrive(
  accessToken: string,
  attachmentsFolderId: string,
  file: File,
): Promise<string> {
  const mimeType =
    file.type || 'application/octet-stream'

  const createResponse =
    await fetch(
      GOOGLE_DRIVE_FILES_URL,
      {
        method: 'POST',

        headers: {
          Authorization:
            `Bearer ${accessToken}`,
          'Content-Type':
            'application/json',
        },

        body: JSON.stringify({
          name: file.name,
          mimeType,
          parents: [attachmentsFolderId],
        }),
      },
    )

  if (!createResponse.ok) {
    throw new Error(
      `Google Drive attachment creation failed with status ${createResponse.status}.`,
    )
  }

  const createdFile =
    await createResponse.json() as {
      id: string
    }

  const uploadResponse =
    await fetch(
      `https://www.googleapis.com/upload/drive/v3/files/${createdFile.id}?uploadType=media`,
      {
        method: 'PATCH',

        headers: {
          Authorization:
            `Bearer ${accessToken}`,
          'Content-Type':
            mimeType,
        },

        body: file,
      },
    )

  if (!uploadResponse.ok) {
    throw new Error(
      `Google Drive attachment upload failed with status ${uploadResponse.status}.`,
    )
  }

  return createdFile.id
}

export async function downloadAttachmentFromDrive(
  accessToken: string,
  fileId: string,
): Promise<Blob> {
  const response =
    await fetch(
      `${GOOGLE_DRIVE_FILES_URL}/${fileId}?alt=media`,
      {
        headers: {
          Authorization:
            `Bearer ${accessToken}`,
        },
      },
    )

  if (!response.ok) {
    throw new Error(
      `Google Drive attachment download failed with status ${response.status}.`,
    )
  }

  return await response.blob()
}

export async function deleteAttachmentFromDrive(
  accessToken: string,
  fileId: string,
): Promise<void> {
  const response =
    await fetch(
      `${GOOGLE_DRIVE_FILES_URL}/${fileId}`,
      {
        method: 'DELETE',

        headers: {
          Authorization:
            `Bearer ${accessToken}`,
        },
      },
    )

  if (
    !response.ok &&
    response.status !== 404
  ) {
    throw new Error(
      `Google Drive attachment deletion failed with status ${response.status}.`,
    )
  }
}