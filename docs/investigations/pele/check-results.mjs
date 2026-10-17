// Assert the observed replacement blockers; this is not a product or security test.
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
const report = JSON.parse(await readFile(process.argv[2], 'utf8'))
assert.equal(report.blocked.length, 0, 'Every browser must complete')
assert.equal(report.environment.mermaid, '11.16.1')
assert.equal(report.environment.pele, '1.6.0')
const families = ['flowchart', 'sequence', 'class', 'state', 'er', 'gantt', 'git', 'pie', 'mindmap', 'timeline', 'journey', 'quadrant', 'xy', 'requirement', 'sankey', 'architecture', 'c4', 'block', 'kanban', 'packet', 'radar', 'treemap', 'info']
for (const engine of ['chromium', 'webkit']) {
  const rows = report.results.filter(row => row.engine === engine)
  assert.equal(rows.length, 140, `${engine}: complete fixture matrix`)
  for (const family of families) {
    const matches = rows.filter(row => row.fixture === family)
    assert.equal(matches.length, 4)
    for (const row of matches) {
      assert.equal(row.mermaid.status, 'rendered', `${engine} ${family}: baseline`)
      assert.equal(row.pele.status, 'rendered', `${engine} ${family}: candidate`)
      assert.ok(row.pele.bounds.width > 0 && row.pele.bounds.height > 0)
    }
  }
  for (const mode of ['light', 'dark']) for (const width of [720, 320]) {
    const row = name => rows.find(r => r.fixture === name && r.mode === mode && r.width === width)
    assert.equal(row('html-label').mermaid.sub, 1)
    assert.equal(row('html-label').mermaid.sup, 1)
    assert.equal(row('html-label').pele.sub, 0)
    assert.equal(row('html-label').pele.sup, 0)
    assert.equal(row('theme-directive').mermaid.fill, 'rgb(255, 0, 0)')
    assert.notEqual(row('theme-directive').pele.fill, 'rgb(255, 0, 0)')
    assert.equal(row('theme-directive').mermaid.font, 'monospace')
    assert.equal(row('theme-directive').pele.font, 'sans-serif')
    for (const renderer of ['mermaid', 'pele']) {
      assert.equal(row('accessibility')[renderer].title, 'A useful title')
      assert.equal(row('accessibility')[renderer].desc, 'A useful description')
      assert.equal(row('malformed')[renderer].status, 'failed')
      const untrusted = row('untrusted-label')[renderer]
      assert.equal(untrusted.status, 'rendered')
      assert.equal(untrusted.scripts, 0)
      assert.deepEqual(untrusted.eventAttributes, [])
      assert.equal(untrusted.injected, 0)
      assert.ok(!row('unsafe-link')[renderer].anchors.some(href => /^javascript:/i.test(href ?? '')))
    }
  }
  console.log(`ok ${engine}: 23 family smoke fixtures, label/theme blockers, accessibility metadata, malformed source and limited injection probes`)
}
