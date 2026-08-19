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
    bot.chat("My sensors are online! I can see the world.");
});

// =====================================================================
// PERCEPTION / STATE EXTRACTION
// =====================================================================

function observeEnvironment() {
    const health = Math.round(bot.health);
    const food = Math.round(bot.food);
    const pos = bot.entity.position;
    const position = `x: ${Math.round(pos.x)}, y: ${Math.round(pos.y)}, z: ${Math.round(pos.z)}`;

    const inventoryItems = bot.inventory.items();
    let inventory = {};
    if (inventoryItems.length === 0) {
        inventory = "empty";
    } else {
        for (const item of inventoryItems) {
            inventory[item.name] = (inventory[item.name] || 0) + item.count;
        }
    }

    const radius = 8;
    const nearbyBlocks = new Set();
    const ignoreBlocks = ['air', 'cave_air', 'water', 'bedrock', 'tall_grass', 'short_grass'];

    for (let x = -radius; x <= radius; x++) {
        for (let y = -radius; y <= radius; y++) {
            for (let z = -radius; z <= radius; z++) {
                const block = bot.blockAt(pos.offset(x, y, z));
                if (block && !ignoreBlocks.includes(block.name)) {
                    nearbyBlocks.add(block.name);
                }
            }
        }
    }

    return {
        vitals: { health: `${health}/20`, food: `${food}/20` },
        position: position,
        inventory: inventory,
        nearby_blocks: Array.from(nearbyBlocks)
    };
}

// Test the observe function on spawn
bot.once('spawn', () => {
    setTimeout(() => {
        const state = observeEnvironment();
        console.log('\n=== WORLD STATE ===');
        console.log(JSON.stringify(state, null, 2));
        console.log('==================\n');
    }, 2000);
});

bot.on('error', (err) => console.error('[Error]', err));
bot.on('end', () => console.log('[System] Bot disconnected.'));

console.log('[DEBUG] Bot created. Waiting to spawn...');
