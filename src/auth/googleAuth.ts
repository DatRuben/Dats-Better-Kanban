import {
  GOOGLE_CLIENT_ID,
  GOOGLE_DRIVE_SCOPE,
} from '../config/google'

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

          resolve(response.access_token)
        },

        error_callback: (error) => {
          reject(error)
        },
      })

    tokenClient.requestAccessToken()
  })
}