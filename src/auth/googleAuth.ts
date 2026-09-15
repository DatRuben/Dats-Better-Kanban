import {
  GOOGLE_CLIENT_ID,
  GOOGLE_DRIVE_SCOPE,
} from '../config/google'

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

export function requestGoogleAccessToken(): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!GOOGLE_CLIENT_ID) {
      reject(
        new Error('Google Client ID is not configured.'),
      )
      return
    }

    if (!window.google) {
      reject(
        new Error('Google Identity Services has not loaded.'),
      )
      return
    }

    const tokenClient =
      window.google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: GOOGLE_DRIVE_SCOPE,

        callback: (response) => {
          if (response.error) {
            reject(
              new Error(
                `Google authorization failed: ${response.error}`,
              ),
            )
            return
          }

          const expiresAt =
            Date.now() +
            response.expires_in * 1000

          sessionStorage.setItem(
            GOOGLE_TOKEN_STORAGE_KEY,
            response.access_token,
          )

          sessionStorage.setItem(
            GOOGLE_TOKEN_EXPIRATION_KEY,
            String(expiresAt),
          )

          resolve(response.access_token)
        },

        error_callback: (error) => {
          reject(error)
        },
      })

    tokenClient.requestAccessToken()
  })
}