
import type { Project } from '../types/board'

import {
    loadProjectDocumentFromDrive,
} from './googleDriveApi'

const DRIVE_FILES_URL =
    'https://www.googleapis.com/drive/v3/files'

const RETRY_DELAY_MS =
    5 * 60 * 1000

const DELETION_GRACE_PERIOD_MS =
    30 * 60 * 1000

const retryAfter =
    new Map<string, number>()

export interface SharedDeletionCleanupOptions {
    accessToken: string
    projectFileId: string
    userPermissionId: string
    attachmentsFolderId: string
    savedProject: Project
    localProject: Project
    canProceed: () => boolean
    getCurrentLocalProject: () => Project
}

interface DriveFileMetadata {
    parents?: string[]
    trashed?: boolean
    mimeType?: string
    capabilities?: {
        canTrash?: boolean
    }
}

function referencedFileIds(
    ...projects: Project[]
): Set<string> {
    const result = new Set<string>()

    for (const project of projects) {
        for (const task of project.tasks) {
            for (const attachment of task.attachments) {
                if (attachment.driveFileId) {
                    result.add(attachment.driveFileId)
                }
            }
        }
    }

    return result
}

function receiptKey(
    projectFileId: string,
    fileId: string,
): string {
    return (
        `dats:trashed-attachment:v1:` +
        `${projectFileId}:${fileId}`
    )
}

function hasSuccessReceipt(
    key: string,
): boolean {
    try {
        return localStorage.getItem(key) === '1'
    } catch {
        return false
    }
}

function rememberSuccess(
    key: string,
): void {
    try {
        localStorage.setItem(key, '1')
    } catch {
    }
}

function pauseRetry(
    key: string,
): void {
    retryAfter.set(
        key,
        Date.now() + RETRY_DELAY_MS,
    )
}

function isGracePeriodComplete(
    requestedAt: string,
): boolean {
    const requestedTime =
        Date.parse(requestedAt)

    if (!Number.isFinite(requestedTime)) {
        return false
    }

    return (
        Date.now() - requestedTime >=
        DELETION_GRACE_PERIOD_MS
    )
}

export async function processSharedAttachmentDeletions(
    options: SharedDeletionCleanupOptions,
): Promise<string[]> {
    const {
        accessToken,
        projectFileId,
        userPermissionId,
        attachmentsFolderId,
        savedProject,
        localProject,
        canProceed,
        getCurrentLocalProject,
    } = options

    if (
        savedProject.id !== localProject.id ||
        !attachmentsFolderId ||
        !canProceed()
    ) {
        return []
    }

    const completed: string[] = []
    const seen = new Set<string>()

    const initiallyReferenced =
        referencedFileIds(
            savedProject,
            localProject,
        )

    for (
        const request of
        savedProject.attachmentDeletionRequests ?? []
    ) {
        const fileId = request.driveFileId

        if (
            !fileId ||
            request.completedAt ||
            seen.has(fileId) ||
            initiallyReferenced.has(fileId) ||
            !isGracePeriodComplete(
                request.requestedAt,
            ) ||
            !canProceed()
        ) {
            continue
        }

        seen.add(fileId)

        const successKey =
            receiptKey(projectFileId, fileId)

        if (hasSuccessReceipt(successKey)) {
            completed.push(fileId)
            continue
        }

        const retryKey =
            `${projectFileId}:` +
            `${userPermissionId}:${fileId}`

        if (
            (retryAfter.get(retryKey) ?? 0) >
            Date.now()
        ) {
            continue
        }

        try {
            const latestDocument =
                await loadProjectDocumentFromDrive(
                    accessToken,
                    projectFileId,
                )

            if (!canProceed()) {
                continue
            }

            const latestProject =
                latestDocument.project

            if (
                latestProject.id !== savedProject.id
            ) {
                continue
            }

            const latestRequest =
                latestProject.attachmentDeletionRequests
                    ?.find(
                        (entry) =>
                            entry.driveFileId === fileId,
                    )

            if (
                !latestRequest ||
                latestRequest.completedAt ||
                latestRequest.requestedAt !==
                request.requestedAt
            ) {
                continue
            }

            const referenced =
                referencedFileIds(
                    savedProject,
                    latestProject,
                    getCurrentLocalProject(),
                )

            if (referenced.has(fileId)) {
                continue
            }

            const metadataUrl = new URL(
                `${DRIVE_FILES_URL}/` +
                encodeURIComponent(fileId),
            )

            metadataUrl.searchParams.set(
                'fields',
                'id,parents,trashed,mimeType,capabilities(canTrash)',
            )

            const metadataResponse =
                await fetch(metadataUrl, {
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                    },
                })

            if (metadataResponse.status === 401) {
                throw new Error(
                    'Google Drive attachment access failed with status 401.',
                )
            }

            if (!metadataResponse.ok) {
                pauseRetry(retryKey)
                continue
            }

            const metadata =
                (await metadataResponse.json()) as DriveFileMetadata

            if (
                !metadata.parents?.includes(
                    attachmentsFolderId,
                ) ||
                metadata.mimeType ===
                'application/vnd.google-apps.folder'
            ) {
                pauseRetry(retryKey)
                continue
            }


            if (metadata.trashed === true) {
                rememberSuccess(successKey)
                retryAfter.delete(retryKey)
                completed.push(fileId)
                continue
            }


            if (
                metadata.capabilities?.canTrash !== true
            ) {
                pauseRetry(retryKey)
                continue
            }


            if (
                !canProceed() ||
                referencedFileIds(
                    getCurrentLocalProject(),
                ).has(fileId)
            ) {
                continue
            }

            const trashResponse =
                await fetch(
                    `${DRIVE_FILES_URL}/` +
                    encodeURIComponent(fileId),
                    {
                        method: 'PATCH',
                        headers: {
                            Authorization:
                                `Bearer ${accessToken}`,
                            'Content-Type':
                                'application/json',
                        },
                        body: JSON.stringify({
                            trashed: true,
                        }),
                    },
                )

            if (trashResponse.status === 401) {
                throw new Error(
                    'Google Drive attachment trash operation failed with status 401.',
                )
            }

            if (!trashResponse.ok) {
                pauseRetry(retryKey)

                console.warn(
                    'Google Drive attachment trash operation failed:',
                    trashResponse.status,
                )

                continue
            }

            rememberSuccess(successKey)
            retryAfter.delete(retryKey)
            completed.push(fileId)
        } catch (error) {
            if (
                error instanceof Error &&
                error.message.includes('status 401')
            ) {
                throw error
            }

            pauseRetry(retryKey)

            console.warn(
                'Shared attachment cleanup could not complete:',
                error,
            )
        }
    }

    return completed
}