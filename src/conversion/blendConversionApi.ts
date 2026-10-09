import {
  BLEND_CONVERTER_URL,
} from '../config/conversion'

const GLB_MIME_TYPE =
  'model/gltf-binary'

const GLB_MAGIC =
  0x46546c67

const GLB_VERSION =
  2

const MAX_ERROR_MESSAGE_LENGTH =
  500

export interface BlendConversionResult {
  outputFileName: string
  glbBlob: Blob
}

function getGlbFileName(
  blendFileName: string,
) {
  if (
    blendFileName
      .toLowerCase()
      .endsWith('.blend')
  ) {
    return (
      blendFileName.slice(
        0,
        -'.blend'.length,
      ) + '.glb'
    )
  }

  return `${blendFileName}.glb`
}

async function getConversionErrorMessage(
  response: Response,
) {
  try {
    const responseText =
      await response.text()

    const trimmedResponse =
      responseText.trim()

    if (trimmedResponse) {
      return trimmedResponse.slice(
        0,
        MAX_ERROR_MESSAGE_LENGTH,
      )
    }
  } catch {
    // Use the generic message below.
  }

  return (
    `Blender conversion failed ` +
    `with status ${response.status}.`
  )
}

async function isValidGlbBlob(
  blob: Blob,
) {
  if (blob.size < 12) {
    return false
  }

  const headerBuffer =
    await blob
      .slice(0, 12)
      .arrayBuffer()

  const header =
    new DataView(
      headerBuffer,
    )

  const magic =
    header.getUint32(
      0,
      true,
    )

  const version =
    header.getUint32(
      4,
      true,
    )

  const declaredLength =
    header.getUint32(
      8,
      true,
    )

  return (
    magic === GLB_MAGIC &&
    version === GLB_VERSION &&
    declaredLength === blob.size
  )
}

export async function convertBlendToGlb(
  sourceBlob: Blob,
  sourceFileName: string,
  signal?: AbortSignal,
): Promise<BlendConversionResult> {
  if (!BLEND_CONVERTER_URL) {
    throw new Error(
      'Blender conversion service is not configured.',
    )
  }

  if (
    !sourceFileName
      .toLowerCase()
      .endsWith('.blend')
  ) {
    throw new Error(
      'Only Blender .blend files can be converted.',
    )
  }

  const sourceFile =
    new File(
      [sourceBlob],
      sourceFileName,
      {
        type:
          sourceBlob.type ||
          'application/octet-stream',
      },
    )

  const formData =
    new FormData()

  formData.append(
    'file',
    sourceFile,
  )

  const response =
    await fetch(
      BLEND_CONVERTER_URL,
      {
        method: 'POST',
        body: formData,
        signal,
      },
    )

  if (!response.ok) {
    throw new Error(
      await getConversionErrorMessage(
        response,
      ),
    )
  }

  const receivedBlob =
    await response.blob()

  if (
    !await isValidGlbBlob(
      receivedBlob,
    )
  ) {
    throw new Error(
      'Blender conversion did not return a valid GLB file.',
    )
  }

  const glbBlob =
    receivedBlob.type ===
      GLB_MIME_TYPE
      ? receivedBlob
      : new Blob(
        [receivedBlob],
        {
          type: GLB_MIME_TYPE,
        },
      )

  return {
    outputFileName:
      getGlbFileName(
        sourceFileName,
      ),

    glbBlob,
  }
}