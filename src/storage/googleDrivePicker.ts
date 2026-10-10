import {
  GOOGLE_APP_ID,
  GOOGLE_PICKER_API_KEY,
} from '../config/google'

export interface PickedGoogleDriveFile {
  id: string
  name: string
}

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

function getGooglePickerApi() {
  const pickerApi =
    window.google?.picker

  if (!pickerApi) {
    throw new Error(
      'Google Picker could not be loaded.',
    )
  }

  return pickerApi
}

function verifyPickerConfiguration() {
  if (
    !GOOGLE_PICKER_API_KEY ||
    !GOOGLE_APP_ID
  ) {
    throw new Error(
      'Google Picker is not configured.',
    )
  }
}

export async function pickGoogleDriveFolder(
  accessToken: string,
): Promise<string | null> {
  verifyPickerConfiguration()

  await loadGooglePickerApi()

  const pickerApi =
    getGooglePickerApi()

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

export async function pickGoogleDriveProjectFile(
  accessToken: string,
): Promise<PickedGoogleDriveFile | null> {
  verifyPickerConfiguration()

  await loadGooglePickerApi()

  const pickerApi =
    getGooglePickerApi()

  return new Promise(
    (resolve, reject) => {
      const projectView =
        new pickerApi.DocsView(
          pickerApi.ViewId.DOCS,
        )
          .setIncludeFolders(true)
          .setSelectFolderEnabled(false)
          .setMimeTypes(
            'application/json',
          )

      const picker =
        new pickerApi.PickerBuilder()
          .addView(projectView)
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
              const document =
                data.docs?.[0]

              if (
                !document?.id ||
                !document.name
              ) {
                reject(
                  new Error(
                    'Google Picker did not return a project file.',
                  ),
                )

                return
              }

              resolve({
                id: document.id,
                name: document.name,
              })

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

export async function pickGoogleDriveAttachmentFiles(
  accessToken: string,
  allowedFileIds: string[],
): Promise<string[]> {
  if (allowedFileIds.length === 0) {
    return []
  }

  verifyPickerConfiguration()

  await loadGooglePickerApi()

  const pickerApi =
    getGooglePickerApi()

  const allowedFileIdSet =
    new Set(allowedFileIds)

  return new Promise<string[]>(
    (resolve, reject) => {
      const attachmentView =
        new pickerApi.DocsView(
          pickerApi.ViewId.DOCS,
        )
          .setIncludeFolders(false)
          .setSelectFolderEnabled(false)
          .setFileIds(
            [...allowedFileIdSet].join(','),
          )

      const picker =
        new pickerApi.PickerBuilder()
          .addView(attachmentView)
          .enableFeature(
            pickerApi.Feature.MULTISELECT_ENABLED,
          )
          .setOAuthToken(accessToken)
          .setDeveloperKey(
            GOOGLE_PICKER_API_KEY,
          )
          .setAppId(GOOGLE_APP_ID)
          .setCallback((data) => {
            if (
              data.action ===
              pickerApi.Action.CANCEL
            ) {
              resolve([])
              return
            }

            if (
              data.action !==
              pickerApi.Action.PICKED
            ) {
              return
            }

            const selectedFileIds =
              (data.docs ?? []).map(
                (document) => document.id,
              )

            const hasInvalidSelection =
              selectedFileIds.length === 0 ||
              selectedFileIds.some(
                (fileId) =>
                  !fileId ||
                  !allowedFileIdSet.has(fileId),
              )

            if (hasInvalidSelection) {
              reject(
                new Error(
                  'Google Picker did not return valid project attachment files.',
                ),
              )
              return
            }

            resolve(
              [...new Set(
                selectedFileIds as string[],
              )],
            )
          })
          .build()

      picker.setVisible(true)
    },
  )
}