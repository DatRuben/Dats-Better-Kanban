const GOOGLE_DRIVE_FILES_URL =
  'https://www.googleapis.com/drive/v3/files'

const GOOGLE_DRIVE_FOLDER_MIME_TYPE =
  'application/vnd.google-apps.folder'

const DATS_FOLDER_NAME =
  "Dat's: Better Kanban"

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
): Promise<string | null> {
  const url = new URL(GOOGLE_DRIVE_FILES_URL)

  const escapedFolderName =
    escapeDriveQueryValue(folderName)

  url.searchParams.set(
    'q',
    [
      `name = '${escapedFolderName}'`,
      `mimeType = '${GOOGLE_DRIVE_FOLDER_MIME_TYPE}'`,
      'trashed = false',
    ].join(' and '),
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
): Promise<string> {
  const response = await fetch(
    GOOGLE_DRIVE_FILES_URL,
    {
      method: 'POST',

      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },

      body: JSON.stringify({
        name: folderName,
        mimeType: GOOGLE_DRIVE_FOLDER_MIME_TYPE,
      }),
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