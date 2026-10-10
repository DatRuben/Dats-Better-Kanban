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

        Feature: {
          MULTISELECT_ENABLED: string
          NAV_HIDDEN: string
        }

        ViewId: {
          FOLDERS: string
          DOCS: string
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

  interface GooglePickerDocument {
    id?: string
    name?: string
    mimeType?: string
  }

  interface GooglePickerCallbackData {
    action: string
    docs?: GooglePickerDocument[]
  }

  interface GooglePickerDocsView {
    setIncludeFolders: (
      included: boolean,
    ) => GooglePickerDocsView

    setSelectFolderEnabled: (
      enabled: boolean,
    ) => GooglePickerDocsView

    setMimeTypes: (
      mimeTypes: string,
    ) => GooglePickerDocsView

    setParent: (
      parentId: string,
    ) => GooglePickerDocsView
  }

  interface GooglePickerBuilder {
    addView: (
      view: GooglePickerDocsView,
    ) => GooglePickerBuilder

    enableFeature: (
      feature: string,
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