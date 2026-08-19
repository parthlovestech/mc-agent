require('dotenv').config();
const mineflayer = require('mineflayer');
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');
const collectBlock = require('mineflayer-collectblock').plugin;

console.log('[DEBUG] Starting bot...');

const botConfig = {
    host: 'localhost',
    port: 25565,
    username: 'AgentLLM',
    version: '1.20.4'
};

const bot = mineflayer.createBot(botConfig);

bot.loadPlugin(pathfinder);
bot.loadPlugin(collectBlock);

bot.once('spawn', () => {
    console.log(`[System] ${bot.username} has spawned!`);
    bot.chat("My movement systems are online! Tell me 'come' or 'mine <block>'.");
    
    const mcData = require('minecraft-data')(bot.version);
    const defaultMove = new Movements(bot, mcData);
    defaultMove.allowFreeClear = false;
    bot.pathfinder.setMovements(defaultMove);
});

// =====================================================================
// PERCEPTION
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

// ACTIONS

async function moveToPlayer(playerName) {
    let target = null;
    const exactMatch = bot.players[playerName];
    if (exactMatch) {
        target = exactMatch.entity;
    } else {
        for (const name in bot.players) {
            if (name.toLowerCase() === playerName.toLowerCase()) {
                target = bot.players[name].entity;
                break;
            }
        }
    }
    
    if (!target) {
        return `Error: Cannot see player ${playerName}.`;
    }

    bot.chat(`Pathfinding to ${playerName}...`);
    const p = target.position;
    
    try {
        await bot.pathfinder.goto(new goals.GoalNear(p.x, p.y, p.z, 1));
        return `Successfully reached ${playerName}.`;
    } catch (err) {
        return `Failed to reach target: ${err.message}`;
    }
}

async function gatherBlock(blockName) {
    const mcData = require('minecraft-data')(bot.version);
    const blockType = mcData.blocksByName[blockName];
    
    if (!blockType) return `Error: Unknown block name '${blockName}'.`;

    const block = bot.findBlock({
        matching: blockType.id,
        maxDistance: 32
    });

    if (!block) return `Error: No ${blockName} found nearby.`;

    bot.chat(`Attempting to gather ${blockName}...`);
    try {
        await bot.collectBlock.collect(block);
        return `Successfully gathered 1 ${blockName}.`;
    } catch (err) {
        return `Failed to gather ${blockName}: ${err.message}`;
    }
}

// Chat commands
bot.on('chat', async (username, message) => {
    if (username === bot.username) return;

    if (message === 'come') {
        const result = await moveToPlayer(username);
        console.log(`[Action Result] ${result}`);
        bot.chat(result);
    }
    
    if (message.startsWith('mine ')) {
        const blockName = message.split(' ')[1];
        const result = await gatherBlock(blockName);
        console.log(`[Action Result] ${result}`);
        bot.chat(result);
    }
});

bot.on('error', (err) => console.error('[Error]', err));
bot.on('end', () => console.log('[System] Bot disconnected.'));

console.log('[DEBUG] Bot created. Waiting to spawn...');
