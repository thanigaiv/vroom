/**
 * HTML template generator for browser-based image preview.
 *
 * Uses base64 data URLs to embed images directly in HTML, avoiding
 * file:// protocol CORS restrictions and ensuring reliable browser display.
 */

/**
 * Generates HTML page with embedded image using base64 data URL.
 *
 * @param imageBuffer - PNG image buffer to display
 * @returns Complete HTML document string with embedded image
 *
 * @example
 * const html = generatePreviewHTML(pngBuffer);
 * await writeFile('preview.html', html, 'utf8');
 */
export function generatePreviewHTML(imageBuffer: Buffer): string {
  // Convert buffer to base64 string
  const base64 = imageBuffer.toString('base64');

  // Construct data URL (avoids file:// protocol CORS issues)
  const dataUrl = `data:image/png;base64,${base64}`;

  // Return complete HTML document
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Zoom Background Preview</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      background-color: #1a1a1a;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      padding: 20px;
    }

    img {
      max-width: 90vw;
      max-height: 90vh;
      object-fit: contain;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
      border-radius: 4px;
    }
  </style>
</head>
<body>
  <img src="${dataUrl}" alt="Generated Background" />
</body>
</html>`;
}
