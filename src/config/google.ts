export const GOOGLE_CLIENT_ID =
  import.meta.env.VITE_GOOGLE_CLIENT_ID

export const GOOGLE_DRIVE_SCOPE =
  'https://www.googleapis.com/auth/drive.file'

const GOOGLE_TOKEN_STORAGE_KEY =
  'datsGoogleAccessToken'

const GOOGLE_TOKEN_EXPIRATION_KEY =
  'datsGoogleAccessTokenExpiresAt'

export function getStoredGoogleAccessToken():
  string | null {
  const accessToken =
    sessionStorage.getItem(
      GOOGLE_TOKEN_STORAGE_KEY,
    )

  const expiresAtText =
    sessionStorage.getItem(
      GOOGLE_TOKEN_EXPIRATION_KEY,
    )

  if (!accessToken || !expiresAtText) {
    return null
  }

  const expiresAt =
    Number(expiresAtText)

  if (
    !Number.isFinite(expiresAt) ||
    Date.now() >= expiresAt
  ) {
    sessionStorage.removeItem(
      GOOGLE_TOKEN_STORAGE_KEY,
    )

    sessionStorage.removeItem(
      GOOGLE_TOKEN_EXPIRATION_KEY,
    )

    return null
  }

  return accessToken
}