import {
  GOOGLE_APP_ID,
  GOOGLE_PICKER_API_KEY,
} from '../config/google'

function loadGooglePickerApi(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!window.gapi) {
      reject(
        new Error(
          'Google API has not loaded.',
        ),
      )

      return
    }

    window.gapi.load(
      'picker',
      resolve,
    )
  })
}

export async function pickGoogleDriveFolder(
  accessToken: string,
): Promise<string | null> {
  if (
    !GOOGLE_PICKER_API_KEY ||
    !GOOGLE_APP_ID
  ) {
    throw new Error(
      'Google Picker is not configured.',
    )
  }

  await loadGooglePickerApi()

  const pickerApi =
    window.google?.picker

  if (!pickerApi) {
    throw new Error(
      'Google Picker could not be loaded.',
    )
  }

  return new Promise(
    (resolve, reject) => {
      const folderView =
        new pickerApi.DocsView(
          pickerApi.ViewId.FOLDERS,
        )
          .setIncludeFolders(true)
          .setSelectFolderEnabled(true)

      const picker =
        new pickerApi.PickerBuilder()
          .addView(folderView)
          .setOAuthToken(accessToken)
          .setDeveloperKey(
            GOOGLE_PICKER_API_KEY,
          )
          .setAppId(
            GOOGLE_APP_ID,
          )
          .setCallback((data) => {
            if (
              data.action ===
              pickerApi.Action.PICKED
            ) {
              const folderId =
                data.docs?.[0]?.id

              if (!folderId) {
                reject(
                  new Error(
                    'Google Picker did not return a folder ID.',
                  ),
                )

                return
              }

              resolve(folderId)

              return
            }

            if (
              data.action ===
              pickerApi.Action.CANCEL
            ) {
              resolve(null)
            }
          })
          .build()

      picker.setVisible(true)
    },
  )
}