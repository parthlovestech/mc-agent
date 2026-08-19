# AI Minecraft Agent

An autonomous Minecraft bot that understands natural language goals and executes them in-game using a local LLM (LM Studio).

## What It Does

- Understand natural language commands like "goal mine 1 stone" or "goal gather 2 dirt"
- Uses a React loop (Observe -> Think -> Act -> Remember) to complete tasks
- Runs completely offline using LM Studio
- Explains its reasoning in chat while working

## Tech Stack

- Minecraft Server: PaperMC 1.20.4
- Bot Framework: Mineflayer (Node.js)
- AI Model: Llama 3.2 3B Instruct (via LM Studio)
- Navigation: mineflayer-pathfinder
- Block Collection: mineflayer-collectblock

## Features

- Perception system (health, position, inventory, nearby blocks)
- Movement to players
- Block mining with pathfinding
- Autonomous goal execution
- Natural language understanding
- Memory buffer for recent actions
- Multi-step task planning

## Quick Start

1. Start LM Studio

```
lms load llama-3.2-3b-instruct
lms server start
```

2. Start PaperMC Server

```
java -Xmx2G -jar paper-1.20.4-499.jar
```

3. Start the Bot

```
node index.js
```

## Chat Commands

| Command | What It Does |
|---------|--------------|
| goal mine 1 stone | Mines 1 stone and stops |
| goal gather 2 sand | Gathers 2 sand and stops |
| observe | Lists what blocks it sees |
| mine dirt | Manual mine command |
| come | Manual walk command |

## How It Works

1. Observe: Bot scans its environment (health, position, inventory, nearby blocks)
2. Think: LLM decides the next action based on the goal and current state
3. Act: Bot executes the action (mine, move, or finish)
4. Remember: Bot keeps a short memory of recent actions to avoid loops

## Project Structure

```
mc-agent/
├── index.js          # Main bot code
├── .env              # Environment variables
├── package.json      # Dependencies
└── README.md         # This file
```

## Requirements

- Node.js 18+
- Mac with 16GB RAM (or Windows/Linux with similar specs)
- LM Studio installed
- PaperMC server running

## License

MIT

Built with Node.js, Mineflayer, and LM Studio
