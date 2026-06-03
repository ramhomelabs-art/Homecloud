# NexaDisk API Documentation

## Base URL
```
http://localhost:5000/api
```

## Authentication

All endpoints except `/login` and `/share/:token` require authentication via JWT token.

**Header Format:**
```
Authorization: Bearer <token>
```

---

## Authentication Endpoints

### POST /api/login
Login to get JWT token.

**Request Body:**
```json
{
  "username": "admin",
  "password": "admin"
}
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "username": "admin"
}
```

**Rate Limit:** 5 requests per 15 minutes

---

### POST /api/change-password
Change user password.

**Request Body:**
```json
{
  "oldPassword": "current_password",
  "newPassword": "new_password"
}
```

**Response:**
```json
{
  "message": "Password changed successfully"
}
```

---

## File Operations

### GET /api/files/list
List files in a directory.

**Query Parameters:**
- `path` (required): Directory path
- `agentId` (optional): Agent ID for remote files

**Response:**
```json
{
  "files": [
    {
      "name": "document.pdf",
      "path": "/path/to/document.pdf",
      "size": 1024000,
      "isDirectory": false,
      "modified": "2024-01-01T12:00:00Z"
    }
  ]
}
```

---

### POST /api/files/create/folder
Create a new folder.

**Request Body:**
```json
{
  "parentPath": "/path/to/parent",
  "folderName": "new_folder",
  "agentId": null
}
```

**Response:**
```json
{
  "message": "Folder created successfully"
}
```

---

### POST /api/files/rename
Rename a file or folder.

**Request Body:**
```json
{
  "oldPath": "/path/to/old_name",
  "newPath": "/path/to/new_name",
  "agentId": null
}
```

---

### POST /api/files/move
Move files or folders.

**Request Body:**
```json
{
  "sourcePath": "/source/path",
  "destPath": "/destination/path",
  "agentId": null
}
```

---

### POST /api/files/copy
Copy files or folders.

**Request Body:**
```json
{
  "sourcePath": "/source/path",
  "destPath": "/destination/path",
  "agentId": null
}
```

---

### POST /api/files/delete
Delete a file or folder.

**Request Body:**
```json
{
  "path": "/path/to/delete",
  "agentId": null
}
```

---

### GET /api/files/download
Download a file.

**Query Parameters:**
- `path` (required): File path
- `agentId` (optional): Agent ID for remote files

**Response:** File download stream

---

### POST /api/files/upload
Upload files.

**Content-Type:** `multipart/form-data`

**Form Data:**
- `files`: File(s) to upload
- `path`: Destination path
- `agentId`: (optional) Agent ID

---

## Devices

### GET /api/devices
List available drives/devices.

**Response:**
```json
{
  "devices": [
    {
      "name": "C:",
      "path": "C:\\",
      "type": "local",
      "size": 500000000000,
      "free": 100000000000
    }
  ]
}
```

---

## Shares

### GET /api/shares
List all shares.

**Response:**
```json
{
  "shares": [
    {
      "id": 1,
      "token": "abc123",
      "path": "/shared/file.pdf",
      "expires_at": "2024-12-31T23:59:59Z",
      "created_at": "2024-01-01T00:00:00Z"
    }
  ]
}
```

---

### POST /api/shares/create
Create a new share.

**Request Body:**
```json
{
  "path": "/path/to/share",
  "password": "optional_password",
  "expiresIn": 86400,
  "agentId": null
}
```

**Response:**
```json
{
  "token": "abc123def456",
  "url": "http://localhost:5000/share/abc123def456"
}
```

---

### DELETE /api/shares/:id
Delete a share.

**Response:**
```json
{
  "message": "Share deleted"
}
```

---

### POST /api/share/access
Access a shared file (no auth required).

**Request Body:**
```json
{
  "token": "abc123def456",
  "password": "optional_password"
}
```

---

## Agents

### GET /api/agents
List all agents.

**Response:**
```json
{
  "agents": {
    "agent-1": {
      "id": "agent-1",
      "name": "Remote Server",
      "url": "http://192.168.1.100:5001",
      "status": "approved"
    }
  }
}
```

---

### POST /api/agents/register
Register a new agent.

**Request Body:**
```json
{
  "name": "Remote Server",
  "url": "http://192.168.1.100:5001"
}
```

---

### POST /api/agents/approve
Approve a pending agent.

**Request Body:**
```json
{
  "agentId": "agent-1"
}
```

---

### POST /api/agents/disconnect
Disconnect an agent.

**Request Body:**
```json
{
  "agentId": "agent-1"
}
```

---

## Network Shares

### GET /api/network-shares
List mounted network shares.

---

### POST /api/network-shares/mount
Mount a network share.

**Request Body:**
```json
{
  "name": "Network Drive",
  "path": "\\\\server\\share",
  "username": "user",
  "password": "pass"
}
```

---

### DELETE /api/network-shares/:id
Unmount a network share.

---

## Activities

### GET /api/activities
Get activity log.

**Response:**
```json
{
  "activities": [
    {
      "type": "file_upload",
      "description": "Uploaded file.pdf",
      "timestamp": "2024-01-01T12:00:00Z"
    }
  ]
}
```

---

## Rate Limits

- **General API:** 100 requests per 15 minutes
- **Authentication:** 5 requests per 15 minutes

---

## Error Responses

All errors follow this format:

```json
{
  "status": "error",
  "message": "Error description"
}
```

**Common Status Codes:**
- `200` - Success
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `429` - Too Many Requests
- `500` - Internal Server Error
