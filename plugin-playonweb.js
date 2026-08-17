import axios from 'axios'

// Ganti sesuai alamat music-server kamu (kalau di-deploy di Railway,
// isi dengan URL Railway-nya, misal https://playonweb.up.railway.app)
const PLAYONWEB_SERVER = process.env.PLAYONWEB_URL || 'http://localhost:4390'

const pluginConfig = {
    name: 'playonweb',
    alias: ['pow', 'webplay'],
    category: 'main',
    description: 'Muter lagu di web player yang lagi kebuka di browser',
    usage: '.playonweb <judul lagu>',
    example: '.playonweb hindia secukupnya',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 5,
    energi: 0,
    isEnabled: true
}

async function handler(m, { text }) {
    if (!text) {
        return m.reply(
            `❌ *ꜰᴏʀᴍᴀᴛ sᴀʟᴀʜ*\n\n` +
            `> ${m.prefix}playonweb <judul lagu>\n\n` +
            `Contoh: ${m.prefix}playonweb hindia secukupnya`
        )
    }

    m.react('🕕')

    try {
        const { data } = await axios.get(`${PLAYONWEB_SERVER}/api/play`, {
            params: { song: text },
            timeout: 15000
        })

        if (!data.ok) {
            m.react('❌')
            return m.reply(`❌ *ɢᴀɢᴀʟ*\n\n> ${data.error || 'Lagu tidak ditemukan'}`)
        }

        if (!data.hadListeners) {
            m.react('⚠️')
            return m.reply(
                `⚠️ *ᴡᴇʙ ᴘʟᴀʏᴇʀ ʙᴇʟᴜᴍ ᴋᴇʙᴜᴋᴀ*\n\n` +
                `Lagu *${data.title}* udah disiapin, tapi belum ada browser yang connect ke player.\n\n` +
                `Buka dulu halaman web player-nya, nanti begitu ada yang connect lagunya otomatis keputer.`
            )
        }

        m.react('✅')
        return m.reply(
            `🎵 *ɴᴏᴡ ᴘʟᴀʏɪɴɢ (web)*\n\n` +
            `• Judul: *${data.title}*\n` +
            `• Channel: ${data.channel}\n` +
            `• Durasi: ${data.duration || '-'}\n` +
            `• Kedengeran di *${data.listenerCount}* browser yang lagi kebuka\n\n` +
            `_Muter di halaman web player, cek tab yang kebuka._`
        )
    } catch (err) {
        m.react('❌')
        if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
            return m.reply(
                `❌ *sᴇʀᴠᴇʀ ᴘʟᴀʏᴏɴᴡᴇʙ ᴏꜰꜰʟɪɴᴇ*\n\n` +
                `Nggak bisa connect ke ${PLAYONWEB_SERVER}. Pastiin music-server-nya jalan.`
            )
        }
        return m.reply(`❌ *ᴇʀʀᴏʀ*\n\n> ${err.message}`)
    }
}

export { pluginConfig as config, handler }
