export {}

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string
            scope: string
            callback: (
              response: GoogleTokenResponse,
            ) => void
            error_callback?: (
              error: unknown,
            ) => void
          }) => {
            requestAccessToken: () => void
          }
        }
      }

      picker?: {
        Action: {
          PICKED: string
          CANCEL: string
        }

        ViewId: {
          FOLDERS: string
        }

        DocsView: new (
          viewId: string,
        ) => GooglePickerDocsView

        PickerBuilder: new () =>
          GooglePickerBuilder
      }
    }

    gapi?: {
      load: (
        apiName: string,
        callback: () => void,
      ) => void
    }
  }

  interface GoogleTokenResponse {
    access_token: string
    expires_in: number
    error?: string
  }

  interface GooglePickerCallbackData {
    action: string
    docs?: Array<{
      id?: string
    }>
  }

  interface GooglePickerDocsView {
    setIncludeFolders: (
      included: boolean,
    ) => GooglePickerDocsView

    setSelectFolderEnabled: (
      enabled: boolean,
    ) => GooglePickerDocsView
  }

  interface GooglePickerBuilder {
    addView: (
      view: GooglePickerDocsView,
    ) => GooglePickerBuilder

    setOAuthToken: (
      accessToken: string,
    ) => GooglePickerBuilder

    setDeveloperKey: (
      apiKey: string,
    ) => GooglePickerBuilder

    setAppId: (
      appId: string,
    ) => GooglePickerBuilder

    setCallback: (
      callback: (
        data: GooglePickerCallbackData,
      ) => void,
    ) => GooglePickerBuilder

    build: () => GooglePicker
  }

  interface GooglePicker {
    setVisible: (
      visible: boolean,
    ) => void
  }
}