import type {
  BoardColumn,
  DemoUser,
  Project,
  ProjectAccessRole,
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

export const DATS_PROJECT_DOCUMENT_FILE_NAME =
  'dats-project.json'

const PROJECT_INDEX_FILE_NAME =
  'project-index.json'

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

export interface StoredProjectMetadata {
  schemaVersion: number
  id: string
  name: string
  members: DemoUser[]
}

export interface LoadedDriveProject {
  project: Project
  projectFolderId: string
  projectFileId: string
  tasksFolderId: string | null
  attachmentsFolderId: string | null
}

export interface GoogleDriveUser {
  displayName: string
  emailAddress: string
  permissionId: string
}

export interface DriveProjectReference {
  projectFolderId: string
  projectFileId?: string
}

export interface DriveProjectSummary {
  projectFolderId: string
  projectFileId?: string
  metadata: StoredProjectMetadata
  isOwned: boolean
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

export async function getGoogleDriveUser(
  accessToken: string,
): Promise<GoogleDriveUser> {
  const url =
    new URL(
      'https://www.googleapis.com/drive/v3/about',
    )

  url.searchParams.set(
    'fields',
    'user(displayName,emailAddress,permissionId)',
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
      `Google Drive user request failed with status ${response.status}.`,
    )
  }

  const data =
    await response.json() as {
      user: GoogleDriveUser
    }

  return data.user
}

function escapeDriveQueryValue(value: string) {
  return value
    .replaceAll('\\', '\\\\')
    .replaceAll("'", "\\'")
}

function isUnavailableProjectReferenceError(
  error: unknown,
) {
  return (
    error instanceof Error &&
    (
      error.message.includes('status 403') ||
      error.message.includes('status 404')
    )
  )
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

export async function updateProjectFolderPermission(
  accessToken: string,
  projectFolderId: string,
  permissionId: string,
  accessRole: Exclude<
    ProjectAccessRole,
    'owner'
  >,
): Promise<void> {
  const driveRole =
    accessRole === 'editor'
      ? 'writer'
      : 'reader'

  const response =
    await fetch(
      `${GOOGLE_DRIVE_FILES_URL}/${projectFolderId}/permissions/${permissionId}`,
      {
        method: 'PATCH',

        headers: {
          Authorization:
            `Bearer ${accessToken}`,
          'Content-Type':
            'application/json',
        },

        body: JSON.stringify({
          role: driveRole,
        }),
      },
    )

  if (!response.ok) {
    throw new Error(
      `Google Drive permission update failed with status ${response.status}.`,
    )
  }
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
  projectFileId: string
  tasksFolderId: string
  attachmentsFolderId: string
}> {
  const normalizedProject: Project = {
    ...project,
    schemaVersion:
      CURRENT_SCHEMA_VERSION,
  }

  const projectFolderName =
    await getProjectFolderName(
      accessToken,
      projectsFolderId,
      normalizedProject.name,
      normalizedProject.id,
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
    normalizedProject.columns,
  )

  await Promise.all(
    normalizedProject.tasks.map((task) =>
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
    normalizedProject,
  )

  const projectFileId =
    await ensureProjectDocumentOnDrive(
      accessToken,
      projectFolderId,
      normalizedProject,
    )

  return {
    projectFolderId,
    projectFileId,
    tasksFolderId,
    attachmentsFolderId,
  }
}

export async function loadProjectFromDriveFolder(
  accessToken: string,
  projectFolderId: string,
  createMissingFolders = false,
): Promise<LoadedDriveProject | null> {
  const existingProjectFileId =
    await findFile(
      accessToken,
      DATS_PROJECT_DOCUMENT_FILE_NAME,
      projectFolderId,
    )

  if (existingProjectFileId) {
    const projectDocument =
      await loadProjectDocumentFromDrive(
        accessToken,
        existingProjectFileId,
      )

    let tasksFolderId =
      await findFolder(
        accessToken,
        TASKS_FOLDER_NAME,
        projectFolderId,
      )

    let attachmentsFolderId =
      await findFolder(
        accessToken,
        ATTACHMENTS_FOLDER_NAME,
        projectFolderId,
      )

    if (
      createMissingFolders &&
      !tasksFolderId
    ) {
      tasksFolderId =
        await createFolder(
          accessToken,
          TASKS_FOLDER_NAME,
          projectFolderId,
        )
    }

    if (
      createMissingFolders &&
      !attachmentsFolderId
    ) {
      attachmentsFolderId =
        await createFolder(
          accessToken,
          ATTACHMENTS_FOLDER_NAME,
          projectFolderId,
        )
    }

    return {
      project:
        projectDocument.project,

      projectFolderId,

      projectFileId:
        existingProjectFileId,

      tasksFolderId,

      attachmentsFolderId,
    }
  }

  /*
   * Legacy project migration.
   *
   * Projects created before dats-project.json
   * still load from project.json / columns.json /
   * tasks, then receive a canonical project
   * document.
   */

  const storedProject =
    await loadProjectMetadataFromDrive(
      accessToken,
      projectFolderId,
    )

  if (!storedProject) {
    return null
  }

  const columns =
    await readJsonFile<BoardColumn[]>(
      accessToken,
      projectFolderId,
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
      projectFolderId,
    )

  if (!tasksFolderId) {
    if (!createMissingFolders) {
      throw new Error(
        'Google Drive tasks folder could not be found.',
      )
    }

    tasksFolderId =
      await createFolder(
        accessToken,
        TASKS_FOLDER_NAME,
        projectFolderId,
      )
  }

  let attachmentsFolderId =
    await findFolder(
      accessToken,
      ATTACHMENTS_FOLDER_NAME,
      projectFolderId,
    )

  if (!attachmentsFolderId) {
    if (!createMissingFolders) {
      throw new Error(
        'Google Drive attachments folder could not be found.',
      )
    }

    attachmentsFolderId =
      await createFolder(
        accessToken,
        ATTACHMENTS_FOLDER_NAME,
        projectFolderId,
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

  const projectFileId =
    await ensureProjectDocumentOnDrive(
      accessToken,
      projectFolderId,
      project,
    )

  return {
    project,
    projectFolderId,
    projectFileId,
    tasksFolderId,
    attachmentsFolderId,
  }
}

async function listOwnedProjectFolderIds(
  accessToken: string,
  projectsFolderId: string,
): Promise<string[]> {
  const projectFolderIds: string[] = []

  let pageToken: string | null = null

  do {
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
      'nextPageToken,files(id)',
    )

    foldersUrl.searchParams.set(
      'pageSize',
      '100',
    )

    if (pageToken) {
      foldersUrl.searchParams.set(
        'pageToken',
        pageToken,
      )
    }

    const foldersResponse =
      await fetch(foldersUrl, {
        headers: {
          Authorization:
            `Bearer ${accessToken}`,
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
        nextPageToken?: string
      }

    projectFolderIds.push(
      ...foldersData.files.map(
        (folder) => folder.id,
      ),
    )

    pageToken =
      foldersData.nextPageToken ?? null
  } while (pageToken)

  return projectFolderIds
}

export async function loadFirstProjectFromDrive(
  accessToken: string,
  projectsFolderId: string,
): Promise<LoadedDriveProject | null> {
  const projectFolderIds =
    await listOwnedProjectFolderIds(
      accessToken,
      projectsFolderId,
    )

  for (
    const projectFolderId
    of projectFolderIds
  ) {
    const loadedProject =
      await loadProjectFromDriveFolder(
        accessToken,
        projectFolderId,
        true,
      )

    if (loadedProject) {
      return loadedProject
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
    const boundary =
      `dats_${crypto.randomUUID()}`

    const metadata = JSON.stringify({
      name: fileName,
      mimeType: 'application/json',
      parents: [parentFolderId],
    })

    const fileContents =
      JSON.stringify(
        value,
        null,
        2,
      )

    const multipartBody = [
      `--${boundary}`,
      'Content-Type: application/json; charset=UTF-8',
      '',
      metadata,
      `--${boundary}`,
      'Content-Type: application/json',
      '',
      fileContents,
      `--${boundary}--`,
      '',
    ].join('\r\n')

    const createResponse =
      await fetch(
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
        {
          method: 'POST',

          headers: {
            Authorization:
              `Bearer ${accessToken}`,

            'Content-Type':
              `multipart/related; boundary=${boundary}`,
          },

          body: multipartBody,
        },
      )

    if (!createResponse.ok) {
      throw new Error(
        `Google Drive file creation failed with status ${createResponse.status}.`,
      )
    }

    return
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

  const fileContents = await response.text()

  if (!fileContents.trim()) {
    throw new Error(
      `Google Drive file "${fileName}" is empty.`,
    )
  }

  try {
    return JSON.parse(fileContents) as T
  } catch {
    throw new Error(
      `Google Drive file "${fileName}" contains invalid JSON.`,
    )
  }
}

export interface DriveProjectDocument {
  projectFileId: string
  projectFolderId: string | null
  project: Project
}

async function downloadJsonFileById<T>(
  accessToken: string,
  fileId: string,
): Promise<T> {
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
      `Google Drive file download failed with status ${response.status}.`,
    )
  }

  const fileContents =
    await response.text()

  if (!fileContents.trim()) {
    throw new Error(
      'Google Drive file is empty.',
    )
  }

  try {
    return JSON.parse(
      fileContents,
    ) as T
  } catch {
    throw new Error(
      'Google Drive file contains invalid JSON.',
    )
  }
}

async function getDriveFileParentId(
  accessToken: string,
  fileId: string,
): Promise<string | null> {
  const url =
    new URL(
      `${GOOGLE_DRIVE_FILES_URL}/${fileId}`,
    )

  url.searchParams.set(
    'fields',
    'parents',
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
      `Google Drive file metadata request failed with status ${response.status}.`,
    )
  }

  const data =
    await response.json() as {
      parents?: string[]
    }

  return data.parents?.[0] ?? null
}

export async function loadProjectDocumentFromDrive(
  accessToken: string,
  projectFileId: string,
): Promise<DriveProjectDocument> {
  const project =
    await downloadJsonFileById<Project>(
      accessToken,
      projectFileId,
    )

  if (
    !project ||
    typeof project.id !== 'string' ||
    typeof project.name !== 'string' ||
    !Array.isArray(project.columns) ||
    !Array.isArray(project.tasks) ||
    !Array.isArray(project.members)
  ) {
    throw new Error(
      'The selected file is not a valid Dat’s project.',
    )
  }

  const projectFolderId =
    await getDriveFileParentId(
      accessToken,
      projectFileId,
    )

  return {
    projectFileId,
    projectFolderId,
    project,
  }
}

export async function loadProjectFromDriveDocument(
  accessToken: string,
  projectFileId: string,
): Promise<LoadedDriveProject> {
  const projectDocument =
    await loadProjectDocumentFromDrive(
      accessToken,
      projectFileId,
    )

  if (!projectDocument.projectFolderId) {
    throw new Error(
      'The Dat’s project document is not inside a project folder.',
    )
  }

  const projectFolderId =
    projectDocument.projectFolderId

  let tasksFolderId: string | null = null
  let attachmentsFolderId: string | null = null

  try {
    tasksFolderId =
      await findFolder(
        accessToken,
        TASKS_FOLDER_NAME,
        projectFolderId,
      )

    attachmentsFolderId =
      await findFolder(
        accessToken,
        ATTACHMENTS_FOLDER_NAME,
        projectFolderId,
      )
  } catch (error) {
    if (
      !isUnavailableProjectReferenceError(
        error,
      )
    ) {
      throw error
    }
  }

  return {
    project:
      projectDocument.project,

    projectFolderId,

    projectFileId,

    tasksFolderId,

    attachmentsFolderId,
  }
}

export async function saveProjectDocumentToDrive(
  accessToken: string,
  projectFileId: string,
  project: Project,
): Promise<void> {
  const response =
    await fetch(
      `https://www.googleapis.com/upload/drive/v3/files/${projectFileId}?uploadType=media`,
      {
        method: 'PATCH',

        headers: {
          Authorization:
            `Bearer ${accessToken}`,
          'Content-Type':
            'application/json',
        },

        body: JSON.stringify(
          project,
          null,
          2,
        ),
      },
    )

  if (!response.ok) {
    throw new Error(
      `Google Drive project document save failed with status ${response.status}.`,
    )
  }
}

export async function ensureProjectDocumentOnDrive(
  accessToken: string,
  projectFolderId: string,
  project: Project,
): Promise<string> {
  await writeJsonFile(
    accessToken,
    projectFolderId,
    DATS_PROJECT_DOCUMENT_FILE_NAME,
    project,
  )

  const projectFileId =
    await findFile(
      accessToken,
      DATS_PROJECT_DOCUMENT_FILE_NAME,
      projectFolderId,
    )

  if (!projectFileId) {
    throw new Error(
      'Google Drive project document could not be found after saving.',
    )
  }

  return projectFileId
}

export async function loadProjectMetadataFromDrive(
  accessToken: string,
  projectFolderId: string,
): Promise<StoredProjectMetadata | null> {
  return readJsonFile<StoredProjectMetadata>(
    accessToken,
    projectFolderId,
    PROJECT_FILE_NAME,
  )
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
    const boundary =
      `dats_${crypto.randomUUID()}`

    const metadata = JSON.stringify({
      name: taskFileName,
      mimeType: 'application/json',
      parents: [tasksFolderId],

      appProperties: {
        [TASK_ID_PROPERTY]:
          task.id,
      },
    })

    const fileContents =
      JSON.stringify(
        task,
        null,
        2,
      )

    const multipartBody = [
      `--${boundary}`,
      'Content-Type: application/json; charset=UTF-8',
      '',
      metadata,
      `--${boundary}`,
      'Content-Type: application/json',
      '',
      fileContents,
      `--${boundary}--`,
      '',
    ].join('\r\n')

    const createResponse =
      await fetch(
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
        {
          method: 'POST',

          headers: {
            Authorization:
              `Bearer ${accessToken}`,

            'Content-Type':
              `multipart/related; boundary=${boundary}`,
          },

          body: multipartBody,
        },
      )

    if (!createResponse.ok) {
      throw new Error(
        `Google Drive task file creation failed with status ${createResponse.status}.`,
      )
    }

    return
  }

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

  if (
    !response.ok &&
    response.status !== 404
  ) {
    throw new Error(
      `Google Drive task deletion failed with status ${response.status}.`,
    )
  }
}

export async function loadTasksFromDrive(
  accessToken: string,
  tasksFolderId: string,
  skipInvalidTasks = true,
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

  const loadedTasks = await Promise.all(
    taskFiles.map(async (file): Promise<Task | null> => {
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

      const taskContents = await taskResponse.text()

      if (!taskContents.trim()) {
        if (!skipInvalidTasks) {
          throw new Error(
            `Google Drive task file "${file.name}" is empty.`,
          )
        }

        console.error(
          `Skipping empty Google Drive task file: ${file.name}`,
        )

        return null
      }

      try {
        return JSON.parse(taskContents) as Task
      } catch {
        if (!skipInvalidTasks) {
          throw new Error(
            `Google Drive task file "${file.name}" contains invalid JSON.`,
          )
        }

        console.error(
          `Skipping invalid Google Drive task file: ${file.name}`,
        )

        return null
      }
    }),
  )
  return loadedTasks.filter(
    (task): task is Task =>
      task !== null,
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

  const taskContents = await response.text()

  if (!taskContents.trim()) {
    throw new Error(
      `Google Drive task "${taskId}" is empty.`,
    )
  }

  try {
    return JSON.parse(taskContents) as Task
  } catch {
    throw new Error(
      `Google Drive task "${taskId}" contains invalid JSON.`,
    )
  }
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
    file.type ||
    'application/octet-stream'

  const boundary =
    `dats_${crypto.randomUUID()}`

  const metadata =
    JSON.stringify({
      name: file.name,
      mimeType,
      parents: [
        attachmentsFolderId,
      ],
    })

  const multipartBody =
    new Blob(
      [
        `--${boundary}\r\n`,
        'Content-Type: application/json; charset=UTF-8\r\n',
        '\r\n',
        metadata,
        '\r\n',

        `--${boundary}\r\n`,
        `Content-Type: ${mimeType}\r\n`,
        '\r\n',
        file,
        '\r\n',

        `--${boundary}--\r\n`,
      ],
    )

  const uploadResponse =
    await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id',
      {
        method: 'POST',

        headers: {
          Authorization:
            `Bearer ${accessToken}`,

          'Content-Type':
            `multipart/related; boundary=${boundary}`,
        },

        body: multipartBody,
      },
    )

  if (!uploadResponse.ok) {
    throw new Error(
      `Google Drive attachment upload failed with status ${uploadResponse.status}.`,
    )
  }

  const uploadedFile =
    await uploadResponse.json() as {
      id: string
    }

  return uploadedFile.id
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
    const responseText =
      await response.text()

    throw new Error(
      `Google Drive attachment download failed with status ${response.status}: ${responseText}`,
    )
  }

  return await response.blob()
}

export async function shareProjectFolderWithUser(
  accessToken: string,
  projectFolderId: string,
  emailAddress: string,
  accessRole: Exclude<
    ProjectAccessRole,
    'owner'
  >,
): Promise<string> {
  const driveRole =
    accessRole === 'editor'
      ? 'writer'
      : 'reader'

  const url =
    new URL(
      `${GOOGLE_DRIVE_FILES_URL}/${projectFolderId}/permissions`,
    )

  url.searchParams.set(
    'fields',
    'id',
  )

  const response =
    await fetch(url, {
      method: 'POST',

      headers: {
        Authorization:
          `Bearer ${accessToken}`,
        'Content-Type':
          'application/json',
      },

      body: JSON.stringify({
        type: 'user',
        role: driveRole,
        emailAddress,
      }),
    })

  if (!response.ok) {
    throw new Error(
      `Google Drive project sharing failed with status ${response.status}.`,
    )
  }

  const permission =
    await response.json() as {
      id: string
    }

  return permission.id
}

export async function removeProjectFolderPermission(
  accessToken: string,
  projectFolderId: string,
  permissionId: string,
): Promise<void> {
  const response =
    await fetch(
      `${GOOGLE_DRIVE_FILES_URL}/${projectFolderId}/permissions/${permissionId}`,
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
      `Google Drive permission removal failed with status ${response.status}.`,
    )
  }
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

async function loadProjectIndexFromDrive(
  accessToken: string,
  projectsFolderId: string,
): Promise<DriveProjectReference[]> {
  const projectIndex =
    await readJsonFile<DriveProjectReference[]>(
      accessToken,
      projectsFolderId,
      PROJECT_INDEX_FILE_NAME,
    )

  return projectIndex ?? []
}

export async function loadAvailableProjectSummariesFromDrive(
  accessToken: string,
  projectsFolderId: string,
): Promise<DriveProjectSummary[]> {
  const projectIndex =
    await loadProjectIndexFromDrive(
      accessToken,
      projectsFolderId,
    )

  const ownedProjectFolderIds =
    await listOwnedProjectFolderIds(
      accessToken,
      projectsFolderId,
    )

  const ownedProjectFolderIdSet =
    new Set(
      ownedProjectFolderIds,
    )

  const referenceByFolderId =
    new Map(
      projectIndex.map(
        (reference) => [
          reference.projectFolderId,
          reference,
        ],
      ),
    )

  const rememberedProjectFolderIds =
    new Set(
      projectIndex.map(
        (reference) =>
          reference.projectFolderId,
      ),
    )

  const projectFolderIds = [
    ...new Set([
      ...projectIndex.map(
        (reference) =>
          reference.projectFolderId,
      ),
      ...ownedProjectFolderIds,
    ]),
  ]

  let cleanedProjectIndex =
    [...projectIndex]

  let projectIndexChanged = false

  const summaries:
    DriveProjectSummary[] = []

  for (
    const projectFolderId
    of projectFolderIds
  ) {
    try {
      const reference =
        referenceByFolderId.get(
          projectFolderId,
        )

      let metadata:
        StoredProjectMetadata | null = null

      let usableProjectFileId =
        reference?.projectFileId

      if (usableProjectFileId) {
        try {
          const projectDocument =
            await loadProjectDocumentFromDrive(
              accessToken,
              usableProjectFileId,
            )

          metadata =
            createStoredProjectMetadata(
              projectDocument.project,
            )
        } catch (error) {
          if (
            !isUnavailableProjectReferenceError(
              error,
            )
          ) {
            throw error
          }

          metadata =
            await loadProjectMetadataFromDrive(
              accessToken,
              projectFolderId,
            )

          usableProjectFileId =
            undefined
        }
      } else {
        metadata =
          await loadProjectMetadataFromDrive(
            accessToken,
            projectFolderId,
          )
      }

      if (!metadata) {
        if (
          rememberedProjectFolderIds.has(
            projectFolderId,
          )
        ) {
          cleanedProjectIndex =
            cleanedProjectIndex.filter(
              (reference) =>
                reference.projectFolderId !==
                projectFolderId,
            )

          projectIndexChanged = true
        }

        continue
      }

      summaries.push({
        projectFolderId,

        projectFileId:
          usableProjectFileId,

        metadata,

        isOwned:
          ownedProjectFolderIdSet.has(
            projectFolderId,
          ),
      })
    } catch (error) {
      if (
        !isUnavailableProjectReferenceError(
          error,
        )
      ) {
        throw error
      }

      if (
        rememberedProjectFolderIds.has(
          projectFolderId,
        )
      ) {
        cleanedProjectIndex =
          cleanedProjectIndex.filter(
            (reference) =>
              reference.projectFolderId !==
              projectFolderId,
          )

        projectIndexChanged = true
      }
    }
  }

  if (projectIndexChanged) {
    await writeJsonFile(
      accessToken,
      projectsFolderId,
      PROJECT_INDEX_FILE_NAME,
      cleanedProjectIndex,
    )
  }

  return summaries
}

export async function isProjectAttachmentsFolder(
  accessToken: string,
  folderId: string,
  projectFolderId: string,
): Promise<boolean> {
  const url =
    new URL(
      `${GOOGLE_DRIVE_FILES_URL}/${folderId}`,
    )

  url.searchParams.set(
    'fields',
    'id,name,mimeType,parents',
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
      `Google Drive folder validation failed with status ${response.status}.`,
    )
  }

  const folder =
    await response.json() as {
      id: string
      name: string
      mimeType: string
      parents?: string[]
    }

  return (
    folder.mimeType ===
    GOOGLE_DRIVE_FOLDER_MIME_TYPE &&
    folder.name ===
    ATTACHMENTS_FOLDER_NAME &&
    folder.parents?.includes(
      projectFolderId,
    ) === true
  )
}

export async function rememberProjectFolder(
  accessToken: string,
  projectsFolderId: string,
  projectFolderId: string,
  projectFileId?: string,
): Promise<void> {
  const projectIndex =
    await loadProjectIndexFromDrive(
      accessToken,
      projectsFolderId,
    )

  const existingReference =
    projectIndex.find(
      (reference) =>
        reference.projectFolderId ===
        projectFolderId,
    )

  const rememberedProjectFileId =
    projectFileId ??
    existingReference?.projectFileId

  const nextReference: DriveProjectReference = {
    projectFolderId,
  }

  if (rememberedProjectFileId) {
    nextReference.projectFileId =
      rememberedProjectFileId
  }

  const nextProjectIndex = [
    nextReference,

    ...projectIndex.filter(
      (reference) =>
        reference.projectFolderId !==
        projectFolderId,
    ),
  ]

  await writeJsonFile(
    accessToken,
    projectsFolderId,
    PROJECT_INDEX_FILE_NAME,
    nextProjectIndex,
  )
}

export async function loadFirstRememberedProjectFromDrive(
  accessToken: string,
  projectsFolderId: string,
): Promise<LoadedDriveProject | null> {
  const projectIndex =
    await loadProjectIndexFromDrive(
      accessToken,
      projectsFolderId,
    )

  let cleanedProjectIndex =
    [...projectIndex]

  let projectIndexChanged = false

  for (const reference of projectIndex) {
    try {
      let loadedProject:
        LoadedDriveProject | null = null

      if (reference.projectFileId) {
        try {
          loadedProject =
            await loadProjectFromDriveDocument(
              accessToken,
              reference.projectFileId,
            )
        } catch (error) {
          if (
            !isUnavailableProjectReferenceError(
              error,
            )
          ) {
            throw error
          }

          /*
           * The remembered document may have been
           * removed or replaced.
           *
           * Owned legacy projects can still recover
           * from their remembered folder.
           */
          loadedProject =
            await loadProjectFromDriveFolder(
              accessToken,
              reference.projectFolderId,
              false,
            )
        }
      } else {
        loadedProject =
          await loadProjectFromDriveFolder(
            accessToken,
            reference.projectFolderId,
            false,
          )
      }

      if (!loadedProject) {
        cleanedProjectIndex =
          cleanedProjectIndex.filter(
            (savedReference) =>
              savedReference.projectFolderId !==
              reference.projectFolderId,
          )

        projectIndexChanged = true

        continue
      }

      if (
        reference.projectFileId !==
        loadedProject.projectFileId
      ) {
        cleanedProjectIndex =
          cleanedProjectIndex.map(
            (savedReference) =>
              savedReference.projectFolderId ===
                reference.projectFolderId
                ? {
                  ...savedReference,

                  projectFileId:
                    loadedProject.projectFileId,
                }
                : savedReference,
          )

        projectIndexChanged = true
      }

      if (projectIndexChanged) {
        await writeJsonFile(
          accessToken,
          projectsFolderId,
          PROJECT_INDEX_FILE_NAME,
          cleanedProjectIndex,
        )
      }

      return loadedProject
    } catch (error) {
      if (
        !isUnavailableProjectReferenceError(
          error,
        )
      ) {
        throw error
      }

      cleanedProjectIndex =
        cleanedProjectIndex.filter(
          (savedReference) =>
            savedReference.projectFolderId !==
            reference.projectFolderId,
        )

      projectIndexChanged = true
    }
  }

  if (projectIndexChanged) {
    await writeJsonFile(
      accessToken,
      projectsFolderId,
      PROJECT_INDEX_FILE_NAME,
      cleanedProjectIndex,
    )
  }

  return null
}

export async function getAttachmentDriveAccess(
  accessToken: string,
  fileId: string,
): Promise<{
  name: string
  isAppAuthorized: boolean
  canDownload: boolean
}> {
  const url =
    new URL(
      `${GOOGLE_DRIVE_FILES_URL}/${fileId}`,
    )

  url.searchParams.set(
    'fields',
    'name,isAppAuthorized,capabilities(canDownload)',
  )

  const response =
    await fetch(url, {
      headers: {
        Authorization:
          `Bearer ${accessToken}`,
      },
    })

  if (!response.ok) {
    const responseText =
      await response.text()

    throw new Error(
      `Google Drive attachment access check failed with status ${response.status}: ${responseText}`,
    )
  }

  const file =
    await response.json() as {
      name: string
      isAppAuthorized?: boolean
      capabilities?: {
        canDownload?: boolean
      }
    }

  return {
    name: file.name,

    isAppAuthorized:
      file.isAppAuthorized === true,

    canDownload:
      file.capabilities?.canDownload ===
      true,
  }
}