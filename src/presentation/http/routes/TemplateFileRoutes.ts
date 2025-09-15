/**
 * Template File Routes for File System Access
 *
 * Provides REST endpoints to access template file information
 */

import { readFile, stat } from 'node:fs/promises'
import type { ILogger } from '../../../application/ports/ILogger.js'
import type { DIContainer } from '../../../infrastructure/container/DIContainer.js'
import { CommonTokens } from '../../../infrastructure/container/tokens/CommonTokens.js'

export interface TemplateFileEndpoint {
  path: string
  method: 'GET' | 'POST'
  handler: (request: Request) => Promise<Response>
}

export class TemplateFileRoutes {
  private logger?: ILogger

  constructor(private container: DIContainer) {}

  private async getLogger(): Promise<ILogger> {
    if (!this.logger) {
      this.logger = await this.container.resolve<ILogger>(CommonTokens.LOGGER)
    }
    return this.logger
  }

  /**
   * Get all template file related endpoints
   */
  async getEndpoints(): Promise<TemplateFileEndpoint[]> {
    return [
      {
        path: '/api/template-files',
        method: 'GET',
        handler: this.getTemplateFileInfo.bind(this),
      },
    ]
  }

  /**
   * GET /api/template-files?path=... - Returns template file information
   */
  private async getTemplateFileInfo(request: Request): Promise<Response> {
    try {
      const logger = await this.getLogger()
      const url = new URL(request.url)
      const filePath = url.searchParams.get('path')

      if (!filePath) {
        return new Response(
          JSON.stringify({
            error: 'Missing path parameter',
            message: 'Please provide a file path via ?path= parameter',
          }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          }
        )
      }

      logger.info('Template file info requested', {
        filePath,
        userAgent: request.headers.get('user-agent'),
      })

      // 보안: 절대 경로만 허용하고 상위 디렉터리 접근 방지
      if (!filePath.startsWith('/Users/junwoobang/project/bun-graph-db/demo/templates/')) {
        return new Response(
          JSON.stringify({
            error: 'Invalid path',
            message: 'Only template files in demo/templates/ directory are allowed',
          }),
          {
            status: 403,
            headers: { 'Content-Type': 'application/json' },
          }
        )
      }

      try {
        const fileStats = await stat(filePath)
        const fileContent = await readFile(filePath, 'utf-8')

        // 파일이 유효한 JSON인지 확인
        let isValidJson = false
        let templateName = ''
        try {
          const parsedContent = JSON.parse(fileContent)
          isValidJson = true
          templateName = parsedContent.name || parsedContent.operationName || 'Unknown Template'
        } catch {
          isValidJson = false
        }

        const fileName = filePath.split('/').pop() || ''
        const [extractedName] = fileName.split('_v')

        return new Response(
          JSON.stringify({
            path: filePath,
            name:
              templateName ||
              (extractedName || fileName)
                .replace(/-/g, ' ')
                .replace(/\b\w/g, (l) => l.toUpperCase()),
            fileName,
            lastModified: fileStats.mtime.toISOString(),
            size: fileStats.size,
            isValid: isValidJson,
            category: fileName.includes('system')
              ? 'system'
              : fileName.includes('statistics')
                ? 'statistics'
                : 'general',
          }),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              'Cache-Control': 'public, max-age=30', // 30초 캐시
              'Access-Control-Allow-Origin': '*',
              'Access-Control-Allow-Methods': 'GET',
              'Access-Control-Allow-Headers': 'Content-Type',
            },
          }
        )
      } catch (fileError) {
        logger.warn('Failed to read template file', { filePath, error: fileError })

        return new Response(
          JSON.stringify({
            error: 'File not found or inaccessible',
            message: `Could not read file: ${filePath}`,
            path: filePath,
          }),
          {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
          }
        )
      }
    } catch (error) {
      const logger = await this.getLogger()
      logger.error('Failed to process template file request', { error })

      return new Response(
        JSON.stringify({
          error: 'Internal server error',
          message: error instanceof Error ? error.message : 'Unknown error',
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }
  }
}

/**
 * Template file route handler for Bun.serve
 */
export async function createTemplateFileHandler(container: DIContainer) {
  const routes = new TemplateFileRoutes(container)
  const endpoints = await routes.getEndpoints()

  return async (request: Request): Promise<Response | null> => {
    const url = new URL(request.url)
    const pathname = url.pathname

    for (const endpoint of endpoints) {
      if (pathname === endpoint.path && request.method === endpoint.method) {
        return await endpoint.handler(request)
      }
    }

    return null // Not handled by template file routes
  }
}
