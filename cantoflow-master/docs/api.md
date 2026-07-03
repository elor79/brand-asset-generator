# CantoFlow API Documentation

Complete API reference for CantoFlow backend.

## Base URL

```
Development: http://localhost:4000
Production: https://your-domain.com
```

## Authentication

Most endpoints require a Canto access token passed in the Authorization header:

```
Authorization: Bearer YOUR_ACCESS_TOKEN
```

---

## Canto API Endpoints

### POST /api/canto/auth

Authenticate with Canto and get access token.

**Request Body:**
```json
{
  "domain": "your-company.canto.com",
  "appId": "your_app_id",
  "appSecret": "your_app_secret",
  "authorizationCode": "optional_auth_code",
  "redirectUri": "optional_redirect_uri"
}
```

**Response:**
```json
{
  "access_token": "...",
  "refresh_token": "...",
  "expires_in": 3600,
  "token_type": "Bearer"
}
```

### POST /api/canto/refresh

Refresh access token.

**Request Body:**
```json
{
  "appId": "your_app_id",
  "appSecret": "your_app_secret",
  "refreshToken": "your_refresh_token"
}
```

### GET /api/canto/search

Search for assets in Canto.

**Query Parameters:**
- `domain` (required): Your Canto domain
- `query` (required): Search query
- `limit` (optional): Results per page (default: 50)
- `start` (optional): Offset (default: 0)
- `scheme` (optional): Asset scheme
- `sortBy` (optional): Sort field
- `sortDirection` (optional): 'ascending' or 'descending'

**Headers:**
```
Authorization: Bearer YOUR_ACCESS_TOKEN
```

**Response:**
```json
{
  "results": [
    {
      "id": "asset_id",
      "name": "asset_name",
      "url": {
        "preview": "...",
        "download": "..."
      },
      "metadata": {...}
    }
  ],
  "found": 100,
  "returned": 50
}
```

### GET /api/canto/asset/:assetId

Get asset details.

**Query Parameters:**
- `domain` (required)
- `scheme` (required)

**Headers:**
```
Authorization: Bearer YOUR_ACCESS_TOKEN
```

### GET /api/canto/asset/:assetId/download

Get asset download URL.

**Query Parameters:**
- `domain` (required)
- `scheme` (required)
- `version` (optional): 'original', 'preview', 'thumbnail'

### GET /api/canto/albums

List albums.

**Query Parameters:**
- `domain` (required)
- `limit` (optional)
- `start` (optional)

### GET /api/canto/albums/:albumId/assets

Get assets from an album.

---

## Template Endpoints

### POST /api/templates/upload-idml

Upload and parse IDML file.

**Content-Type:** `multipart/form-data`

**Form Data:**
- `idml` (file, required): The IDML file
- `name` (string, optional): Template name
- `description` (string, optional): Template description
- `category` (string, optional): Template category

**Response:**
```json
{
  "templateId": "...",
  "name": "Template Name",
  "parsed": true,
  "elementsCount": 15,
  "metadata": {
    "pages": 1,
    "fonts": ["Arial", "Helvetica"],
    "colors": []
  }
}
```

### GET /api/templates

List all templates.

**Query Parameters:**
- `category` (optional): Filter by category
- `source` (optional): Filter by source ('idml' or 'native')
- `limit` (optional): Results per page (default: 50)
- `skip` (optional): Offset (default: 0)

**Response:**
```json
{
  "templates": [...],
  "total": 100,
  "limit": 50,
  "skip": 0
}
```

### GET /api/templates/:id

Get template by ID.

**Response:**
```json
{
  "_id": "...",
  "name": "Template Name",
  "description": "...",
  "category": "social-media",
  "source": "idml",
  "format": {
    "width": 1080,
    "height": 1080,
    "unit": "px",
    "dpi": 72,
    "colorMode": "RGB"
  },
  "elements": [...],
  "metadata": {...},
  "createdAt": "...",
  "updatedAt": "..."
}
```

### POST /api/templates

Create template from scratch.

**Request Body:**
```json
{
  "name": "My Template",
  "description": "Description",
  "category": "social-media",
  "format": {
    "width": 1080,
    "height": 1080,
    "unit": "px"
  },
  "elements": [
    {
      "id": "text-1",
      "type": "text",
      "locked": false,
      "editable": true,
      "position": { "x": 100, "y": 100 },
      "size": { "width": 300, "height": 100 },
      "style": {
        "fontSize": 24,
        "fontFamily": "Arial"
      },
      "content": "Hello World"
    }
  ]
}
```

### PUT /api/templates/:id

Update template.

**Request Body:** Same as POST, all fields optional

### DELETE /api/templates/:id

Delete template.

**Response:**
```json
{
  "success": true,
  "message": "Template deleted"
}
```

---

## Render Endpoints

### POST /api/render/pdf

Render template to PDF.

**Request Body:**
```json
{
  "templateId": "template_id",
  "customData": {
    "elements": [
      {
        "id": "text-1",
        "content": "Updated text"
      }
    ]
  },
  "options": {
    "dpi": 300
  }
}
```

**Response:** PDF file (application/pdf)

### POST /api/render/image

Render template to image.

**Request Body:**
```json
{
  "templateId": "template_id",
  "customData": {...},
  "options": {
    "format": "png",
    "preset": "instagram-post",
    "quality": 90,
    "scale": 2,
    "dpi": 150
  }
}
```

**Available Presets:**
- `instagram-post` (1080x1080)
- `instagram-story` (1080x1920)
- `facebook-post` (1200x630)
- `twitter-post` (1200x675)
- `linkedin-post` (1200x627)

**Response:** Image file (image/png or image/jpeg)

### POST /api/render/preview

Generate preview image (optimized, smaller).

**Request Body:**
```json
{
  "templateId": "template_id",
  "customData": {...}
}
```

**Response:** PNG image

### GET /api/render/social-presets

Get available social media presets.

**Response:**
```json
{
  "instagram-post": {
    "width": 1080,
    "height": 1080,
    "name": "Instagram Post (Square)"
  },
  ...
}
```

---

## Health Check

### GET /health

Check API health.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-11-07T...",
  "uptime": 12345.67
}
```

---

## Error Responses

All errors follow this format:

```json
{
  "error": "Error Name",
  "message": "Detailed error message"
}
```

**Common Status Codes:**
- `400` - Bad Request (missing/invalid parameters)
- `401` - Unauthorized (missing/invalid auth token)
- `404` - Not Found (resource doesn't exist)
- `429` - Too Many Requests (rate limit exceeded)
- `500` - Internal Server Error

---

## Rate Limiting

Default rate limit: 100 requests per 15 minutes per IP address.

When rate limited, you'll receive:
```json
{
  "error": "Too Many Requests",
  "message": "Too many requests from this IP, please try again later."
}
```

---

## Examples

### Upload IDML via cURL

```bash
curl -X POST http://localhost:4000/api/templates/upload-idml \
  -F "idml=@template.idml" \
  -F "name=Holiday Campaign" \
  -F "category=social-media"
```

### Render to Instagram Post

```bash
curl -X POST http://localhost:4000/api/render/image \
  -H "Content-Type: application/json" \
  -d '{
    "templateId": "673c8a7b9e...",
    "customData": {
      "elements": [
        {
          "id": "headline",
          "content": "Black Friday Sale!"
        }
      ]
    },
    "options": {
      "format": "png",
      "preset": "instagram-post"
    }
  }' \
  --output result.png
```

### Search Canto Assets

```bash
curl -X GET "http://localhost:4000/api/canto/search?domain=your-company.canto.com&query=logo&limit=10" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```
