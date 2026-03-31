import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd())
  const serverPort = env.VITE_SERVER_PORT ?? '3456'
  const serverUrl = `http://localhost:${serverPort}`

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@kindred/shared': path.resolve(__dirname, '../shared/src/index.ts'),
      },
    },
    server: {
      port: 5173,
      proxy: {
        '/socket.io': { target: serverUrl, ws: true },
        '/assets': { target: serverUrl },
      },
    },
  }
})
