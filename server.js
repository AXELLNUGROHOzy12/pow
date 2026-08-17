import express from 'express'
import cors from 'cors'
import http from 'http'
import { WebSocketServer } from 'ws'
import yts from 'yt-search'
import path from 'path'
import { fileURLToPath } from 'url'
import { Innertube } from 'youtubei.js'
import https from 'https'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const app = express()
app.use(cors())
app.use(express.static(path.join(__dirname, 'public')))

// youtubei.js: pure JS, ngobrol langsung ke internal API YouTube (kayak yang
// dipakai app resminya) — gak butuh binary/Python eksternal, jadi aman
// dijalanin di platform kayak Railway yang cuma nyediain Node runtime.
let ytClient = null
async function getYtClient() {
  if (!ytClient) ytClient = await Innertube.create({ generate_session_locally: true })
  return ytClient
}

// Cache URL stream audio per videoId biar gak nge-resolve ulang tiap request
// (URL dari YouTube ada masa berlakunya beberapa jam, jadi kita simpen sebentar aja).
const streamCache = new Map() // videoId -> { url, expiresAt }
const STREAM_CACHE_MS = 3 * 60 * 60 * 1000 // 3 jam, aman di bawah masa berlaku asli

async function resolveAudioUrl(videoId) {
  const cached = streamCache.get(videoId)
  if (cached && cached.expiresAt > Date.now()) return cached.url

  const yt = await getYtClient()

  // Coba beberapa "client" YouTube secara berurutan. YouTube kadang nolak
  // (400) atau ngeblok salah satu client type, jadi kita fallback biar gak
  // gampang total gagal cuma gara-gara satu client lagi bermasalah.
  const clientsToTry = ['ANDROID', 'IOS', 'WEB']
  let lastErr = null

  for (const client of clientsToTry) {
    try {
      const info = await yt.getBasicInfo(videoId, client)
      const format = info.chooseFormat({ type: 'audio', quality: 'best' })
      if (!format) continue

      const url = format.decipher ? (format.url || format.decipher(yt.session.player)) : format.url
      if (!url) continue

      streamCache.set(videoId, { url, expiresAt: Date.now() + STREAM_CACHE_MS })
      return url
    } catch (err) {
      lastErr = err
      console.warn(`[playonweb] client ${client} gagal:`, err.message)
    }
  }

  throw lastErr || new Error('Gagal ambil URL audio dari semua client YouTube')
}

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

// Opsional: stop pemutaran dari sisi bot juga kalau dibutuhkan nanti.
app.get('/api/stop', (req, res) => {
  currentTrack = null
  broadcast({ type: 'stop' })
  res.json({ ok: true })
})

app.get('/api/status', (req, res) => {
  res.json({ ok: true, listenerCount: clients.size, currentTrack })
})

// Proxy audio stream: browser cukup panggil endpoint ini (dengan Range support
// biar bisa seek/buffer), jadi gak perlu tau URL asli googlevideo.com yang
// gampang expired/berubah tiap request. Ini juga yang bikin <audio> tag bisa
// dipakai (bukan <iframe> YouTube) sehingga browser mobile jauh lebih toleran
// mutar di background/layar mati.
app.get('/api/stream/:videoId', async (req, res) => {
  const { videoId } = req.params
  try {
    const audioUrl = await resolveAudioUrl(videoId)

    const upstreamHeaders = {}
    if (req.headers.range) upstreamHeaders.range = req.headers.range

    https.get(audioUrl, { headers: upstreamHeaders }, (upstream) => {
      res.status(upstream.statusCode || 200)
      for (const h of ['content-type', 'content-length', 'content-range', 'accept-ranges']) {
        if (upstream.headers[h]) res.setHeader(h, upstream.headers[h])
      }
      if (!upstream.headers['accept-ranges']) res.setHeader('accept-ranges', 'bytes')
      upstream.pipe(res)
    }).on('error', (err) => {
      console.error('[playonweb] stream proxy error:', err.message)
      if (!res.headersSent) res.status(502).json({ ok: false, error: 'Gagal streaming audio' })
    })
  } catch (err) {
    console.error('[playonweb] resolve error:', err.message)
    if (!res.headersSent) res.status(500).json({ ok: false, error: 'Gagal ambil audio, coba lagi.' })
  }
})

const PORT = process.env.PORT || 4390
server.listen(PORT, () => {
  console.log(`[playonweb] server jalan di port ${PORT}`)
})
