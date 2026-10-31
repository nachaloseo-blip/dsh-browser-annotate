/**
 * Browser annotate — Client half.
 *
 * Renders one toolbar row under the composer. The row injects a picker overlay
 * into the page of the side-panel Browser tab and reports the annotations and
 * the page identity to the Host, where the agent's tools read them.
 */

/** Page-side overlay. Injected with executeJavaScript, idempotent per document. */
const INJECT_SCRIPT = String.raw`(function () {
  'use strict';
  if (window.__dshAnnotate && window.__dshAnnotate.version === 7) return 'exists';
  if (window.__dshAnnotate && typeof window.__dshAnnotate.destroy === 'function') {
    try { window.__dshAnnotate.destroy(); } catch (error) {}
  }

  var Z = 2147483000;
  var mode = false;
  var items = [];
  var cardOpen = false;
  var pendingElement = null;

  var root = document.createElement('div');
  root.setAttribute('data-dsh-annotate-root', '');
  root.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;z-index:' + Z + ';';
  var shadow = root.attachShadow({ mode: 'open' });

  var style = document.createElement('style');
  style.textContent = [
    ':host{all:initial}',
    '.box{position:fixed;box-sizing:border-box;border:2px solid #4c7dff;background:rgba(76,125,255,.14);border-radius:3px;pointer-events:none;display:none}',
    '.pin{position:fixed;min-width:18px;height:18px;padding:0 5px;border-radius:9px;background:#4c7dff;color:#fff;font:600 11px/18px system-ui,sans-serif;text-align:center;box-shadow:0 1px 4px rgba(0,0,0,.35);pointer-events:auto;cursor:pointer;display:none}',
    '.card{position:fixed;width:272px;background:#fff;color:#111;border-radius:10px;box-shadow:0 10px 34px rgba(0,0,0,.28);padding:10px;font:13px/1.35 system-ui,-apple-system,Segoe UI,sans-serif;pointer-events:auto;display:none}',
    '.card h4{margin:0 0 6px;font:600 12px/1.25 system-ui,sans-serif;color:#4c7dff;word-break:break-all}',
    '.card textarea{box-sizing:border-box;width:100%;min-height:58px;resize:vertical;border:1px solid #d5dae2;border-radius:6px;padding:6px;font:13px/1.35 inherit;color:#111;background:#fff}',
    '.card .row{display:flex;gap:6px;justify-content:flex-end;margin-top:8px}',
    '.card button{border:1px solid #d5dae2;background:#f5f7fa;color:#111;border-radius:6px;padding:4px 10px;font:12px system-ui,sans-serif;cursor:pointer}',
    '.card button.go{background:#4c7dff;border-color:#4c7dff;color:#fff}',
    '.bar{position:fixed;top:8px;right:8px;display:flex;align-items:center;gap:6px;flex-wrap:wrap;max-width:calc(100vw - 16px);padding:5px 7px;border-radius:10px;background:rgba(17,24,39,.88);color:#fff;font:12px/1.2 system-ui,-apple-system,Segoe UI,sans-serif;pointer-events:auto;box-shadow:0 6px 20px rgba(0,0,0,.28);cursor:move;touch-action:none}',
    '.bar button{display:inline-flex;align-items:center;gap:5px;height:22px;padding:0 8px;border-radius:999px;border:1px solid rgba(255,255,255,.22);background:transparent;color:#fff;font:12px/1 system-ui,sans-serif;cursor:pointer}',
    '.bar button.on{background:#4c7dff;border-color:#4c7dff}',
    '.bar .count{min-width:16px;height:16px;padding:0 4px;border-radius:8px;background:#4c7dff;color:#fff;font:600 10px/16px system-ui,sans-serif;text-align:center}',
    '.bar .link{border:0;background:transparent;color:#c7d2fe;text-decoration:underline;padding:0 2px;height:auto}',
    '.bar .chips{display:flex;gap:6px;flex-wrap:wrap;max-width:100%}',
    '.bar .chip{display:inline-flex;align-items:center;gap:5px;max-width:280px;padding:2px 4px 2px 8px;border-radius:999px;border:1px solid rgba(76,125,255,.55);background:rgba(76,125,255,.18);font:11px/1.4 system-ui,sans-serif}',
    '.bar .chip .label{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:150px}',
    '.bar .chip .comment{color:#a5b4fc;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:120px}',
    '.bar .chip .kill{border:0;background:transparent;color:#c7d2fe;cursor:pointer;font:600 11px/1 system-ui,sans-serif;padding:1px 3px;border-radius:999px}',
    '.hint{position:fixed;left:50%;transform:translateX(-50%);bottom:18px;background:#111;color:#fff;border-radius:999px;padding:6px 14px;font:12px system-ui,sans-serif;pointer-events:none;display:none;opacity:.92}'
  ].join('');
  shadow.appendChild(style);

  var bar = document.createElement('div');
  bar.className = 'bar';
  var toggleBtn = document.createElement('button');
  toggleBtn.type = 'button';
  toggleBtn.textContent = 'Аннотировать';
  var countBadge = document.createElement('span');
  countBadge.className = 'count';
  var clearBtn = document.createElement('button');
  clearBtn.type = 'button';
  clearBtn.className = 'link';
  clearBtn.textContent = 'очистить';
  var chipRow = document.createElement('div');
  chipRow.className = 'chips';
  bar.appendChild(toggleBtn);
  bar.appendChild(countBadge);
  bar.appendChild(clearBtn);
  bar.appendChild(chipRow);
  shadow.appendChild(bar);

  var box = document.createElement('div');
  box.className = 'box';
  shadow.appendChild(box);

  var pinLayer = document.createElement('div');
  shadow.appendChild(pinLayer);

  var hint = document.createElement('div');
  hint.className = 'hint';
  hint.textContent = 'Кликните по элементу · Esc — выйти';
  shadow.appendChild(hint);

  var card = document.createElement('div');
  card.className = 'card';
  var cardTitle = document.createElement('h4');
  var area = document.createElement('textarea');
  area.setAttribute('placeholder', 'Что сделать с этим элементом?');
  var row = document.createElement('div');
  row.className = 'row';
  var cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.textContent = 'Отмена';
  var saveBtn = document.createElement('button');
  saveBtn.type = 'button';
  saveBtn.className = 'go';
  saveBtn.textContent = 'Сохранить';
  row.appendChild(cancelBtn);
  row.appendChild(saveBtn);
  card.appendChild(cardTitle);
  card.appendChild(area);
  card.appendChild(row);
  shadow.appendChild(card);

  document.documentElement.appendChild(root);
  document.addEventListener('keydown', onHotkey, true);
  document.addEventListener('focusin', onFocusIn, true);
  window.addEventListener('contextmenu', onContextMenu, true);

  function selectorFor(el) {
    if (!el || el.nodeType !== 1) return '';
    if (el.id) {
      var idSel = '#' + CSS.escape(el.id);
      try { if (document.querySelectorAll(idSel).length === 1) return idSel; } catch (e) {}
    }
    var testId = el.getAttribute('data-testid') || el.getAttribute('data-test');
    if (testId) {
      var attrSel = '[data-testid="' + testId.replace(/"/g, '\\"') + '"]';
      try { if (document.querySelectorAll(attrSel).length === 1) return attrSel; } catch (e) {}
    }
    var parts = [];
    var node = el;
    var depth = 0;
    while (node && node.nodeType === 1 && depth < 6) {
      var part = node.tagName.toLowerCase();
      if (node.id) {
        parts.unshift('#' + CSS.escape(node.id));
        break;
      }
      var classes = [];
      for (var i = 0; i < node.classList.length && classes.length < 2; i++) {
        var name = node.classList[i];
        if (/^[A-Za-z_][A-Za-z0-9_-]*$/.test(name)) classes.push(CSS.escape(name));
      }
      if (classes.length > 0) part += '.' + classes.join('.');
      var parent = node.parentElement;
      if (parent) {
        var same = [];
        for (var j = 0; j < parent.children.length; j++) {
          if (parent.children[j].tagName === node.tagName) same.push(parent.children[j]);
        }
        if (same.length > 1) part += ':nth-of-type(' + (same.indexOf(node) + 1) + ')';
      }
      parts.unshift(part);
      node = parent;
      depth += 1;
    }
    return parts.join(' > ');
  }

  function ownText(el) {
    var raw = (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim();
    return raw.slice(0, 300);
  }

  function rectOf(el) {
    var r = el.getBoundingClientRect();
    return { x: Math.round(r.left), y: Math.round(r.top), width: Math.round(r.width), height: Math.round(r.height) };
  }

  function isOverlay(event) {
    var path = typeof event.composedPath === 'function' ? event.composedPath() : [];
    return path.indexOf(root) !== -1;
  }

  function placePins() {
    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      var el = item.el;
      if (!el || !el.isConnected) {
        item.node.style.display = 'none';
        continue;
      }
      var r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) {
        item.node.style.display = 'none';
        continue;
      }
      item.node.style.display = 'block';
      item.node.style.left = Math.round(r.left - 7) + 'px';
      item.node.style.top = Math.round(r.top - 9) + 'px';
    }
  }

  var frame = 0;
  function schedulePins() {
    if (frame !== 0) return;
    frame = requestAnimationFrame(function () {
      frame = 0;
      placePins();
    });
  }

  function openCard(el, x, y) {
    cardOpen = true;
    pendingElement = el;
    box.style.display = 'none';
    cardTitle.textContent = selectorFor(el);
    area.value = '';
    card.style.display = 'block';
    var height = 168;
    var left = Math.min(Math.max(8, x + 14), window.innerWidth - 288);
    var top = Math.min(Math.max(8, y + 16), window.innerHeight - height - 8);
    card.style.left = left + 'px';
    card.style.top = top + 'px';
    keepFocus();
    scheduleFocus();
  }

  /** Put the cursor back into the comment field; modal focus traps steal it back. */
  function keepFocus() {
    if (!cardOpen) return;
    var active = null;
    try { active = shadow.activeElement; } catch (error) { active = null; }
    if (active === area) return;
    try { area.focus({ preventScroll: true }); } catch (error) { area.focus(); }
  }

  /** Retry after the modal library moved focus, for as long as the card is open. */
  function scheduleFocus() {
    [0, 30, 90, 200, 400, 800, 1400].forEach(function (delay) {
      window.setTimeout(keepFocus, delay);
    });
  }

  function closeCard() {
    cardOpen = false;
    pendingElement = null;
    card.style.display = 'none';
  }

  function commit() {
    if (!pendingElement) return;
    var el = pendingElement;
    var node = document.createElement('div');
    node.className = 'pin';
    node.textContent = String(items.length + 1);
    node.title = 'Удалить аннотацию';
    pinLayer.appendChild(node);
    var item = {
      id: 'a' + (items.length + 1) + '-' + Date.now().toString(36),
      el: el,
      node: node,
      selector: selectorFor(el),
      tag: el.tagName.toLowerCase(),
      text: ownText(el),
      comment: area.value.trim(),
      url: location.href,
      title: document.title,
      createdAt: Date.now()
    };
    node.addEventListener('click', function (event) {
      event.preventDefault();
      event.stopPropagation();
      remove(item.id);
    });
    items.push(item);
    closeCard();
    schedulePins();
    renderBar();
  }

  function onMove(event) {
    if (!mode || cardOpen) return;
    var el = event.target;
    if (!el || el.nodeType !== 1 || isOverlay(event)) {
      box.style.display = 'none';
      return;
    }
    var r = el.getBoundingClientRect();
    box.style.display = 'block';
    box.style.left = r.left + 'px';
    box.style.top = r.top + 'px';
    box.style.width = r.width + 'px';
    box.style.height = r.height + 'px';
  }

  function swallow(event) {
    if (!mode) return;
    if (isOverlay(event)) return;
    if (event.type === 'pointerdown' && event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.type !== 'pointerdown' || cardOpen) return;
    var el = event.target;
    if (!el || el.nodeType !== 1) return;
    openCard(el, event.clientX, event.clientY);
  }

  /** Right-click any element to annotate it, without turning on the pick mode first. */
  function onContextMenu(event) {
    if (cardOpen || isOverlay(event)) return;
    var el = event.target;
    if (!el || el.nodeType !== 1) return;
    event.preventDefault();
    event.stopPropagation();
    openCard(el, event.clientX, event.clientY);
  }

  function onKey(event) {
    if (event.key !== 'Escape') return;
    if (cardOpen) {
      closeCard();
      event.preventDefault();
      return;
    }
    if (mode) {
      setMode(false);
      event.preventDefault();
      return;
    }
    if (items.length > 0) {
      clear();
      event.preventDefault();
    }
  }

  /** A modal focus trap pulls focus out of the comment card; take it back. */
  function onFocusIn(event) {
    if (!cardOpen || isOverlay(event)) return;
    keepFocus();
  }

  /** Alt+A toggles picking without any Harness UI, so it also works while the Browser panel is fullscreen. */
  function onHotkey(event) {
    if (!event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (event.code !== 'KeyA' && event.key !== 'a' && event.key !== 'A') return;
    if (isOverlay(event) || cardOpen) return;
    event.preventDefault();
    event.stopPropagation();
    setMode(!mode);
  }

  function onScroll() {
    if (items.length > 0) schedulePins();
  }

  saveBtn.addEventListener('click', function (event) {
    event.preventDefault();
    event.stopPropagation();
    commit();
  });
  cancelBtn.addEventListener('click', function (event) {
    event.preventDefault();
    event.stopPropagation();
    closeCard();
  });
  toggleBtn.addEventListener('click', function (event) {
    event.preventDefault();
    event.stopPropagation();
    setMode(!mode);
  });
  clearBtn.addEventListener('click', function (event) {
    event.preventDefault();
    event.stopPropagation();
    clear();
  });

  /** Repaint the in-page toolbar: toggle state, counter, and the chip list. */
  function renderBar() {
    toggleBtn.textContent = mode ? 'Выбор включён' : 'Аннотировать';
    toggleBtn.className = mode ? 'on' : '';
    countBadge.textContent = String(items.length);
    countBadge.style.display = items.length > 0 ? '' : 'none';
    clearBtn.style.display = items.length > 0 ? '' : 'none';
    while (chipRow.firstChild) chipRow.removeChild(chipRow.firstChild);
    items.forEach(function (item, index) {
      var chip = document.createElement('span');
      chip.className = 'chip';
      var label = document.createElement('span');
      label.className = 'label';
      label.textContent = (index + 1) + '. ' + (item.text === '' ? item.selector : item.text);
      chip.appendChild(label);
      if (item.comment !== '') {
        var comment = document.createElement('span');
        comment.className = 'comment';
        comment.textContent = '— ' + item.comment;
        chip.appendChild(comment);
      }
      var kill = document.createElement('button');
      kill.type = 'button';
      kill.className = 'kill';
      kill.textContent = '✕';
      kill.title = 'Убрать эту аннотацию';
      kill.addEventListener('click', function (event) {
        event.preventDefault();
        event.stopPropagation();
        remove(item.id);
      });
      chip.appendChild(kill);
      chipRow.appendChild(chip);
    });
  }
  renderBar();

  var barPos = null;
  try {
    var storedPos = window.localStorage.getItem('dsh-annotate:bar');
    if (storedPos) barPos = JSON.parse(storedPos);
  } catch (error) {
    barPos = null;
  }

  function placeBar() {
    if (!barPos || typeof barPos.left !== 'number' || typeof barPos.top !== 'number') return;
    bar.style.left = barPos.left + 'px';
    bar.style.top = barPos.top + 'px';
    bar.style.right = 'auto';
  }

  var dragState = null;
  bar.addEventListener('pointerdown', function (event) {
    if (event.target && typeof event.target.closest === 'function' && event.target.closest('button')) return;
    var rect = bar.getBoundingClientRect();
    dragState = { dx: event.clientX - rect.left, dy: event.clientY - rect.top };
    try { bar.setPointerCapture(event.pointerId); } catch (error) {}
    event.preventDefault();
    event.stopPropagation();
  });
  bar.addEventListener('pointermove', function (event) {
    if (dragState === null) return;
    var rect = bar.getBoundingClientRect();
    var left = Math.max(4, Math.min(window.innerWidth - rect.width - 4, event.clientX - dragState.dx));
    var top = Math.max(4, Math.min(window.innerHeight - rect.height - 4, event.clientY - dragState.dy));
    bar.style.left = left + 'px';
    bar.style.top = top + 'px';
    bar.style.right = 'auto';
  });
  bar.addEventListener('pointerup', function () {
    if (dragState === null) return;
    dragState = null;
    var rect = bar.getBoundingClientRect();
    try {
      window.localStorage.setItem('dsh-annotate:bar', JSON.stringify({ left: Math.round(rect.left), top: Math.round(rect.top) }));
    } catch (error) {}
  });
  placeBar();

  function setMode(next) {
    mode = next === true;
    if (!mode) {
      box.style.display = 'none';
      closeCard();
    }
    hint.style.display = mode ? 'block' : 'none';
    document.documentElement.style.cursor = mode ? 'crosshair' : '';
    if (mode) {
      window.addEventListener('mousemove', onMove, true);
      window.addEventListener('pointerdown', swallow, true);
      window.addEventListener('mousedown', swallow, true);
      window.addEventListener('mouseup', swallow, true);
      window.addEventListener('click', swallow, true);
      window.addEventListener('keydown', onKey, true);
      window.addEventListener('scroll', onScroll, true);
      window.addEventListener('resize', schedulePins, true);
    } else {
      window.removeEventListener('mousemove', onMove, true);
      window.removeEventListener('pointerdown', swallow, true);
      window.removeEventListener('mousedown', swallow, true);
      window.removeEventListener('mouseup', swallow, true);
      window.removeEventListener('click', swallow, true);
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', schedulePins, true);
    }
    schedulePins();
    renderBar();
  }

  var textCache = { at: 0, value: '' };
  function pageText() {
    var now = Date.now();
    if (textCache.value !== '' && now - textCache.at < 5000) return textCache.value;
    var raw = '';
    try {
      raw = document.body ? document.body.innerText : '';
    } catch (e) {}
    textCache.at = now;
    textCache.value = String(raw || '').slice(0, 6000);
    return textCache.value;
  }

  function snapshot() {
    return {
      url: location.href,
      title: document.title,
      text: pageText(),
      annotations: items.map(function (item) {
        var rect = item.el && item.el.isConnected ? rectOf(item.el) : { x: 0, y: 0, width: 0, height: 0 };
        return {
          id: item.id,
          selector: item.selector,
          tag: item.tag,
          text: item.text,
          comment: item.comment,
          url: item.url,
          title: item.title,
          rect: rect,
          createdAt: item.createdAt
        };
      })
    };
  }

  function remove(id) {
    for (var i = 0; i < items.length; i++) {
      if (items[i].id !== id) continue;
      if (items[i].node.parentNode) items[i].node.parentNode.removeChild(items[i].node);
      items.splice(i, 1);
      break;
    }
    for (var k = 0; k < items.length; k++) items[k].node.textContent = String(k + 1);
    schedulePins();
    renderBar();
  }

  function clear() {
    while (items.length > 0) {
      var item = items.pop();
      if (item.node.parentNode) item.node.parentNode.removeChild(item.node);
    }
    schedulePins();
    renderBar();
  }

  function destroy() {
    setMode(false);
    document.removeEventListener('keydown', onHotkey, true);
    document.removeEventListener('focusin', onFocusIn, true);
    window.removeEventListener('contextmenu', onContextMenu, true);
    if (root.parentNode) root.parentNode.removeChild(root);
    delete window.__dshAnnotate;
  }

  window.__dshAnnotate = {
    version: 7,
    setMode: setMode,
    snapshot: snapshot,
    remove: remove,
    clear: clear,
    isActive: function () { return mode; },
    destroy: destroy
  };
  return 'ok';
})()`

window.__ModuleLoader__.load({
  id: 'dsh-browser-annotate',
  factory: (require) => {
    const React = require('react')
    const h = React.createElement

    const CHANNEL = 'api/browser-annotate'
    const WEBVIEW_SELECTOR = 'webview[data-sidebar-browser-frame]'

    /**
     * POST one action to the Host half on the shared `/api` channel.
     * @param payload - JSON body carrying at least `action`.
     * @returns the parsed Host answer, or undefined when no carrier answered.
     */
    async function sendToHost(payload) {
      const body = JSON.stringify(payload)
      const init = { method: 'POST', headers: { 'content-type': 'application/json' }, body }
      let response
      try {
        response = await globalThis.fetch(CHANNEL, init)
      } catch {
        const transport = globalThis.__DSH_TRANSPORT__
        const base = transport === undefined ? undefined : transport.streamBaseUrl
        if (base === undefined) throw new Error('the page has no Host transport')
        response = await globalThis.fetch(new URL(CHANNEL, base).href, init)
      }
      if (!response.ok) throw new Error(`HTTP ${String(response.status)}`)
      return await response.json()
    }

    /**
     * Find the visible Browser guest element in this document.
     * @returns {object | null} the `<webview>` element, or null when no Browser pane is shown.
     */
    function findWebview() {
      const found = Array.from(document.querySelectorAll(WEBVIEW_SELECTOR))
      const visible = found.filter((element) => element.getClientRects().length > 0)
      return visible.length > 0 ? visible[visible.length - 1] : null
    }

    /**
     * Evaluate a page expression inside one guest.
     * @param webview - the `<webview>` element.
     * @param expression - page-context JavaScript.
     * @returns the promise value, or undefined when the guest refuses.
     */
    async function evaluate(webview, expression) {
      if (webview === null || typeof webview.executeJavaScript !== 'function') return undefined
      try {
        return await webview.executeJavaScript(expression, true)
      } catch {
        return undefined
      }
    }

    /**
     * Inject the overlay when the guest document does not have it yet.
     * @param webview - the `<webview>` element.
     * @returns true once the overlay answers in that document.
     */
    async function ensureOverlay(webview) {
      const present = await evaluate(webview, 'window.__dshAnnotate && window.__dshAnnotate.version === 7 ? "ok" : ""')
      if (present === 'ok') return true
      const created = await evaluate(webview, INJECT_SCRIPT)
      return created === 'ok' || created === 'exists'
    }

    /**
     * Read the guest page identity without touching the injected overlay.
     * @param webview - the `<webview>` element.
     * @returns `{ url, title }`.
     */
    function pageIdentity(webview) {
      let url = ''
      let title = ''
      try {
        url = typeof webview.getURL === 'function' ? webview.getURL() : ''
        title = typeof webview.getTitle === 'function' ? webview.getTitle() : ''
      } catch {}
      return { url: typeof url === 'string' ? url : '', title: typeof title === 'string' ? title : '' }
    }

    /** Shared React state so the row and its handlers stay in sync. */
    function useAnnotate(ctx) {
      const [active, setActive] = React.useState(false)
      const [count, setCount] = React.useState(0)
      const [items, setItems] = React.useState([])
      const [status, setStatus] = React.useState('')
      const activeRef = React.useRef(false)
      const lastRef = React.useRef('')
      const busyRef = React.useRef(false)
      const touchedRef = React.useRef(false)

      const post = React.useCallback(async (payload) => {
        try {
          const result = await sendToHost({ action: 'sync', ...payload })
          if (result === undefined) throw new Error('no answer')
          if (result.ok === false) throw new Error(typeof result.error === 'string' ? result.error : 'sync failed')
          return true
        } catch (error) {
          setStatus(`Нет связи с хостом: ${error instanceof Error ? error.message : String(error)}`)
          return false
        }
      }, [])

      React.useEffect(() => {
        let stopped = false
        const timer = setInterval(() => {
          if (stopped || busyRef.current) return
          const webview = findWebview()
          if (webview === null) {
            if (activeRef.current) {
              activeRef.current = false
              setActive(false)
            }
            if (touchedRef.current) setStatus('Откройте вкладку «Браузер» в панели справа')
            return
          }
          busyRef.current = true
          void (async () => {
            try {
              const ready = await ensureOverlay(webview)
              if (!ready) {
                setStatus('Страница ещё загружается')
                return
              }
              if (activeRef.current) {
                await evaluate(webview, 'window.__dshAnnotate && window.__dshAnnotate.setMode(true), "on"')
              }
              const raw = await evaluate(webview, 'window.__dshAnnotate ? JSON.stringify(window.__dshAnnotate.snapshot()) : ""')
              if (typeof raw !== 'string' || raw === '') return
              const identity = pageIdentity(webview)
              let snapshot
              try {
                snapshot = JSON.parse(raw)
              } catch {
                return
              }
              const list = Array.isArray(snapshot.annotations) ? snapshot.annotations : []
              const hash = [
                typeof snapshot.url === 'string' ? snapshot.url : identity.url,
                typeof snapshot.title === 'string' ? snapshot.title : identity.title,
                list.map((item) => `${item.id}:${item.comment}`).join(','),
              ].join('|')
              if (hash !== lastRef.current) {
                lastRef.current = hash
                setCount(list.length)
                setItems(list.map((item, index) => ({
                  id: item.id,
                  index: index + 1,
                  label: item.text === '' ? item.selector : item.text,
                  comment: item.comment === '' ? '' : item.comment,
                })))
                setStatus(list.length > 0 ? 'Уйдёт со следующим сообщением' : 'Кликните по элементу в браузере')
                await post({
                  page: {
                    url: typeof snapshot.url === 'string' && snapshot.url !== '' ? snapshot.url : identity.url,
                    title: typeof snapshot.title === 'string' && snapshot.title !== '' ? snapshot.title : identity.title,
                    text: typeof snapshot.text === 'string' ? snapshot.text : '',
                  },
                  annotations: list,
                })
                return
              }
              if (list.length === 0) return
              // Once the Host has delivered the batch with the user message, the
              // markers have done their job: clear them here instead of waiting
              // for the turn to end, so the composer never shows a stale count.
              const answer = await sendToHost({ action: 'poll' })
              if (answer === undefined || answer.ok === false) return
              const delivered = typeof answer.delivered === 'number' ? answer.delivered : 0
              const count = typeof answer.count === 'number' ? answer.count : 0
              if (count === 0 || delivered >= count) {
                await evaluate(webview, 'window.__dshAnnotate && window.__dshAnnotate.clear(), "ok"')
                lastRef.current = ''
                setCount(0)
                setItems([])
                setStatus('Отправлено — метки убраны')
                await sendToHost({ action: 'clear' })
              }
            } finally {
              busyRef.current = false
            }
          })()
        }, 700)
        return () => {
          stopped = true
          clearInterval(timer)
        }
      }, [post])

      const toggle = React.useCallback(async () => {
        touchedRef.current = true
        const webview = findWebview()
        if (webview === null) {
          setStatus('Откройте вкладку «Браузер» в панели справа')
          return
        }
        const injected = await ensureOverlay(webview)
        if (!injected) {
          setStatus('Страница ещё загружается')
          return
        }
        const next = !activeRef.current
        activeRef.current = next
        setActive(next)
        await evaluate(webview, `window.__dshAnnotate && window.__dshAnnotate.setMode(${next ? 'true' : 'false'}), "ok"`)
        setStatus(next ? 'Кликните по элементу в браузере' : 'Выбор выключен')
      }, [])

      const clearAll = React.useCallback(async () => {
        const webview = findWebview()
        if (webview !== null) await evaluate(webview, 'window.__dshAnnotate && window.__dshAnnotate.clear(), "ok"')
        lastRef.current = ''
        setCount(0)
        setItems([])
        await post({ annotations: [] })
      }, [post])

      const removeOne = React.useCallback(async (id) => {
        const webview = findWebview()
        if (webview !== null) {
          await evaluate(webview, `window.__dshAnnotate && window.__dshAnnotate.remove(${JSON.stringify(id)}), "ok"`)
        }
        lastRef.current = ''
        setItems((previous) => previous.filter((item) => item.id !== id))
      }, [])

      return { active, count, items, status, toggle, clearAll, removeOne }
    }

    const token = {
      button: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        height: '24px',
        padding: '0 8px',
        borderRadius: 'var(--dsw-radius-sm, 6px)',
        border: '0.5px solid var(--dsw-alias-border-l2, rgba(128,128,128,.35))',
        background: 'transparent',
        color: 'var(--dsw-alias-label-secondary, #6b7280)',
        font: 'var(--dsw-font-xxs-12, 12px) system-ui, sans-serif',
        cursor: 'pointer',
      },
      activeButton: {
        borderColor: '#4c7dff',
        color: '#4c7dff',
        background: 'rgba(76,125,255,.10)',
      },
      badge: {
        minWidth: '16px',
        height: '16px',
        padding: '0 4px',
        borderRadius: '8px',
        background: '#4c7dff',
        color: '#fff',
        font: '600 10px/16px system-ui, sans-serif',
        textAlign: 'center',
      },
      status: {
        color: 'var(--dsw-alias-label-tertiary, #9ca3af)',
        font: 'var(--dsw-font-xxxs-11, 11px) system-ui, sans-serif',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      },
      row: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        minWidth: 0,
      },
      column: {
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        width: '100%',
        minWidth: 0,
      },
      chipList: {
        display: 'flex',
        flexWrap: 'wrap',
        gap: '6px',
        maxHeight: '96px',
        overflowY: 'auto',
      },
      chip: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        maxWidth: '100%',
        padding: '2px 4px 2px 8px',
        borderRadius: '999px',
        border: '0.5px solid rgba(76,125,255,.45)',
        background: 'rgba(76,125,255,.10)',
        color: 'var(--dsw-alias-label-primary, #111827)',
        font: 'var(--dsw-font-xxs-12, 12px) system-ui, sans-serif',
        minWidth: 0,
      },
      chipLabel: {
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        maxWidth: '260px',
      },
      chipComment: {
        color: '#4c7dff',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        maxWidth: '180px',
      },
      chipRemove: {
        border: 0,
        background: 'transparent',
        color: 'var(--dsw-alias-label-tertiary, #9ca3af)',
        cursor: 'pointer',
        font: '600 12px/1 system-ui, sans-serif',
        padding: '2px 4px',
        borderRadius: '999px',
      },
    }

    /** Composer-dock row: the pick toggle, a short state line, and the attached chips. */
    function Dock(props) {
      const state = props.state
      const chips = state.items.map((item) => {
        const children = [
          h('span', { key: 'label', style: token.chipLabel }, `${String(item.index)}. ${item.label}`),
        ]
        if (item.comment !== '') children.push(h('span', { key: 'comment', style: token.chipComment }, `— ${item.comment}`))
        children.push(h('span', {
          key: 'remove',
          role: 'button',
          tabIndex: 0,
          title: 'Убрать эту аннотацию',
          onClick: () => { void state.removeOne(item.id) },
          onKeyDown: (event) => { if (event.key === 'Enter') void state.removeOne(item.id) },
          style: token.chipRemove,
        }, '✕'))
        return h('span', {
          key: item.id,
          style: token.chip,
          title: item.comment === '' ? item.label : `${item.label} — ${item.comment}`,
        }, children)
      })
      return h('div', { style: token.column },
        h('div', { style: token.row },
          h('button', {
            type: 'button',
            onClick: () => { void state.toggle() },
            style: state.active ? { ...token.button, ...token.activeButton } : token.button,
            title: state.active
              ? 'Выключить выбор элементов в браузере'
              : 'Выбирать элементы в открытой странице панели «Браузер»',
          },
          h('svg', { viewBox: '0 0 16 16', width: 14, height: 14, 'aria-hidden': true },
            h('rect', { x: 1.5, y: 2.5, width: 13, height: 11, rx: 2, fill: 'none', stroke: 'currentColor', strokeWidth: 1.2 }),
            h('path', { d: 'M4.5 7.5h5M4.5 10.5h3', stroke: 'currentColor', strokeWidth: 1.2, strokeLinecap: 'round' }),
            h('circle', { cx: 11.5, cy: 6.5, r: 2.2, fill: 'currentColor', opacity: 0.9 }),
          ),
          h('span', null, state.active ? 'Выбор включён' : 'Аннотировать'),
          state.count > 0 ? h('span', { style: token.badge }, String(state.count)) : null,
          state.count > 0
            ? h('span', {
              role: 'button',
              tabIndex: 0,
              onClick: () => { void state.clearAll() },
              onKeyDown: (event) => { if (event.key === 'Enter') void state.clearAll() },
              style: { ...token.status, cursor: 'pointer', textDecoration: 'underline' },
              title: 'Удалить все аннотации',
            }, 'очистить')
            : null,
          ),
          state.status !== '' ? h('span', { style: token.status }, state.status) : null,
        ),
        state.count > 0 ? h('div', { style: token.chipList }, chips) : null)
    }

    return {
      name: 'dsh-browser-annotate',
      inject: ['slots'],
      apply(ctx) {
        function Host() {
          // The controls live inside the page now (the toolbar above the page
          // content); this entry only keeps the poll that syncs the annotations
          // and the page snapshot to the Host.
          useAnnotate(ctx)
          return null
        }
        ctx.slots.inject('conversation.composer.dock', () => ctx.slots.register({
          name: 'conversation.composer.dock',
          id: 'browser-annotate',
          order: 40,
        }, Host))
      },
    }
  },
})
