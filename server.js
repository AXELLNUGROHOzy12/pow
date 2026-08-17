import express from 'express'
import cors from 'cors'
import http from 'http'
import { WebSocketServer } from 'ws'
import yts from 'yt-search'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const app = express()
app.use(cors())
app.use(express.static(path.join(__dirname, 'public')))

const server = http.createServer(app)
const wss = new WebSocketServer({ server, path: '/ws' })

// Simpan state track terakhir, biar client yang baru connect langsung sinkron.
let currentTrack = null
const clients = new Set()

wss.on('connection', (ws) => {
  clients.add(ws)
  if (currentTrack) {
    ws.send(JSON.stringify({ type: 'play', ...currentTrack }))
  }
  ws.on('close', () => clients.delete(ws))
})

function broadcast(payload) {
  const raw = JSON.stringify(payload)
  for (const ws of clients) {
    if (ws.readyState === ws.OPEN) ws.send(raw)
  }
}

// Endpoint yang dipanggil plugin WA bot: GET /api/play?song=<judul lagu>
// Cuma nyari videoId lewat yt-search — pemutaran audionya sendiri kejadian di
// browser lewat YouTube IFrame Player API resmi (lihat public/index.html),
// bukan lewat ekstraksi stream server-side.
app.get('/api/play', async (req, res) => {
  const song = (req.query.song || '').toString().trim()
  if (!song) {
    return res.status(400).json({ ok: false, error: 'Parameter "song" wajib diisi' })
  }

  try {
    const result = await yts(song)
    const video = result.videos?.[0]

    if (!video) {
      return res.status(404).json({ ok: false, error: 'Lagu tidak ditemukan di YouTube' })
    }

    currentTrack = {
      videoId: video.videoId,
      title: video.title,
      channel: video.author?.name || 'Unknown',
      thumbnail: video.thumbnail,
      duration: video.timestamp,
      url: video.url,
      startedAt: Date.now()
    }

    const hadListeners = clients.size > 0
    broadcast({ type: 'play', ...currentTrack })

    return res.json({
      ok: true,
      hadListeners,
      listenerCount: clients.size,
      title: currentTrack.title,
      channel: currentTrack.channel,
      duration: currentTrack.duration,
      url: currentTrack.url
    })
  } catch (err) {
    console.error('[playonweb] search error:', err.message)
    return res.status(500).json({ ok: false, error: 'Gagal mencari lagu, coba lagi.' })
  }
})

app.get('/api/stop', (req, res) => {
  currentTrack = null
  broadcast({ type: 'stop' })
  res.json({ ok: true })
})

app.get('/api/status', (req, res) => {
  res.json({ ok: true, listenerCount: clients.size, currentTrack })
})

const PORT = process.env.PORT || 4390
server.listen(PORT, () => {
  console.log(`[playonweb] server jalan di port ${PORT}`)
})
