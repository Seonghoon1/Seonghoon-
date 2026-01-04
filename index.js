import fs from 'fs';
import { makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion } from '@whiskeysockets/baileys';
import pino from 'pino';

// --- 1. THE AUTO-INSTALLER (Vinsmoke Core) ---
if (!fs.existsSync('./lib')) fs.mkdirSync('./lib');
if (!fs.existsSync('./plugins')) fs.mkdirSync('./plugins');

// Create config.js with your requirements
if (!fs.existsSync('./config.js')) {
    fs.writeFileSync('./config.js', `export default {
    botName: "Seonghoon",
    prefix: "!",
    stickerPack: "Seonghoon",
    sudo: null, // Open this file in Katabump to add your number
    ownerName: "Seonghoon-User"
};`);
}

// Create lib/index.js (The engine that handles "Command")
if (!fs.existsSync('./lib/index.js')) {
    fs.writeFileSync('./lib/index.js', `
import config from '../config.js';
export const commands = [];
export function Command(obj, handler) {
    obj.function = handler;
    commands.push(obj);
    return obj;
}
export async function Handler(conn, mek) {
    if (!mek.message) return;
    const body = mek.message.conversation || mek.message.extendedTextMessage?.text || "";
    if (!body.startsWith(config.prefix)) return;
    
    const command = body.slice(config.prefix.length).trim().split(' ')[0].toLowerCase();
    const args = body.trim().split(/ +/).slice(1);
    const text = args.join(' ');
    
    const cmd = commands.find(c => c.pattern === command || (c.alias && c.alias.includes(command)));
    if (cmd) {
        const dest = mek.key.remoteJid;
        const isPrivate = !dest.endsWith('@g.us');
        const reply = (txt) => conn.sendMessage(dest, { text: txt }, { quoted: mek });
        
        // Exact Vinsmoke Signature
        await cmd.function(conn, dest, isPrivate, { key: mek.key, text }, { reply, text, args });
    }
}`);
}

// --- 2. THE BOT RUNNER ---
import config from './config.js';
import { Handler } from './lib/index.js';

async function startSeonghoon() {
    const { state, saveCreds } = await useMultiFileAuthState('session');
    const { version } = await fetchLatestBaileysVersion();

    const conn = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: true,
        logger: pino({ level: 'silent' }),
        browser: [config.botName, "Chrome", "1.0.0"]
    });

    conn.ev.on('creds.update', saveCreds);

    // Dynamic Plugin Loader
    const loadPlugins = async () => {
        const files = fs.readdirSync('./plugins').filter(f => f.endsWith('.js'));
        for (const file of files) {
            await import('./plugins/' + file + '?v=' + Date.now());
        }
        console.log("✅ Plugins Loaded: " + files.join(', '));
    };

    conn.ev.on('connection.update', async (update) => {
        if (update.connection === 'open') {
            console.log(\`🚀 \${config.botName} is online with prefix \${config.prefix}\`);
            await loadPlugins();
        }
    });

    conn.ev.on('messages.upsert', async (m) => {
        await Handler(conn, m.messages[0]);
    });
}

startSeonghoon();
