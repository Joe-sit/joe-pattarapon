import https from 'https'
import http from 'http'
import { createWriteStream, existsSync } from 'fs'
import { load } from 'opentype.js'

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = createWriteStream(dest)
    const mod = url.startsWith('https') ? https : http
    mod.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        file.close()
        return download(res.headers.location, dest).then(resolve).catch(reject)
      }
      res.pipe(file)
      file.on('finish', () => { file.close(); resolve() })
    }).on('error', err => { file.close(); reject(err) })
  })
}

async function getFontUrl() {
  return new Promise((resolve, reject) => {
    const cssUrl = 'https://fonts.googleapis.com/css2?family=Mitr:wght@500&subset=thai'
    https.get(cssUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    }, res => {
      let data = ''
      res.on('data', chunk => { data += chunk })
      res.on('end', () => {
        // Find all TTF/WOFF2 URLs
        const matches = [...data.matchAll(/src:\s*url\(([^)]+)\)/g)]
        // Find one that likely covers Thai (look for thai subset comment or just take last url)
        console.log('CSS response snippet:', data.substring(0, 500))
        const urls = matches.map(m => m[1].replace(/['"]/g, ''))
        console.log('Found font URLs:', urls)
        if (urls.length > 0) resolve(urls[urls.length - 1])
        else reject(new Error('No font URL found in CSS'))
      })
    }).on('error', reject)
  })
}

async function main() {
  const fontPath = 'scripts/Mitr-Medium.ttf'

  if (!existsSync(fontPath)) {
    console.log('Fetching font URL from Google Fonts...')
    let fontUrl
    try {
      fontUrl = await getFontUrl()
      console.log('Downloading font from:', fontUrl)
      await download(fontUrl, fontPath)
      console.log('Font downloaded.')
    } catch (e) {
      console.error('Auto-download failed:', e.message)
      console.log('Trying direct TTF fallback...')
      // Direct Google Fonts static URL for Mitr Medium
      fontUrl = 'https://fonts.gstatic.com/s/mitr/v11/pxiLypw5ucZFyTsyMJj_b1s.woff2'
      await download(fontUrl, fontPath.replace('.ttf', '.woff2'))
      console.log('Downloaded woff2 — note: opentype.js may need TTF/OTF. Try downloading Mitr-Medium.ttf manually.')
      return
    }
  }

  console.log('Loading font...')
  const font = await load(fontPath)

  const text = 'สวัสดี'
  const fontSize = 155
  const viewWidth = 900
  const y = 175

  // Measure total width
  let totalWidth = 0
  for (const char of [...text]) {
    const glyph = font.charToGlyph(char)
    if (glyph) totalWidth += (glyph.advanceWidth || 0) * fontSize / font.unitsPerEm
  }

  let x = (viewWidth - totalWidth) / 2
  const pathElements = []

  for (const char of [...text]) {
    const glyph = font.charToGlyph(char)
    if (!glyph) { console.warn('No glyph for:', char); continue }
    const path = font.getPath(char, x, y, fontSize)
    const svgPath = path.toSVG(2)
    pathElements.push(svgPath)
    x += (glyph.advanceWidth || 0) * fontSize / font.unitsPerEm
  }

  console.log('\n=== SVG PATHS ===')
  console.log(pathElements.join('\n'))
  console.log('=== END ===')
  console.log(`\nTotal chars: ${pathElements.length}`)
}

main().catch(console.error)
