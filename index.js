require('dotenv').config();
const mineflayer = require('mineflayer');

console.log('[DEBUG] Starting bot...');

const botConfig = {
    host: 'localhost',
    port: 25565,
    username: 'AgentLLM',
    version: '1.20.4'
};

const bot = mineflayer.createBot(botConfig);

bot.once('spawn', () => {
    console.log(`[System] ${bot.username} has spawned!`);
    bot.chat("Hello! I'm AgentLLM. I'm alive!");
});

bot.on('error', (err) => console.error('[Error]', err));
bot.on('end', () => console.log('[System] Bot disconnected.'));

console.log('[DEBUG] Bot created. Waiting to spawn...');
