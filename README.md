# playonweb

Bot WA cuma jadi remote. Musiknya beneran keluar dari browser yang lagi
kebuka halaman web player (YouTube IFrame API), bukan dikirim sebagai file
audio ke WhatsApp.

## Cara kerja

```
WA: .playonweb judul lagu
      │
      ▼
plugin-playonweb.js  ──HTTP GET──▶  server.js (music-server)
                                        │  search YouTube (yt-search)
                                        │  broadcast lewat WebSocket
                                        ▼
                                 semua browser yang lagi
                                 buka halaman web player
                                 ──▶ langsung muter lagunya
```

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
- Sumber lagu dari pencarian YouTube (`yt-search`), diputer lewat YouTube
  IFrame Player API langsung di browser — jadi nggak perlu simpen/convert
  file audio sama sekali.
