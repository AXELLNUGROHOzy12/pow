# playonweb

Bot WA cuma jadi remote. Musiknya beneran keluar dari browser yang lagi
kebuka halaman web player, bukan dikirim sebagai file audio ke WhatsApp.

Server yang nyari lagu di YouTube (`yt-search`) lalu ekstrak URL audio
mentahnya (`youtubei.js` — pure JS, ngobrol langsung ke internal API
YouTube, gak butuh binary/Python eksternal) dan di-proxy lewat endpoint
sendiri ke tag `<audio>`
biasa di browser — bukan iframe video YouTube. Ini penting: tag `<audio>`
jauh lebih toleran dijalankan browser mobile pas tab di-minimize atau layar
dikunci, apalagi dikombinasi Media Session API (bikin browser anggap ini
sesi media beneran, dapat kontrol di lock screen, dan dikecualikan dari
sebagian pembatasan background) + Wake Lock (nahan layar nggak tidur pas
lagu jalan).

## Cara kerja

```
WA: .playonweb judul lagu
      │
      ▼
plugin-playonweb.js  ──HTTP GET──▶  server.js (music-server)
                                        │  search YouTube (yt-search)
                                        │  broadcast videoId lewat WebSocket
                                        ▼
                                 browser yang lagi kebuka
                                 ──▶ <audio src="/api/stream/<id>">
                                     (server proxy audio via youtubei.js)
```

## Catatan soal "bisa background"

- Browser tetap punya kuasa penuh buat suspend tab kalau device lagi
  low-power/battery-saver ekstrem — nggak ada API web yang bisa 100% jamin
  ini di semua kondisi. Tapi kombinasi `<audio>` tag + Media Session +
  Wake Lock ini adalah cara paling maksimal yang bisa dilakukan lewat web
  biasa (tanpa jadi native app).
- Sekali ketuk "Aktifkan Audio" tetap wajib (aturan browser), setelah itu
  play berikutnya dari WA udah otomatis nyala tanpa perlu buka tab lagi.
- Kalau HP di-lock, biasanya kontrol play/pause/judul lagu bakal muncul di
  lock screen / notification shade — itu dari Media Session API.

## 1. Jalanin music-server-nya

```bash
cd playonweb
npm install
npm start
```

Defaultnya jalan di `http://localhost:4390`. Kalau mau deploy (misal ke
Railway biar bisa diakses dari mana aja), tinggal push folder ini sebagai
service baru — dia standalone, gak butuh apa-apa dari project Nova/Ourin.

## 2. Buka web player-nya

Buka `http://localhost:4390` (atau URL Railway-nya) di browser laptop/HP.
Sekali ketuk "Aktifkan Audio" (browser emang wajib gitu biar audio nanti
boleh nyala otomatis), habis itu biarin tabnya tetap kebuka.

## 3. Pasang plugin-nya ke bot Nova

1. Copy `plugin-playonweb.js` ke folder plugin bot kamu (misal
   `plugins/main/playonweb.js`)
2. Set env var `PLAYONWEB_URL` ke alamat music-server kamu, contoh:
   ```
   PLAYONWEB_URL=https://playonweb-production.up.railway.app
   ```
   Kalau server-nya jalan di device yang sama dengan bot pas development,
   boleh dibiarin default (`http://localhost:4390`).

## 4. Coba

Di WhatsApp:
```
.playonweb hindia secukupnya
```

Bot bakal balas konfirmasi + jumlah browser yang lagi denger. Kalau belum
ada browser yang buka halaman player-nya, bot bakal ngasih tau juga.

## Catatan

- Ini single "room" global — semua browser yang connect ke server yang sama
  bakal ikut muter lagu yang sama. Cocok buat 1 pemakaian pribadi/1 device.
  Kalau nanti butuh multi-room (tiap orang/device punya sesi sendiri),
  tinggal bilang, bisa ditambahin sistem kode room.
- Sumber lagu dari pencarian YouTube (`yt-search`), audio-nya di-stream
  langsung (bukan didownload/disimpen ke disk) lewat `youtubei.js` yang
  jalan di server pas ada request — jadi nggak ada file yang numpuk.
- `youtubei.js` murni JavaScript (bukan wrapper ke binary Python/CLI kayak
  yt-dlp), jadi langsung jalan di Railway/Replit/Netlify Functions tanpa
  perlu setup runtime tambahan.
