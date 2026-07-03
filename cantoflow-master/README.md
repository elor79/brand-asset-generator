# CantoFlow

A modern template design and automation platform for Canto DAM with IDML (InDesign) support.

## Overview

CantoFlow enables teams to create branded content quickly by:
- Designing templates in Adobe InDesign and importing them as IDML
- Building templates directly in the web-based canvas editor
- Pulling assets from Canto DAM
- Exporting to PDF and social media formats (PNG, JPG)

### Key Features

- **IDML Import**: Design templates in InDesign, export as IDML, import into CantoFlow
- **Canto DAM Integration**: OAuth 2.0 integration with Canto for seamless asset management
- **Canvas Editor**: Web-based template editor with drag-and-drop functionality
- **Multi-Format Export**: PDF (print-ready), PNG/JPG for social media
- **Department-Specific Workflows**: Optimized for Social Media, Marketing, Events, and Corporate Communications
- **Brand Compliance**: Lock design elements while allowing controlled customization

## Architecture

```
cantoflow/
├── frontend/          # Next.js 14+ React application
│   ├── src/
│   │   ├── app/      # Next.js app router
│   │   ├── components/
│   │   ├── lib/      # Utilities, API clients
│   │   └── styles/
│   └── package.json
│
├── backend/           # Node.js Express API
│   ├── src/
│   │   ├── services/
│   │   │   ├── idml-parser/    # IDML processing
│   │   │   ├── canto/          # Canto API integration
│   │   │   ├── render/         # PDF/image generation
│   │   │   └── templates/      # Template management
│   │   ├── routes/
│   │   ├── middleware/
│   │   └── server.js
│   └── package.json
│
├── scripts/           # InDesign ExtendScripts
│   └── mark-editable-fields.jsx
│
└── docs/             # Documentation
    ├── setup.md
    ├── idml-workflow.md
    └── api.md
```

## Tech Stack

### Frontend
- **Framework**: Next.js 14+ (React 18+)
- **Canvas Editor**: Fabric.js
- **UI Components**: shadcn/ui + Tailwind CSS
- **State Management**: Zustand
- **API Client**: Axios

### Backend
- **Runtime**: Node.js 20+
- **Framework**: Express.js
- **Database**: MongoDB (templates), PostgreSQL (users/metadata)
- **Queue**: BullMQ (rendering jobs)
- **PDF Generation**: Puppeteer
- **Image Processing**: Sharp
- **IDML Processing**: JSZip, xml2js

### Infrastructure
- **Storage**: S3-compatible (AWS S3, Cloudflare R2)
- **Cache**: Redis
- **Deployment**: Vercel (frontend), Railway/Render (backend)

## Getting Started

### Prerequisites

- Node.js 20+ and npm/pnpm
- MongoDB (local or Atlas)
- PostgreSQL (local or hosted)
- Redis (local or hosted)
- Canto DAM account with API access

### Installation

1. **Clone and install dependencies:**

```bash
cd cantoflow

# Install frontend dependencies
cd frontend
npm install

# Install backend dependencies
cd ../backend
npm install
```

2. **Configure environment variables:**

```bash
# Backend .env
cp backend/.env.example backend/.env
# Edit backend/.env with your settings

# Frontend .env.local
cp frontend/.env.local.example frontend/.env.local
# Edit frontend/.env.local with your settings
```

3. **Start development servers:**

```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend
cd frontend
npm run dev
```

4. **Access the application:**
- Frontend: http://localhost:3000
- Backend API: http://localhost:4000

## IDML Workflow

### For Designers

1. Create your template in Adobe InDesign
2. Mark editable fields using the provided script (`scripts/mark-editable-fields.jsx`)
3. Export as IDML: `File > Export > InDesign Markup (IDML)`
4. Upload the IDML file to CantoFlow
5. Platform automatically parses and creates an editable template

### For End Users

1. Browse available templates
2. Select a template
3. Customize editable fields (text, images from Canto)
4. Preview in real-time
5. Export to desired format (PDF, PNG, JPG)

## API Documentation

See [docs/api.md](docs/api.md) for complete API documentation.

### Key Endpoints

- `POST /api/templates/upload-idml` - Upload IDML file
- `GET /api/templates` - List templates
- `POST /api/render/pdf` - Generate PDF
- `POST /api/render/image` - Generate social media image
- `GET /api/canto/assets` - Browse Canto assets
- `POST /api/canto/auth` - OAuth authentication

## Development Roadmap

### Phase 1 (MVP) - 8-10 weeks
- [x] Project setup
- [ ] Basic IDML parser
- [ ] Canto API integration
- [ ] Canvas editor (basic)
- [ ] PDF/PNG export
- [ ] Template library

### Phase 2 - 6-8 weeks
- [ ] Advanced IDML features (styles, gradients)
- [ ] Multi-page support
- [ ] Brand kit management
- [ ] Collaboration features
- [ ] Template marketplace

### Phase 3 - 6-8 weeks
- [ ] InDesign Server integration (Pro tier)
- [ ] Approval workflows
- [ ] Advanced analytics
- [ ] White-labeling
- [ ] Enterprise features

## License

MIT

## Support

For questions or issues, please open a GitHub issue or contact support.
