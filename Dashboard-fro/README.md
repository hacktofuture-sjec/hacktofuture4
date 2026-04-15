# MicroChat - Real-Time Chat with Self-Healing Platform

A modern real-time chat application built on microservices architecture, integrated with an AI-driven self-healing cloud platform for autonomous system monitoring and recovery.

## Features

### Real-Time Chat
- Instant messaging with WebSocket support
- Presence indicators (online/offline status)
- Live typing indicators
- Message edit and delete functionality
- Direct messages and group conversations

### Self-Healing Platform
- Real-time system health monitoring
- Autonomous anomaly detection
- Automatic remediation triggers
- Root cause analysis
- Service dependency mapping
- Incident timeline and history

### Microservices Architecture
- **Authentication Service** - User registration and login
- **Messaging Service** - Message handling and storage
- **Presence Service** - User online/offline tracking
- **Conversation Service** - Conversation management
- **Monitoring Service** - System health and metrics

### Chaos Engineering
- CPU spike injection
- Memory leak simulation
- Service crash testing
- Real-time recovery visualization

## Tech Stack

- **Frontend**: Next.js 16 + React 19 + TypeScript
- **UI Framework**: shadcn/ui with Tailwind CSS 4.2
- **Real-time**: Socket.io for WebSocket communication
- **Charts**: Recharts for data visualization
- **Icons**: Lucide React
- **Design**: Glassmorphism dark mode aesthetic

## Project Structure

```
/app
  ├── (auth)                 # Authentication pages
  ├── (protected)            # Protected routes (requires login)
  │   ├── chat               # Chat interface
  │   ├── dashboard          # Monitoring dashboard
  │   ├── services           # Services status page
  │   └── settings           # User settings
  ├── api                    # API routes
  └── page.tsx              # Homepage

/components
  ├── Chat                   # Chat components
  ├── Dashboard              # Dashboard components
  └── Layout                 # Layout components

/hooks
  ├── useAuth                # Authentication state
  ├── useChat                # Chat state management
  └── useMonitoring          # Monitoring state

/styles
  └── globals.css            # Global styles & theme
```

## Getting Started

### Prerequisites
- Node.js 18+
- pnpm (or npm/yarn)

### Installation

1. Clone the repository
2. Install dependencies:
```bash
pnpm install
```

3. Run the development server:
```bash
pnpm dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

### Demo Credentials

- **Email**: demo@microchat.app
- **Password**: demo123

## Features Walkthrough

### Homepage
- Project overview and feature highlights
- Call-to-action for chat and dashboard
- Architecture overview

### Authentication
- User registration and login
- Form validation
- Persistent sessions

### Chat Interface
- Real-time message exchange
- Conversation list with unread counts
- User presence indicators
- Typing status display
- Message actions (edit, delete)

### Monitoring Dashboard
- System health status
- Service metrics and uptime
- Active incident alerts
- Auto-remediation triggers
- Resource usage charts

### Services Page
- Individual service status cards
- Service dependency visualization
- Performance metrics
- Chaos injection controls

### Settings
- User profile management
- Security settings
- Notification preferences
- Account options

## Data Models

### User
- id, username, email, avatar, status, createdAt

### Conversation
- id, name, type (dm/group), participants, lastMessage, unreadCount

### Message
- id, conversationId, userId, content, timestamp, edited, deletedAt

### Service
- id, name, status, uptime, errorRate, latency, metrics, dependencies

### Incident
- id, serviceId, type, severity, description, rootCause, remediationAction, status

## API Endpoints

### Health Check
- `GET /api/health` - System health status

### Authentication (Future)
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`

### Messaging (Future)
- `POST /api/messages/send`
- `GET /api/messages/:conversationId`
- `DELETE /api/messages/:messageId`

### Monitoring (Future)
- `GET /api/monitoring/health`
- `GET /api/monitoring/metrics`
- `GET /api/monitoring/incidents`

## Theme & Design

The application uses a premium dark glassmorphism design with:
- Deep navy/black backgrounds
- Soft blue and purple accents
- Glass-effect cards with blur
- Smooth transitions and animations
- Responsive mobile-first layout

Color palette:
- **Primary**: Bright blue accent (`oklch(0.5 0.15 250)`)
- **Accent**: Purple accent (`oklch(0.55 0.18 280)`)
- **Background**: Deep navy (`oklch(0.08 0 0)`)
- **Text**: Light gray (`oklch(0.95 0 0)`)

## Performance Optimizations

- Client-side state management with React hooks
- Optimistic UI updates
- Message virtualization ready
- Lazy-loaded components
- CSS-in-JS with Tailwind
- Next.js Image optimization

## Future Enhancements

- Real database integration (PostgreSQL/MongoDB)
- Persistent WebSocket connections
- Message search and filtering
- File uploads and attachments
- User authentication with JWT
- Email notifications
- Dark/Light theme toggle
- Multi-language support

## Contributing

This is a demonstration project. Feel free to fork and extend!

## License

MIT

## Support

For issues and questions, please open an issue in the repository.

---

Built with Next.js 16, React 19, and Tailwind CSS. Designed for modern distributed systems.
