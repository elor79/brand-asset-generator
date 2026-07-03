# IDML Workflow Guide

Complete guide for designers to create templates in InDesign and import them into CantoFlow.

## Overview

The IDML workflow allows professional designers to create templates in Adobe InDesign, mark which elements should be editable by end users, and import them into CantoFlow for web-based customization.

## Workflow Steps

### 1. Design Your Template in InDesign

Create your template as you normally would in Adobe InDesign:

- Set up your document size (matching your intended output)
- Create your design with text, images, and graphics
- Apply character and paragraph styles
- Set up colors and swatches

**Tips:**
- Use consistent naming for styles
- Organize elements on separate layers if needed
- Keep editable elements simple (avoid complex effects)

### 2. Mark Editable Fields

Use the provided ExtendScript to mark which elements should be editable:

#### Installation

1. Copy `mark-editable-fields.jsx` to your InDesign Scripts folder:
   - **macOS**: `~/Library/Preferences/Adobe InDesign/Version X.X/en_US/Scripts/Scripts Panel/`
   - **Windows**: `C:\Users\[Username]\AppData\Roaming\Adobe\InDesign\Version X.X\en_US\Scripts\Scripts Panel\`

2. Restart InDesign or reload the Scripts panel

#### Usage

1. Open your template in InDesign
2. Go to **Window > Utilities > Scripts**
3. Double-click **mark-editable-fields.jsx**
4. Choose an operation:

   - **Mark Selected Elements**: Select frames first, then mark them
   - **Mark All Text Frames**: Automatically mark all text as editable
   - **Mark All Image Frames**: Automatically mark all images as editable
   - **Show Summary**: See what's currently marked
   - **Clear All Markings**: Remove all CantoFlow markings

#### Marking Individual Elements

1. Select one or more text frames or image frames
2. Run the script
3. Choose the field type:
   - **Editable Text**: Users can change the text content
   - **Editable Image**: Users can replace with Canto assets
   - **Locked**: Visible but not editable (brand elements)
4. Optionally give it a custom field name
5. Click OK

### 3. Export as IDML

1. Go to **File > Export**
2. Choose format: **InDesign Markup (IDML)**
3. Save the file
4. Your template is ready for upload!

### 4. Upload to CantoFlow

#### Via Web Interface

1. Go to CantoFlow dashboard
2. Click **New Template > Upload IDML**
3. Select your `.idml` file
4. Fill in template details:
   - Name
   - Description
   - Category (Social Media, Marketing, Events, etc.)
5. Click Upload

#### Via API

```bash
curl -X POST http://localhost:4000/api/templates/upload-idml \
  -F "idml=@/path/to/template.idml" \
  -F "name=Holiday Campaign Template" \
  -F "description=Social media template for holiday campaigns" \
  -F "category=social-media"
```

### 5. Test Your Template

1. Open the template in CantoFlow editor
2. Verify all editable fields work correctly
3. Test replacing images with Canto assets
4. Generate a test PDF/PNG export

## Best Practices

### For Text Fields

- **Use Text Frames** (not area text or path text)
- **Apply Paragraph Styles** for consistent formatting
- **Set Appropriate Sizing**: Allow enough space for text variations
- **Lock Font Styles**: Users change content, not formatting

### For Image Fields

- **Use Rectangle Frames**: Standard rectangular placeholders work best
- **Set Proper Aspect Ratios**: Match your expected image dimensions
- **Add Frame Fitting**: Set to "Fill Frame Proportionally" or "Fit Content to Frame"
- **Consider Image Requirements**: Document expected dimensions

### For Brand Compliance

- **Lock Brand Elements**: Company logos, brand colors, legal text
- **Lock Backgrounds**: Keep design structure intact
- **Lock Guides and Grids**: Prevent layout changes
- **Use Master Pages**: For consistent headers/footers

### Document Setup

```
Recommended Settings:
- Units: Pixels (for digital) or Millimeters (for print)
- Color Mode: RGB (digital) or CMYK (print)
- Resolution: 72 DPI (screen) or 300 DPI (print)
- Bleed: 3mm for print templates
```

### Social Media Templates

**Instagram Post (1:1)**
- Width: 1080 px
- Height: 1080 px
- DPI: 72

**Instagram Story (9:16)**
- Width: 1080 px
- Height: 1920 px
- DPI: 72

**Facebook Post**
- Width: 1200 px
- Height: 630 px
- DPI: 72

**LinkedIn Post**
- Width: 1200 px
- Height: 627 px
- DPI: 72

### Print Templates

**A4 Flyer**
- Width: 210 mm
- Height: 297 mm
- DPI: 300
- Bleed: 3 mm

**US Letter**
- Width: 8.5 in
- Height: 11 in
- DPI: 300
- Bleed: 0.125 in

## Limitations

Current IDML parser supports:

✅ **Supported:**
- Text frames with basic formatting
- Rectangle frames (images)
- Fill colors
- Stroke colors and weights
- Position and size
- Basic text styles (font, size, weight, align)

⚠️ **Limited Support:**
- Complex gradients (converted to solid colors)
- Drop shadows and effects (may be simplified)
- Advanced typography features

❌ **Not Yet Supported:**
- Path text
- Clipping paths
- Transparency blends
- Advanced blending modes
- Interactive elements

**Workaround:** For complex effects, rasterize those elements and lock them.

## Troubleshooting

### "IDML Parse Error"

**Cause:** Corrupted or incompatible IDML file

**Solution:**
1. Re-export from InDesign
2. Ensure InDesign is updated to latest version
3. Try simplifying the template

### Editable Fields Not Detected

**Cause:** Elements not properly marked

**Solution:**
1. Run the marking script again
2. Ensure you marked elements before exporting
3. Check the script summary shows marked elements

### Fonts Not Rendering Correctly

**Cause:** Font not available on server

**Solution:**
1. Use web-safe fonts when possible
2. Embed fonts in the template (future feature)
3. Specify fallback fonts

### Images Not Appearing

**Cause:** Linked images not embedded

**Solution:**
1. Embed all images in InDesign before export
2. Use **Links panel > Embed Link**
3. Or use vector graphics when possible

### Layout Different in Export

**Cause:** Unit conversion or DPI mismatch

**Solution:**
1. Use pixel units for digital templates
2. Set correct DPI in document setup
3. Test with a simple template first

## Advanced Tips

### Using Variables

You can prepare templates with placeholder text that the parser will recognize:

```
{{company_name}}
{{tagline}}
{{event_date}}
```

### Multi-Page Templates

- Each spread becomes a separate template
- Or export spreads individually
- Best for PDF-only templates

### Color Management

- Define color swatches in InDesign
- Name colors descriptively
- Consider RGB vs CMYK for your use case

### Template Versioning

- Keep InDesign source files (.indd)
- Version control your IDML exports
- Document changes in template description

## Example Templates

Check the `examples/idml-templates/` directory for:

- Social media post template
- Event flyer template
- Business card template
- Email header template

Each includes the source `.indd` file and exported `.idml` file.

## Next Steps

- Learn about the template editor at `docs/editor-guide.md`
- Explore export options at `docs/export-guide.md`
- See API documentation at `docs/api.md`
