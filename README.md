# AI Minecraft Agent
An autonomous Minecraft bot that uses an LLM to understand goals and interact with the game. 

## How it works 
The bot follows a simple loop: 
1. Observe the world around it 
2. Send the current state and goal to the LLM 
3. Decide what to do next 
4. Execute the action in Minecraft 
5. Repeat until the goal is completed 

## Features 
- Natural language goals 
- Autonomous planning 
- LLM tool calling 
- Minecraft interaction through Mineflayer 
- Short-term memory of recent actions 

## Tech stack 
- PaperMC 
- Mineflayer 
- LM Studio 
- Mineflayer Pathfinder 
- Mineflayer CollectBlock 

## Setup 
1. Clone the repository 
2. Install dependencies with `npm install` 
3. Start the PaperMC server 
4. Start LM Studio with a local model 
5. Run the bot with `node index.js` 

## Commands 
- `goal <goal>` - Give the bot a task 
- `observe` - Show the bot's current state 
- `come` - Have the bot walk to you 
- `mine <block>` - Tell the bot to mine a block ## Status This project is still a work in progress. The goal is to gradually make the agent better at planning and completing more complicated tasks on its own.