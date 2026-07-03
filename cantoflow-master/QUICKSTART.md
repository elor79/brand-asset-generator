# CantoFlow - Quick Start Guide

Get up and running in 5 minutes!

## Prerequisites

- Node.js 20+
- MongoDB running locally or Docker
- Canto DAM account with API credentials

## 1. Install Dependencies

```bash
# Start from the cantoflow directory
cd cantoflow

# Install backend
cd backend
npm install

# Install frontend
cd ../frontend
npm install
```

## 2. Start Databases (Docker)

```bash
# From cantoflow root directory
docker-compose up -d

# This starts MongoDB and Redis
```

Or install MongoDB and Redis locally.

## 3. Configure Environment

### Backend

```bash
cd backend
cp .env.example .env
# Edit .env if needed (defaults work for local development)
```

### Frontend

```bash
cd frontend
cp .env.local.example .env.local
```

Edit `.env.local` and add your Canto credentials:

```env
NEXT_PUBLIC_CANTO_DOMAIN=your-company.canto.com
NEXT_PUBLIC_CANTO_APP_ID=your_app_id
NEXT_PUBLIC_CANTO_APP_SECRET=your_app_secret
```

Get these from: Canto Dashboard → Settings → API Keys

## 4. Start Development Servers

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

## 5. Open Your Browser

Visit: http://localhost:3000

You should see the CantoFlow homepage!

## Next Steps

### Try the IDML Workflow

1. Open Adobe InDesign
2. Install the marking script from `scripts/mark-editable-fields.jsx`
3. Create a simple template
4. Mark fields as editable
5. Export as IDML
6. Upload via the CantoFlow interface

### Test the API

```bash
# Health check
curl http://localhost:4000/health

# Upload a template
curl -X POST http://localhost:4000/api/templates/upload-idml \
  -F "idml=@your-template.idml" \
  -F "name=Test Template"
```

### Explore Documentation

- **Setup Guide**: `docs/setup.md`
- **IDML Workflow**: `docs/idml-workflow.md`
- **API Reference**: `docs/api.md`

## Troubleshooting

### "Cannot connect to MongoDB"
```bash
# Check if MongoDB is running
docker ps

# If not, start it
docker-compose up -d
```

### "Port 3000 already in use"
```bash
# Use a different port
PORT=3001 npm run dev
```

### "Canto authentication failed"
- Double-check your API credentials in `.env.local`
- Verify your Canto domain is correct
- Ensure API access is enabled in your Canto account

## Project Structure

```
cantoflow/
├── frontend/          # Next.js React app
├── backend/           # Express API server
├── scripts/           # InDesign ExtendScripts
└── docs/             # Documentation
```

## What's Included?

✅ Full IDML parser (InDesign template import)
✅ Canto DAM integration (OAuth 2.0)
✅ PDF & image export (Puppeteer + Sharp)
✅ Template management (MongoDB)
✅ Social media presets (Instagram, Facebook, etc.)
✅ InDesign marking script
✅ Comprehensive documentation

## Need Help?

- Check `docs/setup.md` for detailed setup
- Review `docs/api.md` for API documentation
- Open an issue on GitHub

Happy creating! 🎨
