import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'story-source-api',
      configureServer(server) {
        const storyRoot = path.resolve(server.config.root, 'story-data')

        function resolveChapterPath(url: string) {
          const requestUrl = new URL(url, 'http://localhost')
          const requestedPath = requestUrl.searchParams.get('path') ?? ''
          const resolvedPath = path.resolve(server.config.root, requestedPath)

          if (!resolvedPath.startsWith(storyRoot + path.sep)) {
            return null
          }

          return resolvedPath
        }

        server.middlewares.use('/api/chapter-source', (request, response) => {
          const resolvedPath = resolveChapterPath(request.url ?? '')
          if (!resolvedPath) {
            response.statusCode = 400
            response.end('Invalid chapter path')
            return
          }

          if (request.method === 'GET') {
            void readFile(resolvedPath, 'utf8')
              .then((content) => {
                response.setHeader('Content-Type', 'text/plain; charset=utf-8')
                response.end(content)
              })
              .catch(() => {
                response.statusCode = 404
                response.end('Chapter source not found')
              })
            return
          }

          if (request.method === 'POST') {
            let body = ''
            request.setEncoding('utf8')
            request.on('data', (chunk) => {
              body += chunk
            })
            request.on('end', () => {
              void mkdir(path.dirname(resolvedPath), { recursive: true })
                .then(() => writeFile(resolvedPath, body, 'utf8'))
                .then(() => {
                  response.setHeader('Content-Type', 'application/json')
                  response.end(JSON.stringify({ ok: true }))
                })
                .catch(() => {
                  response.statusCode = 500
                  response.end('Unable to save chapter source')
                })
            })
            return
          }

          response.statusCode = 405
          response.end('Method not allowed')
        })
      },
    },
  ],
})
