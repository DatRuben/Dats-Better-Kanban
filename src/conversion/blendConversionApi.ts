import {
  BLEND_CONVERTER_URL,
} from '../config/conversion'

const GLB_MIME_TYPE =
  'model/gltf-binary'

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

    if (responseText.trim()) {
      return responseText
    }
  } catch {
    // Fall through to generic message.
  }

  return (
    `Blender conversion failed ` +
    `with status ${response.status}.`
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

  const glbBlob =
    await response.blob()

  if (glbBlob.size === 0) {
    throw new Error(
      'Blender conversion returned an empty GLB file.',
    )
  }

  return {
    outputFileName:
      getGlbFileName(
        sourceFileName,
      ),

    glbBlob:
      glbBlob.type ===
        GLB_MIME_TYPE
        ? glbBlob
        : new Blob(
          [glbBlob],
          {
            type: GLB_MIME_TYPE,
          },
        ),
  }
}