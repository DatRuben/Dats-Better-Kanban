const GOOGLE_DRIVE_FILES_URL =
  'https://www.googleapis.com/drive/v3/files'

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