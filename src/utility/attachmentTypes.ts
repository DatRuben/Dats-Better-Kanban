import type {
    AttachmentProcessing,
} from '../types/board'

export function isPreviewableMedia(
    mimeType: string,
) {
    return (
        mimeType.startsWith('image/') ||
        mimeType === 'video/mp4'
    )
}

export function isBlenderFileName(
    fileName: string,
) {
    return fileName
        .toLowerCase()
        .endsWith('.blend')
}

export function isSupportedAttachmentFile(
    file: File,
) {
    return (
        isPreviewableMedia(file.type) ||
        isBlenderFileName(file.name)
    )
}

export function getAttachmentTypeLabel(
    fileName: string,
    mimeType: string,
) {
    if (isBlenderFileName(fileName)) {
        return 'Blender file'
    }

    if (mimeType.startsWith('image/')) {
        return 'Image'
    }

    if (mimeType === 'video/mp4') {
        return 'MP4 video'
    }

    return mimeType || 'File'
}

export function createInitialAttachmentProcessing(
    fileName: string,
): AttachmentProcessing | undefined {
    if (!isBlenderFileName(fileName)) {
        return undefined
    }

    return {
        kind: 'blend-to-glb',
        status: 'uploaded',
        updatedAt:
            new Date().toISOString(),
    }
}

export function getAttachmentProcessingLabel(
    fileName: string,
    processing:
        AttachmentProcessing | undefined,
) {
    if (!isBlenderFileName(fileName)) {
        return null
    }

    const status =
        processing?.status ?? 'uploaded'

    switch (status) {
        case 'uploaded':
            return 'Uploaded'

        case 'queued':
            return 'Queued'

        case 'converting':
            return 'Converting'

        case 'ready':
            return 'Ready'

        case 'failed':
            return 'Conversion failed'
    }
}