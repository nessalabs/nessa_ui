# Builds index.html from template.html and the agent list. Icons are rendered
# at load by icons3d.js into each card's empty .icon slot.
agents = [
    ('claude', 'Claude', 'Careful pair programmer'),
    ('clawd', 'Claude Code', 'Claude in your terminal', 'claude'),
    ('codex', 'Codex', 'Cloud and CLI coding agent'),
    ('openclaw', 'OpenClaw', 'Personal assistant agent, runs on your machine'),
    ('hermes', 'Hermes', 'Fast general-purpose agent'),
    ('pi', 'Pi', 'Minimal coding agent in your terminal'),
    ('kimi', 'Kimi Code', 'Long-context coding agent'),
    ('deepseek', 'DeepSeek', 'Open-weight reasoning model'),
    ('local', 'Local AI', 'Runs fully on your device'),
]
agents = [a if len(a) == 4 else (*a, a[0]) for a in agents]  # (id, name, meta, tone)
check = '<span class="check" aria-hidden="true"><svg width="12" height="12" viewBox="0 0 12 12"><path d="M2.5 6.2 5 8.6l4.5-5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></span>'
cards = '\n'.join(f'''<button class="agent-card tone-{tone}" aria-pressed="{'true' if i == 'pi' else 'false'}" data-agent="{i}">
  <span class="planet"></span><span class="orbit"></span><span class="halo"></span><span class="glare"></span>
  <span class="label">{n}</span><span class="meta">{m}</span>{check}
  <span class="icon" aria-hidden="true"></span>
</button>''' for i, n, m, tone in agents)
chips = '\n'.join(f'<button class="chip" data-show="{i}" aria-pressed="false">{n}</button>' for i, n, _, _ in agents)
out = open('template.html').read().replace('%CARDS%', cards).replace('%CHIPS%', chips)
open('index.html', 'w').write(out)
print(len(out))
