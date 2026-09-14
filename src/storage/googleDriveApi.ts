import type { Project } from '../types/board'

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

export async function createProjectOnDrive(
  accessToken: string,
  projectsFolderId: string,
  project: Project,
): Promise<void> {
  const projectFolderId =
    await createFolder(
      accessToken,
      project.id,
      projectsFolderId,
    )

  const fileResponse = await fetch(
    GOOGLE_DRIVE_FILES_URL,
    {
      method: 'POST',

      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },

      body: JSON.stringify({
        name: PROJECT_FILE_NAME,
        mimeType: 'application/json',
        parents: [projectFolderId],
      }),
    },
  )

  if (!fileResponse.ok) {
    throw new Error(
      `Google Drive project file creation failed with status ${fileResponse.status}.`,
    )
  }

  const file = await fileResponse.json() as {
    id: string
  }

  const uploadUrl =
    `https://www.googleapis.com/upload/drive/v3/files/${file.id}?uploadType=media`

  const uploadResponse = await fetch(
    uploadUrl,
    {
      method: 'PATCH',

      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },

      body: JSON.stringify(project, null, 2),
    },
  )

  if (!uploadResponse.ok) {
    throw new Error(
      `Google Drive project upload failed with status ${uploadResponse.status}.`,
    )
  }
}

export async function loadFirstProjectFromDrive(
  accessToken: string,
  projectsFolderId: string,
): Promise<Project | null> {
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
    '1',
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

  const projectFolderId =
    foldersData.files[0]?.id

  if (!projectFolderId) {
    return null
  }

  const filesUrl =
    new URL(GOOGLE_DRIVE_FILES_URL)

  filesUrl.searchParams.set(
    'q',
    [
      `name = '${PROJECT_FILE_NAME}'`,
      `'${projectFolderId}' in parents`,
      'trashed = false',
    ].join(' and '),
  )

  filesUrl.searchParams.set(
    'fields',
    'files(id)',
  )

  filesUrl.searchParams.set(
    'pageSize',
    '1',
  )

  const filesResponse =
    await fetch(filesUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

  if (!filesResponse.ok) {
    throw new Error(
      `Google Drive project file search failed with status ${filesResponse.status}.`,
    )
  }

  const filesData =
    await filesResponse.json() as {
      files: Array<{
        id: string
      }>
    }

  const projectFileId =
    filesData.files[0]?.id

  if (!projectFileId) {
    return null
  }

  const downloadResponse =
    await fetch(
      `${GOOGLE_DRIVE_FILES_URL}/${projectFileId}?alt=media`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    )

  if (!downloadResponse.ok) {
    throw new Error(
      `Google Drive project download failed with status ${downloadResponse.status}.`,
    )
  }

  return await downloadResponse.json() as Project
}