import fs from 'node:fs/promises'
import { defineConfig } from 'vite'
import { formatJson } from './src/debug/formatJson.js'

const ASSEMBLY_FILE = 'src/data/assembly.json'

// Dev-server-only endpoint used by the ?debug=1 panel to save tuned assembly values.
// configureServer never runs in `vite build` / `vite preview`, so production has no write access.
function assemblySavePlugin() {
  return {
    name: 'smart-tree-assembly-save',
    configureServer(server) {
      server.middlewares.use('/__debug/assembly', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          return res.end('POST only')
        }
        let body = ''
        for await (const chunk of req) body += chunk
        try {
          const data = JSON.parse(body)
          if (!data?.modules || typeof data.modules !== 'object') throw new Error('missing "modules"')
          await fs.writeFile(ASSEMBLY_FILE, formatJson(data))
          res.end('ok')
        } catch (err) {
          res.statusCode = 400
          res.end(err.message)
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [assemblySavePlugin()],
  build: {
    // The main chunk is ~790 kB (~210 kB gzip), almost all three.js; it is served locally, so the
    // default 500 kB warning is noise here. Raise this if the app code itself grows.
    chunkSizeWarningLimit: 900,
  },
})
