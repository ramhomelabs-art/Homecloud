# NexaDisk - Multi-Server File Explorer

A powerful file explorer application with multi-server management capabilities, built with React and Express.

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

## 🚀 Features

- **Multi-Server Management**: Connect and manage files across multiple servers via agents
- **File Operations**: Create, rename, move, copy, delete files and folders
- **File Sharing**: Share files with password protection and expiry dates
- **Network Shares**: Mount and access network drives
- **Real-time Updates**: Live activity tracking and agent status monitoring
- **Secure Authentication**: JWT-based authentication with bcrypt password hashing
- **File Upload/Download**: Support for large file transfers
- **Responsive UI**: Modern, animated interface built with React and Framer Motion

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v16 or higher)
- **npm** or **yarn**
- **SQLite3** (included with dependencies)

## 🔧 Installation

### 1. Clone the Repository

```bash
git clone <repository-url>
cd Explorer
```

### 2. Automated Installation (Recommended)

#### For Master Server (Master + Client + Agent)
On the machine that will host your main dashboard, run the root installer:

**Windows (Administrator):**
```powershell
powershell -ExecutionPolicy Bypass -File scripts/install.ps1
```

**Linux/macOS (Root):**
```bash
chmod +x scripts/install.sh
sudo ./scripts/install.sh
```

#### For Remote Nodes (Agent Only)
To connect other computers to your NexaDisk Hub, copy the `agent/` folder to them and run:

**Windows (Administrator):**
```powershell
powershell -ExecutionPolicy Bypass -File agent/scripts/install-agent.ps1
```

**Linux/macOS (Root):**
```bash
chmod +x agent/scripts/install-agent.sh
sudo ./agent/scripts/install-agent.sh
```

### 3. Manual Installation (Development)
If you prefer to install dependencies manually:

```bash
# Install root dependencies
npm install

# Install server dependencies
cd server
npm install
cd ..

# Install client dependencies
cd client
npm install
cd ..
```

### 3. Environment Configuration

Create a `.env` file in the root directory based on `.env.example`:

```bash
cp .env.example .env
```

Edit the `.env` file and configure the following variables:

```env
# Server Configuration
PORT=5000
NODE_ENV=development

# JWT Secret - CHANGE THIS!
# Generate a new secret with: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
JWT_SECRET=your-secure-secret-key-here

# Database Configuration
DB_PATH=./database.sqlite

# File Upload Configuration
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=104857600

# CORS Configuration
CORS_ORIGIN=http://localhost:5173
```

> **⚠️ IMPORTANT**: Always generate a new `JWT_SECRET` for production environments!

### 4. Generate a Secure JWT Secret

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Copy the output and paste it as your `JWT_SECRET` in the `.env` file.

## 🚀 Running the Application

### Development Mode

**Terminal 1 - Start the Backend:**
```bash
cd server
npm start
```

**Terminal 2 - Start the Frontend:**
```bash
cd client
npm run dev
```

The application will be available at:
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:5000

### Production Mode

```bash
# Build the frontend
cd client
npm run build

# Start the backend (serves the built frontend)
cd ../server
NODE_ENV=production npm start
```

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        NexaDisk Client                       │
│                    (React + Vite Frontend)                   │
└───────────────────────────┬─────────────────────────────────┘
                            │ HTTP/REST API
┌───────────────────────────▼─────────────────────────────────┐
│                     NexaDisk Server                          │
│                   (Express + SQLite)                         │
└───────────────────────────┬─────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
┌───────▼──────┐    ┌──────▼──────┐    ┌──────▼──────┐
│   Agent 1    │    │   Agent 2   │    │   Agent N   │
│ (Remote FS)  │    │ (Remote FS) │    │ (Remote FS) │
└──────────────┘    └─────────────┘    └─────────────┘
```

### Components

- **Client**: React-based frontend with file explorer UI
- **Server**: Express backend handling authentication, file operations, and agent management
- **Agents**: Remote servers that can be connected to manage files across different machines
- **Database**: SQLite database storing users, shares, and agent information

## 📁 Project Structure

```
Explorer/
├── scripts/                # Master installation scripts (Full System)
├── client/                 # React frontend
├── server/                 # Express backend
├── agent/                  # Remote agent
│   └── scripts/            # Remote node installation scripts (Agent Only)
├── .env                    # Environment variables (create from .env.example)
├── .env.example           # Environment template
├── .gitignore             # Git ignore rules
└── README.md              # This file
```

## 🔐 Default Credentials

The application creates a default admin account on first run:

- **Username**: `admin`
- **Password**: `admin`

> **⚠️ SECURITY**: Change the default password immediately after first login!

## 🔑 API Endpoints

### Authentication

- `POST /api/login` - User login
- `POST /api/change-password` - Change user password

### File Operations

- `GET /api/files/list` - List files in a directory
- `POST /api/files/create/folder` - Create a new folder
- `POST /api/files/rename` - Rename a file or folder
- `POST /api/files/move` - Move files or folders
- `POST /api/files/copy` - Copy files or folders
- `POST /api/files/delete` - Delete files or folders
- `GET /api/files/download` - Download a file
- `POST /api/files/upload` - Upload files

### Sharing

- `GET /api/shares` - List all shares
- `POST /api/shares/create` - Create a new share
- `DELETE /api/shares/:id` - Delete a share
- `GET /api/share/:token` - Access a shared file

### Agent Management

- `GET /api/agents` - List all agents
- `POST /api/agents/register` - Register a new agent
- `POST /api/agents/approve` - Approve an agent
- `POST /api/agents/disconnect` - Disconnect an agent

### Network Shares

- `GET /api/network-shares` - List network shares
- `POST /api/network-shares/mount` - Mount a network share
- `DELETE /api/network-shares/:id` - Unmount a network share

### System

- `GET /api/devices` - List available drives/devices
- `GET /api/activities` - Get activity log

## 🛠️ Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `5000` |
| `NODE_ENV` | Environment (development/production) | `development` |
| `JWT_SECRET` | Secret key for JWT tokens | **Required** |
| `DB_PATH` | SQLite database path | `./database.sqlite` |
| `UPLOAD_DIR` | Upload directory | `./uploads` |
| `MAX_FILE_SIZE` | Max upload size in bytes | `104857600` (100MB) |
| `CORS_ORIGIN` | Allowed CORS origin | `http://localhost:5173` |

### Security Headers

The server implements strict security headers:

- **Content Security Policy (CSP)**: Prevents XSS attacks
- **X-Frame-Options**: Prevents clickjacking
- **X-Content-Type-Options**: Prevents MIME sniffing
- **X-XSS-Protection**: Browser XSS protection
- **Referrer-Policy**: Controls referrer information

## 🧪 Testing

```bash
# Run server tests (when implemented)
cd server
npm test

# Run client tests (when implemented)
cd client
npm test
```

## 🐛 Troubleshooting

### Server won't start

1. Check if port 5000 is already in use
2. Verify `.env` file exists and `JWT_SECRET` is set
3. Ensure all dependencies are installed: `npm install`

### Database errors

1. Delete `server/database.sqlite` to recreate the database
2. Check file permissions on the database file

### Agent connection issues

1. Verify agent URL is accessible from the server
2. Check firewall settings
3. Ensure agent is running and approved

### File upload fails

1. Check `MAX_FILE_SIZE` in `.env`
2. Verify `uploads/` directory exists and is writable
3. Check available disk space

## 📝 Development

### Adding New Features

1. Create a feature branch: `git checkout -b feature/your-feature`
2. Make your changes
3. Test thoroughly
4. Submit a pull request

### Code Style

- Use ES6+ JavaScript features
- Follow existing code formatting
- Add comments for complex logic
- Keep functions small and focused

## 🔒 Security Best Practices

1. **Never commit `.env` files** - They contain sensitive information
2. **Use strong JWT secrets** - Generate with crypto.randomBytes(64)
3. **Change default passwords** - Immediately after installation
4. **Keep dependencies updated** - Run `npm audit` regularly
5. **Use HTTPS in production** - Never send credentials over HTTP
6. **Validate all inputs** - Never trust user input
7. **Implement rate limiting** - Protect against brute force attacks

## 📄 License

This project is licensed under the MIT License.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📧 Support

For issues and questions, please open an issue on the repository.

---

**Built with ❤️ using React and Express**
