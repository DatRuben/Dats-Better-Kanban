export {}

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string
            scope: string
            callback: (response: GoogleTokenResponse) => void
            error_callback?: (error: unknown) => void
          }) => {
            requestAccessToken: () => void
          }
        }
      }
    }
  }

  interface GoogleTokenResponse {
    access_token: string
    expires_in: number
    error?: string
  }
}