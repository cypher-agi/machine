# Machina

A modern web application for provisioning and managing compute infrastructure across multiple cloud providers using Terraform as the deployment engine.

![Machina](https://img.shields.io/badge/Machina-Infrastructure_Management-00ffff?style=for-the-badge)

## Features

- **Multi-Provider Support**: Deploy to DigitalOcean, AWS, and more
- **Terraform-Powered**: All infrastructure changes tracked as Terraform runs
- **Real-time Updates**: Live deployment logs via Server-Sent Events
- **Machine Inspector**: Deep insights into machine status, networking, and services
- **Bootstrap Profiles**: Pre-configured setups for services like "The Grid"
- **Firewall Management**: View provider and host-level firewall rules
- **Service Monitoring**: Track systemd service status when agent is installed

## Architecture

```
machine/
├── client/          # React + TypeScript frontend (Vite)
├── server/          # Node.js + Express backend
├── shared/          # Shared TypeScript types
└── terraform/       # Terraform modules (future)
```

## Prerequisites

- Node.js 18+
- npm 9+
- (Optional) Terraform CLI for actual deployments

## Quick Start

1. **Install dependencies**

```bash
npm install
```

2. **Start development servers**

```bash
npm run dev
```

This starts both:
- Frontend at http://localhost:5173
- Backend API at http://localhost:3001

3. **Open in browser**

Navigate to http://localhost:5173

## Project Structure

### Frontend (`client/`)

```
src/
├── features/           # Feature-based modules
│   ├── machines/       # Machine list, cards, inspector
│   ├── providers/      # Provider account management
│   ├── deployments/    # Deployment history
│   ├── bootstrap/      # Bootstrap profiles
│   └── settings/       # App settings
├── layouts/            # App layout, sidebar
├── lib/                # API client, utilities
├── store/              # Zustand state management
└── index.css           # Tailwind styles
```

### Backend (`server/`)

```
src/
├── routes/             # Express route handlers
│   ├── machines.ts     # Machine CRUD, reboot, services
│   ├── providers.ts    # Provider accounts, options
│   ├── deployments.ts  # Deployment history, logs
│   ├── bootstrap.ts    # Bootstrap profiles
│   └── audit.ts        # Audit events
├── data/               # Mock data store
├── middleware/         # Error handling
└── index.ts            # Express app entry
```

### Shared Types (`shared/`)

TypeScript interfaces for:
- `Machine` - Compute instance model
- `Deployment` - Terraform operation tracking
- `ProviderAccount` - Stored credentials
- `BootstrapProfile` - Boot-time configuration
- `MachineNetworking` - Firewall rules and ports
- `MachineService` - Runtime service status

## API Endpoints

### Machines
- `GET /api/machines` - List machines with filtering
- `POST /api/machines` - Create new machine
- `GET /api/machines/:id` - Get single machine
- `POST /api/machines/:id/reboot` - Reboot machine
- `POST /api/machines/:id/destroy` - Destroy machine
- `GET /api/machines/:id/services` - Get machine services
- `POST /api/machines/:id/services/:name/restart` - Restart service
- `GET /api/machines/:id/networking` - Get firewall/ports

### Providers
- `GET /api/providers` - List supported providers
- `GET /api/providers/:type/options` - Get regions, sizes, images
- `GET /api/providers/accounts` - List provider accounts
- `POST /api/providers/:type/accounts` - Add provider account
- `POST /api/providers/accounts/:id/verify` - Verify credentials
- `DELETE /api/providers/accounts/:id` - Delete account

### Deployments
- `GET /api/deployments` - List deployments
- `GET /api/deployments/:id` - Get deployment details
- `GET /api/deployments/:id/logs?stream=true` - Stream logs (SSE)
- `POST /api/deployments/:id/cancel` - Cancel deployment

### Bootstrap
- `GET /api/bootstrap/profiles` - List profiles
- `POST /api/bootstrap/profiles` - Create profile
- `GET /api/bootstrap/firewall-profiles` - List firewall profiles

## Tech Stack

### Frontend
- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool
- **Tailwind CSS** - Styling
- **TanStack Query** - Data fetching
- **Zustand** - State management
- **Framer Motion** - Animations
- **Lucide React** - Icons

### Backend
- **Node.js** - Runtime
- **Express** - HTTP framework
- **TypeScript** - Type safety
- **Zod** - Validation
- **SSE** - Real-time log streaming

## Design System

The UI uses a dark, terminal-inspired theme with:

- **Background**: Deep navy (`#0a0e14`)
- **Surface**: Elevated dark (`#0d1117`)
- **Primary accent**: Neon cyan (`#00ffff`)
- **Success**: Neon green (`#00ff88`)
- **Warning**: Orange (`#ff9500`)
- **Error**: Red (`#ff3366`)
- **Font**: JetBrains Mono (code), DM Sans (UI)

## Production Deployment

### Option 1: Docker (Recommended)

```bash
# Set your public URL (required for agent heartbeats)
export PUBLIC_SERVER_URL=https://machina.yourdomain.com

# Build and run
docker compose up -d

# View logs
docker compose logs -f
```

### Option 2: Manual Deployment

```bash
# Install dependencies
npm ci

# Build all packages
npm run build

# Set environment variables
export NODE_ENV=production
export PUBLIC_SERVER_URL=https://machina.yourdomain.com
export PORT=3001

# Start server
node server/dist/index.js
```

### Option 3: PM2 (Process Manager)

```bash
# Install PM2
npm install -g pm2

# Build the project
npm run build

# Start with PM2
pm2 start server/dist/index.js --name machina-api

# Save PM2 config
pm2 save
pm2 startup
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PUBLIC_SERVER_URL` | Public URL for agent heartbeats | `http://localhost:3001` |
| `PORT` | Server port | `3001` |
| `CORS_ORIGIN` | Allowed CORS origin | `http://localhost:5173` |
| `NODE_ENV` | Environment mode | `development` |

### Nginx Reverse Proxy

```nginx
server {
    listen 80;
    server_name machina.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl;
    server_name machina.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/machina.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/machina.yourdomain.com/privkey.pem;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
        
        # SSE support
        proxy_buffering off;
        proxy_read_timeout 86400;
    }
}
```

## Security Considerations

- Credentials are encrypted with AES-256-GCM and stored in SQLite
- Encryption key persisted in `.data/.encryption_key`
- All actions logged to audit trail
- Rate limiting on dangerous operations
- CORS and CSRF protection
- Helmet security headers

## Roadmap

- [x] Terraform integration with DigitalOcean
- [x] Machine agent for heartbeat monitoring
- [x] SQLite persistence
- [ ] GCP and Hetzner provider support
- [ ] Cost tracking and analytics
- [ ] Multi-user RBAC
- [ ] Webhook notifications

## License

MIT



