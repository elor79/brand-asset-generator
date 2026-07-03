# CantoFlow Setup Guide

Complete guide to setting up CantoFlow for development and production.

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** 20+ and npm/pnpm
- **MongoDB** 6.0+ (local or MongoDB Atlas)
- **PostgreSQL** 15+ (optional, for future user management)
- **Redis** 7+ (optional but recommended for caching)
- **Canto DAM Account** with API access

### Recommended Tools

- **Docker** (for easy database setup)
- **VS Code** or your preferred IDE
- **Postman** or similar for API testing

## Quick Start with Docker

If you have Docker installed, you can quickly set up the databases:

```bash
# Start MongoDB and Redis
docker-compose up -d

# This will start:
# - MongoDB on port 27017
# - Redis on port 6379
```

## Manual Setup

### 1. Clone and Install

```bash
cd cantoflow

# Install frontend dependencies
cd frontend
npm install

# Install backend dependencies
cd ../backend
npm install
```

### 2. Configure Environment Variables

#### Backend Configuration

```bash
cd backend
cp .env.example .env
```

Edit `backend/.env`:

```env
# Server
PORT=4000
NODE_ENV=development

# Database
MONGODB_URI=mongodb://localhost:27017/cantoflow
# If using MongoDB Atlas:
# MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/cantoflow

# Redis (optional but recommended)
REDIS_URL=redis://localhost:6379

# Canto API
CANTO_API_BASE=https://api.canto.com
CANTO_OAUTH_URL=https://oauth.canto.global/oauth/api/oauth2

# Storage
STORAGE_TYPE=local
UPLOAD_PATH=./uploads

# Security
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production-12345
API_RATE_LIMIT=100

# Frontend URL (for CORS)
FRONTEND_URL=http://localhost:3000
```

#### Frontend Configuration

```bash
cd ../frontend
cp .env.local.example .env.local
```

Edit `frontend/.env.local`:

```env
# Canto API Configuration
NEXT_PUBLIC_CANTO_DOMAIN=your-company.canto.com
NEXT_PUBLIC_CANTO_APP_ID=your_app_id_here
NEXT_PUBLIC_CANTO_APP_SECRET=your_app_secret_here
NEXT_PUBLIC_CANTO_OAUTH_URL=https://oauth.canto.global/oauth/api/oauth2

# Backend API
NEXT_PUBLIC_API_URL=http://localhost:4000

# Application
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 3. Get Canto API Credentials

1. Log in to your Canto account
2. Navigate to **Settings > Configuration Options > API Keys**
3. Click **Create API Key**
4. Note your **App ID** and **App Secret**
5. Update your `.env.local` file with these credentials

### 4. Create Required Directories

```bash
# Create upload directory for backend
mkdir -p backend/uploads/{templates,renders,thumbnails}
```

### 5. Start the Development Servers

#### Terminal 1 - Backend

```bash
cd backend
npm run dev
```

You should see:

```
✓ MongoDB connected
✓ Redis connected (or warning if not available)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  CantoFlow API Server
  Environment: development
  Port: 4000
  URL: http://localhost:4000
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

#### Terminal 2 - Frontend

```bash
cd frontend
npm run dev
```

You should see:

```
  ▲ Next.js 15.0.0
  - Local:        http://localhost:3000
  - Network:      http://192.168.1.x:3000

 ✓ Ready in 2.3s
```

### 6. Verify Installation

1. Open http://localhost:3000 in your browser
2. You should see the CantoFlow homepage
3. Check backend health: http://localhost:4000/health

## Database Setup

### MongoDB

If running MongoDB locally:

```bash
# Start MongoDB
mongod --dbpath /path/to/data/db

# Or with Docker
docker run -d -p 27017:27017 --name mongodb mongo:7
```

If using MongoDB Atlas:
1. Create a free cluster at https://www.mongodb.com/cloud/atlas
2. Create a database user
3. Whitelist your IP address
4. Get your connection string and update `MONGODB_URI`

### Redis (Optional)

Redis is used for caching and background jobs:

```bash
# Start Redis
redis-server

# Or with Docker
docker run -d -p 6379:6379 --name redis redis:7-alpine
```

**Note:** The application will work without Redis, but caching will be disabled.

## Testing the Setup

### Test Backend API

```bash
# Health check
curl http://localhost:4000/health

# Should return:
# {"status":"ok","timestamp":"...","uptime":...}
```

### Test IDML Upload

1. Create a simple InDesign template
2. Run the marking script (see `docs/idml-workflow.md`)
3. Export as IDML
4. Upload via the API:

```bash
curl -X POST http://localhost:4000/api/templates/upload-idml \
  -F "idml=@/path/to/your/template.idml" \
  -F "name=My First Template" \
  -F "category=social-media"
```

### Test Canto Integration

You'll need to authenticate first. The frontend handles OAuth flow automatically.

## Troubleshooting

### Port Already in Use

If port 3000 or 4000 is already in use:

```bash
# Frontend - use different port
PORT=3001 npm run dev

# Backend - change in .env
PORT=4001
```

### MongoDB Connection Failed

- Check if MongoDB is running: `mongod --version`
- Verify connection string in `.env`
- Check firewall/network settings

### Canto Authentication Issues

- Verify App ID and App Secret are correct
- Check that your Canto domain is correct
- Ensure API access is enabled in your Canto account

### Module Not Found Errors

```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

### Puppeteer Issues (Rendering)

If PDF/image rendering fails:

```bash
# Install Chromium dependencies (Linux)
sudo apt-get install -y \
  libnss3 libatk1.0-0 libatk-bridge2.0-0 \
  libcups2 libxkbcommon0 libxcomposite1 \
  libxdamage1 libxrandr2 libgbm1 libasound2

# macOS should work out of the box
```

## Production Deployment

See `docs/deployment.md` for production setup instructions.

## Next Steps

- Read `docs/idml-workflow.md` to learn about preparing templates
- Explore the API documentation at `docs/api.md`
- Check out example templates in `examples/`

## Support

For issues or questions:
- Check the troubleshooting section above
- Review existing GitHub issues
- Create a new issue with detailed error information
