# SDBot - Discord Stable Diffusion Bot

SDBot is a Discord bot that allows users to generate images using Stable Diffusion directly within Discord. It supports multiple API servers, manages user permissions, and handles request queues efficiently.

## Features

- Generate images using Stable Diffusion with customizable parameters
- Support for multiple Stable Diffusion API servers
- Role-based permission system
- Request queue management
- Automatic server selection based on checkpoint availability
- Error handling and logging

## Prerequisites

- Node.js (v14 or higher)
- npm (v6 or higher)
- Discord Bot Token
- Automatic1111 Stable Diffusion Web UI (running with `--api` flag)
- One or more servers running Automatic1111 Stable Diffusion Web UI

## Installation

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/sdbot.git
   cd sdbot
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Create a `.env` file in the root directory with the following content:
   ```
   DISCORD_TOKEN=your_discord_bot_token
   CLIENT_ID=your_discord_client_id
   BOT_OWNER_ID=your_discord_user_id
   ERROR_LOG_CHANNEL_ID=your_error_log_channel_id
   ```

4. Configure your Stable Diffusion API servers in `src/config/apiServers.ts`. Make sure each server is running Automatic1111 with the `--api` flag.

## API Server Configuration

Edit the `src/config/apiServers.ts` file to include your Automatic1111 server(s). Here's an example configuration:

```typescript
const apiServers: APIServer[] = [
    {
        name: "Local Server",
        url: "http://localhost:7860",
        checkpoints: ["v1-5-pruned-emaonly", "sd-v1-4"],
        loras: ["lora1", "lora2"],
    },
    {
        name: "Remote Server",
        url: "http://192.168.1.100:7860",
        checkpoints: ["sd-v1-5", "anything-v3.0"],
        loras: ["lora3", "lora4"],
    },
];

export default apiServers;
```

Make sure to replace the URLs, checkpoints, and loras with your actual server configurations.

## Usage

1. Build the project:
   ```
   npm run build
   ```

2. Start the bot:
   ```
   npm start
   ```

3. Use the `/generate` command in Discord to generate images.

## Commands

- `/generate`: Generate an image using Stable Diffusion
- `/setrolepermissions`: Set permission level for a role (Admin only)

## Development

- Run the bot in development mode:
  ```
  npm run dev
  ```

- Run linter:
  ```
  npm run lint
  ```

- Run formatter:
  ```
  npm run format
  ```

## Setting Up Automatic1111

1. Install Automatic1111 Stable Diffusion Web UI by following the instructions in their [GitHub repository](https://github.com/AUTOMATIC1111/stable-diffusion-webui).

2. Launch Automatic1111 with the `--api` flag to enable the API. For example:
   ```
   python launch.py --api
   ```

3. Make note of the URL and port where Automatic1111 is running (e.g., `http://127.0.0.1:7860`).

4. Update the `src/config/apiServers.ts` file in this project with the correct URL(s) for your Automatic1111 instance(s).

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the Creative Commons Attribution-ShareAlike 4.0 International License. To view a copy of this license, visit http://creativecommons.org/licenses/by-sa/4.0/ or send a letter to Creative Commons, PO Box 1866, Mountain View, CA 94042, USA.