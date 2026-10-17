// Offline browser comparison. Supply already-installed, reviewed package roots.
import { createServer } from 'node:http'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { resolve, sep, extname } from 'node:path'
import { pathToFileURL } from 'node:url'

const [mermaidRoot, peleRoot, playwrightEntry, output] = process.argv.slice(2)
if (!output) throw new Error('Usage: node compare.mjs <mermaid-root> <pele-root> <playwright-entry> <output-dir>')
const { chromium, webkit } = await import(pathToFileURL(resolve(playwrightEntry)))
const fixtures = JSON.parse(await readFile(new URL('./fixtures.json', import.meta.url)))
fixtures.push({ name: 'large', source: 'flowchart TD\n' + Array.from({ length: 150 }, (_, i) => `n${i}[Node ${i}] --> n${i + 1}`).join('\n') })
fixtures.push({ name: 'source-limit', source: 'flowchart TD\n A[Start]\n%%' + 'x'.repeat(50001) })
await mkdir(output, { recursive: true })
const roots = { mermaid: resolve(mermaidRoot), pele: resolve(peleRoot) }
const manifest = async root => JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'))
const report = { environment: { node: process.version, platform: process.platform, mermaid: (await manifest(roots.mermaid)).version, pele: (await manifest(roots.pele)).version, playwright: (await manifest(resolve(playwrightEntry, '..'))).version, browsers: {} }, results: [], blocked: [] }
const server = createServer(async (req, res) => {
  try {
    if (req.url === '/') {
      res.setHeader('Content-Type', 'text/html')
      return res.end('<!doctype html><meta charset="utf-8"><style>body{margin:0;font:16px sans-serif}.frame{padding:16px;box-sizing:border-box}h2{font:16px sans-serif}</style><div id="stage"></div>')
    }
    const [kind, ...parts] = decodeURIComponent(new URL(req.url, 'http://localhost').pathname).slice(1).split('/')
    if (!Object.hasOwn(roots, kind)) throw new Error('Unknown root')
    const path = resolve(roots[kind], ...parts)
    if (!path.startsWith(roots[kind] + sep)) throw new Error('Outside package')
    res.setHeader('Content-Type', extname(path) === '.js' || extname(path) === '.mjs' ? 'text/javascript' : 'application/octet-stream')
    res.end(await readFile(path))
  } catch { res.statusCode = 404; res.end() }
})
await new Promise(done => server.listen(0, '127.0.0.1', done))
const origin = `http://127.0.0.1:${server.address().port}`

try {
  for (const [engine, type] of Object.entries({ chromium, webkit })) {
    let browser
    try { browser = await type.launch({ headless: true }) }
    catch (error) { report.blocked.push({ engine, error: error.message }); console.error(`BLOCKED ${engine}: ${error.message}`); continue }
    let context = { stage: 'new-page' }
    try {
      report.environment.browsers[engine] = browser.version()
      const page = await browser.newPage({ viewport: { width: 760, height: 900 } })
      const network = []
      let activeRenderer = 'setup'
      await page.route('**/*', route => {
        if (route.request().url().startsWith(origin + '/')) return route.continue()
        network.push({ renderer: activeRenderer, url: route.request().url() })
        return route.abort()
      })
      await page.goto(origin)
      await page.exposeFunction('rendererStarting', renderer => { activeRenderer = renderer })
      context = { stage: 'import' }
      await page.evaluate(async () => {
        window.mermaid = (await import('/mermaid/dist/mermaid.esm.min.mjs')).default
        window.pele = await import('/pele/dist/pele.js')
      })
      for (const fixture of fixtures) {
        for (const mode of ['light', 'dark']) {
          for (const width of [720, 320]) {
            network.length = 0
            context = { stage: 'render', fixture: fixture.name, mode, width }
            const result = await page.evaluate(async ({ fixture, mode, width }) => {
              const stage = document.querySelector('#stage')
              stage.replaceChildren()
              stage.style.width = `${width}px`
              stage.style.background = mode === 'dark' ? '#171717' : '#ffffff'
              stage.style.color = mode === 'dark' ? '#eeeeee' : '#171717'
              stage.style.cssText += mode === 'dark'
                ? ';--pele-bg:#171717;--pele-fg:#eeeeee;--pele-muted:#aaa;--pele-line:#aaa;--pele-surface:#262626;--pele-border:#777;--pele-accent:#80bfff;'
                : ';--pele-bg:#fff;--pele-fg:#171717;--pele-muted:#666;--pele-line:#444;--pele-surface:#eee;--pele-border:#888;--pele-accent:#2455cc;'
              window.__injected = { mermaid: 0, pele: 0 }
              const outcomes = {}
              for (const renderer of ['mermaid', 'pele']) {
                await window.rendererStarting(renderer)
                const frame = document.createElement('div')
                frame.className = 'frame'
                stage.append(frame)
                const heading = document.createElement('h2')
                heading.textContent = `${renderer} · ${fixture.name} · ${mode} · ${width}px`
                frame.append(heading)
                const drawing = document.createElement('div')
                frame.append(drawing)
                const source = fixture.source.replaceAll('window.__injected=1', `window.__injected.${renderer}=1`)
                const start = performance.now()
                try {
                  let svg
                  if (renderer === 'mermaid') {
                    window.mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', suppressErrorRendering: true, theme: mode === 'dark' ? 'dark' : 'default', themeVariables: mode === 'dark' ? { edgeLabelBackground: '#1f1f1f' } : undefined })
                    svg = (await window.mermaid.render('fixture_' + Math.random().toString(36).slice(2), source)).svg
                  } else {
                    // Candidate keeps safe URL links; disable network images explicitly.
                    svg = window.pele.render(source, { idPrefix: 'candidate', images: false, autoDirection: false }).svg
                  }
                  const ms = performance.now() - start
                  drawing.innerHTML = svg
                  await new Promise(done => setTimeout(done, 50))
                  const plain = drawing.cloneNode(true)
                  plain.querySelectorAll('style').forEach(el => el.remove())
                  const root = drawing.querySelector('svg')
                  const title = root.querySelector('title')?.textContent
                  const desc = root.querySelector('desc')?.textContent
                  const bounds = root.getBoundingClientRect()
                  const box = root.viewBox.baseVal
                  const text = drawing.querySelector('text, .nodeLabel')
                  const rect = drawing.querySelector('.node rect,rect')
                  const attributes = [...drawing.querySelectorAll('*')].flatMap(el => [...el.attributes].filter(a => /^on/i.test(a.name)).map(a => `${el.tagName}:${a.name}`))
                  outcomes[renderer] = { status: 'rendered', ms: Math.round(ms * 100) / 100, bytes: svg.length, text: plain.textContent.slice(0, 300), title, desc, role: root.getAttribute('role'), ariaLabelledby: root.getAttribute('aria-labelledby'), viewBox: [box.x, box.y, box.width, box.height], bounds: { width: bounds.width, height: bounds.height }, font: text && getComputedStyle(text).fontFamily, fill: rect && getComputedStyle(rect).fill, html: drawing.querySelectorAll('foreignObject').length, sub: drawing.querySelectorAll('sub').length, sup: drawing.querySelectorAll('sup').length, anchors: [...drawing.querySelectorAll('a')].map(a => a.getAttribute('href') ?? a.getAttribute('xlink:href')), scripts: drawing.querySelectorAll('script').length, eventAttributes: attributes, images: [...drawing.querySelectorAll('image,img')].map(el => el.getAttribute('src') ?? el.getAttribute('href')), injected: window.__injected[renderer] }
                } catch (error) {
                  outcomes[renderer] = { status: 'failed', name: error.name, code: error.code, message: error.message.slice(0, 600) }
                  drawing.textContent = error.message
                }
              }
              return outcomes
            }, { fixture, mode, width })
            await page.waitForTimeout(30)
            report.results.push({ engine, fixture: fixture.name, mode, width, ...result, network: [...network] })
            context = { stage: 'screenshot', fixture: fixture.name, mode, width }
            if (mode === 'light' && width === 720 && ['flowchart', 'html-label', 'theme-directive', 'subgraph', 'accessibility'].includes(fixture.name)) {
              await page.locator('#stage').screenshot({ path: resolve(output, `${engine}-${fixture.name}.png`) })
            }
          }
        }
        console.log(`${engine} ${fixture.name}: ${report.results.at(-1).mermaid.status} / ${report.results.at(-1).pele.status}`)
      }
      await page.close()
    } catch (error) {
      report.blocked.push({ engine, ...context, error: error.message })
      console.error(`BLOCKED ${engine} ${JSON.stringify(context)}: ${error.message}`)
    } finally { await browser.close() }
  }
} finally {
  await new Promise(done => server.close(done))
  await writeFile(resolve(output, 'results.json'), JSON.stringify(report, null, 2) + '\n')
}
if (report.blocked.length) process.exitCode = 2
