const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');

const PHONE_NUMBER = process.env.PHONE_NUMBER; 
const spamData = {};
const BOT_NAME = "SATGAS SATPAM INDOSIAR";

// BLOKIR SEMUA LINK + KATA PROMOSI
const BLOCKED_WORDS = [
    'http', 'www.', '.com', '.id', '.link', '.me', 
    'jual', 'beli', 'promo', 'diskon', 'murah', 'order', 'cod', 'wa.me',
    'judi', 'slot', 'togel', 'pinjol', 'crypto', 'investasi'
];

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('session');
    const sock = makeWASocket({ auth: state, printQRInTerminal: false });
    sock.ev.on('creds.update', saveCreds);

    // LOGIN: Pairing atau QR
    if(!sock.authState.creds.registered){
        if(PHONE_NUMBER){
            setTimeout(async () => {
                let code = await sock.requestPairingCode(PHONE_NUMBER);
                code = code?.match(/.{1,4}/g)?.join("-") || code;
                console.log(`[${BOT_NAME}] PAIRING CODE: ${code}`)
            }, 3000)
        } else {
            console.log(`[${BOT_NAME}] SCAN QR CODE DI LOGS`)
        }
    }

    // Welcome
    sock.ev.on('group-participants.update', async (update) => {
        if(update.action === 'add'){
            await sock.sendMessage(update.id, {
                text: `👮 [${BOT_NAME}] Selamat datang @${update.participants[0].split('@')[0]}!\nGrup ini dijaga ketat. Dilarang promosi & spam!`,
                mentions: update.participants
            });
        }
    });

    // Penjaga Grup
    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if(!msg.message || msg.key.fromMe) return;
        const from = msg.key.remoteJid;
        const sender = msg.key.participant || msg.key.remoteJid;
        const text = (msg.message.conversation || msg.message.extendedTextMessage?.text || "").toLowerCase();

        if(!from.endsWith('@g.us')) return;

        // ANTI PROMOSI + ANTI LINK
        if(BLOCKED_WORDS.some(word => text.includes(word))){
            await sock.sendMessage(from, { delete: msg.key });
            await sock.sendMessage(from, {
                text: `🚨 [${BOT_NAME}]\n@${sender.split('@')[0]} KETAHUAN PROMOSI/SPAM LINK!\nINI BUKAN TEMPAT JUALAN. DITERTIBKAN!`,
                mentions: [sender]
            });
            await sock.groupParticipantsUpdate(from, [sender], "remove");
            return;
        }

        // ANTI SPAM: 5 pesan/5 detik
        if(!spamData[sender]) spamData[sender] = [];
        spamData[sender].push(Date.now());
        spamData[sender] = spamData[sender].filter(t => Date.now() - t < 5000);
        if(spamData[sender].length > 5){
            await sock.groupParticipantsUpdate(from, [sender], "remove");
            await sock.sendMessage(from, {
                text: `🚨 [${BOT_NAME}] @${sender.split('@')[0]} TERLALU BANYAK CHAT = DITERTIBKAN!`,
                mentions: [sender]
            });
        }

        // COMMAND ADMIN
        if(text.startsWith('!kick')){
            const target = msg.message.extendedTextMessage?.contextInfo?.mentionedJid;
            if(target) await sock.groupParticipantsUpdate(from, target, "remove");
        }
        if(text === '!tagall'){
            const group = await sock.groupMetadata(from);
            const tags = group.participants.map(p => p.id);
            await sock.sendMessage(from, { text: `👮 [${BOT_NAME}] TAG ALL`, mentions: tags });
        }
        if(text === '!menu'){
            await sock.sendMessage(from, { 
                text: `👮 *MENU ${BOT_NAME}*\n!kick @tag - Kick member\n!tagall - Tag semua\n!menu - Lihat menu` 
            });
        }
    });

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if(connection === 'close') {
            if(lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut) {
                startBot();
            }
        }
        if(connection === 'open') console.log(`[${BOT_NAME}] ONLINE DAN SIAP BERTUGAS!`);
    });
}

startBot();