require('dotenv').config();
const mineflayer = require('mineflayer');
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');
const collectBlock = require('mineflayer-collectblock').plugin;
const OpenAI = require('openai');

console.log('[DEBUG] Starting bot...');
console.log('[DEBUG] Using LM Studio local server at http://localhost:1234');

// CONFIGURATION - LM Studio Local Server

// Initialize LM Studio client (OpenAI-compatible)
const local = new OpenAI({
    apiKey: 'not-needed',
    baseURL: 'http://localhost:1234/v1',
});

// Define the Tools (Action Space) for the LLM
const mineflayerTools = [
    {
        type: "function",
        function: {
            name: "gatherBlock",
            description: "Mines a specific block nearby. Use this to get resources.",
            parameters: {
                type: "object",
                properties: {
                    blockName: { 
                        type: "string", 
                        description: "The strict Minecraft block name (e.g., 'oak_log', 'dirt', 'sand')." 
                    },
                    reasoning: { 
                        type: "string", 
                        description: "A short sentence explaining to the user why you are mining this." 
                    }
                },
                required: ["blockName", "reasoning"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "moveToPlayer",
            description: "Walks to the specified player.",
            parameters: {
                type: "object",
                properties: {
                    playerName: { 
                        type: "string", 
                        description: "The name of the player to walk to." 
                    },
                    reasoning: { 
                        type: "string", 
                        description: "A short sentence explaining why you are walking to them." 
                    }
                },
                required: ["playerName", "reasoning"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "finishTask",
            description: "Call this when the goal has been completely achieved.",
            parameters: {
                type: "object",
                properties: {
                    reasoning: { 
                        type: "string", 
                        description: "Explain how you achieved the goal." 
                    }
                },
                required: ["reasoning"]
            }
        }
    }
];

let memoryBuffer = [];

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
    bot.chat("My AI brain is online! Tell me 'goal <something>' and I'll try to achieve it!");
    
    const mcData = require('minecraft-data')(bot.version);
    const defaultMove = new Movements(bot, mcData);
    defaultMove.allowFreeClear = false;
    bot.pathfinder.setMovements(defaultMove);
});

// PERCEPTION

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

// LLM Execution

async function executeAgentStep(goal) {
    const state = observeEnvironment();
    const playerName = Object.keys(bot.players).filter(p => p !== bot.username)[0] || 'Player';
    
    const systemPrompt = `
You are an autonomous Minecraft agent.

YOUR ULTIMATE GOAL: "${goal}"

=== CURRENT WORLD STATE ===
${JSON.stringify(state, null, 2)}

=== YOUR RECENT ACTIONS ===
${JSON.stringify(memoryBuffer, null, 2)}

=== INSTRUCTIONS ===
1. Look at your inventory. See what you have collected.
2. Look at your position.
3. Decide the single most logical NEXT action.
4. You MUST choose one of: gatherBlock, moveToPlayer, or finishTask.

IMPORTANT: The player's name is "${playerName}". Use this exact name for moveToPlayer.

Now, decide your next action.`;

    try {
        console.log(`[Agent] Thinking...`);
        
        const response = await local.chat.completions.create({
            model: "local-model",
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: `Goal: ${goal}` }
            ],
            tools: mineflayerTools,
            tool_choice: "auto",
            temperature: 0.3,
        });

        const message = response.choices[0].message;
        
        if (!message.tool_calls || message.tool_calls.length === 0) {
            bot.chat("I got confused. Let me rethink.");
            return "RETRY";
        }

        const toolCall = message.tool_calls[0];
        const actionName = toolCall.function.name;
        const args = JSON.parse(toolCall.function.arguments);

        if (args.reasoning) {
            bot.chat(args.reasoning);
        }
        console.log(`[LLM Decided] ${actionName} with args:`, args);

        if (actionName === "finishTask") {
            const checkState = observeEnvironment();
            const inventoryItems = checkState.inventory;
            const isEmpty = inventoryItems === "empty" || Object.keys(inventoryItems).length === 0;
            
            const needsItems = goal.toLowerCase().includes('gather') || 
                              goal.toLowerCase().includes('mine') ||
                              goal.toLowerCase().includes('get');
            
            if (needsItems && isEmpty) {
                bot.chat("⚠️ My inventory is empty! I need to gather first.");
                return "RETRY";
            }
            
            bot.chat("✅ Task complete!");
            return "DONE";
        }

        let actionResult = "";
        if (actionName === "gatherBlock") {
            actionResult = await gatherBlock(args.blockName);
        } 
        else if (actionName === "moveToPlayer") {
            actionResult = await moveToPlayer(args.playerName);
        }

        console.log(`[Physical Result] ${actionResult}`);

        memoryBuffer.push({
            attempted_action: actionName,
            arguments: args,
            result: actionResult
        });
        
        if (memoryBuffer.length > 3) memoryBuffer.shift();

        return actionResult;

    } catch (error) {
        console.error("LLM Error:", error);
        return "ERROR";
    }
}

// =====================================================================
// CHAT HANDLER WITH AUTONOMOUS LOOP
// =====================================================================

let isWorking = false;

bot.on('chat', async (username, message) => {
    if (username === bot.username) return;

    // Observe command
    if (message === 'observe') {
        const state = observeEnvironment();
        console.log("\n=== CURRENT WORLD STATE ===");
        console.log(JSON.stringify(state, null, 2));
        console.log("===========================\n");
        bot.chat("State logged to terminal.");
        return;
    }

    // AI Goal Command
    if (message.startsWith('goal ')) {
        if (isWorking) {
            bot.chat("I'm busy with another task!");
            return;
        }

        const goal = message.replace('goal ', '');
        bot.chat(`Starting: "${goal}"`);
        
        isWorking = true;
        memoryBuffer = [];
        
        let stepCount = 0;
        const maxSteps = 10;
        let status = "IN_PROGRESS";

        while (stepCount < maxSteps && status !== "DONE") {
            stepCount++;
            console.log(`\n=== AUTONOMOUS LOOP ${stepCount}/${maxSteps} ===`);
            
            status = await executeAgentStep(goal);

            if (status === "DONE") {
                bot.chat("Task complete!");
                break;
            }

            await new Promise(resolve => setTimeout(resolve, 500));
        }

        if (status !== "DONE") {
            bot.chat(`I reached the ${maxSteps} step limit.`);
        }
        
        isWorking = false;
        return;
    }

    // Manual commands (for testing without AI)
    if (message === 'come') {
        const result = await moveToPlayer(username);
        console.log(`[Action Result] ${result}`);
        bot.chat(result);
        return;
    }
    
    if (message.startsWith('mine ')) {
        const blockName = message.split(' ')[1];
        const result = await gatherBlock(blockName);
        console.log(`[Action Result] ${result}`);
        bot.chat(result);
        return;
    }
});

bot.on('error', (err) => console.error('[Error]', err));
bot.on('end', () => console.log('[System] Bot disconnected.'));

console.log('[DEBUG] Bot initialization complete. Waiting for spawn...');