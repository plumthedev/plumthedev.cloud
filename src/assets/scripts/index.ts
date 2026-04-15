(() => {
    const GTM_ID = 'GTM-KH64L7ZR';
    const STORAGE_KEY = 'cookies';
    const HIST_KEY = 'shell.history';

    /* ─────────────────────────────────────────────────
       analytics — loads right away unless user rejected.
       reject persists the choice and reloads, so GTM is
       gone from the current session too.
       ───────────────────────────────────────────────── */
    function loadGTM() {
        if (document.getElementById('gtm-loader')) return;
        const s = document.createElement('script');
        s.id = 'gtm-loader';
        s.async = true;
        s.src = `https://www.googletagmanager.com/gtm.js?id=${GTM_ID}`;
        document.head.appendChild(s);

        const ns = document.createElement('noscript');
        const iframe = document.createElement('iframe');
        iframe.src = `https://www.googletagmanager.com/ns.html?id=${GTM_ID}`;
        iframe.width = '0';
        iframe.height = '0';
        iframe.style.cssText = 'display:none;visibility:hidden';
        ns.appendChild(iframe);
        document.body.appendChild(ns);
    }

    function setupConsent() {
        const banner = document.getElementById('cookies-banner');
        const accept = document.getElementById('accept-cookies');
        const reject = document.getElementById('reject-cookies');
        if (!banner || !accept || !reject) return;

        const choice = localStorage.getItem(STORAGE_KEY);
        if (choice !== '0') loadGTM();

        if (choice === '1' || choice === '0') {
            banner.hidden = true;
            return;
        }

        banner.hidden = false;
        setTimeout(() => banner.setAttribute('data-visible', 'true'), 800);

        const dismiss = () => {
            banner.removeAttribute('data-visible');
            setTimeout(() => (banner.hidden = true), 400);
        };

        accept.addEventListener('click', () => {
            localStorage.setItem(STORAGE_KEY, '1');
            dismiss();
        });

        reject.addEventListener('click', () => {
            localStorage.setItem(STORAGE_KEY, '0');
            dismiss();
            setTimeout(() => location.reload(), 450);
        });
    }

    /* ─────────────────────────────────────────────────
       DOM helpers — build nodes, never parse strings as HTML
       ───────────────────────────────────────────────── */
    function el(tag: string, cls?: string, text?: string): HTMLElement {
        const n = document.createElement(tag);
        if (cls) n.className = cls;
        if (text !== undefined) n.textContent = text;
        return n;
    }
    function frag(...kids: (Node | string)[]): DocumentFragment {
        const f = document.createDocumentFragment();
        for (const k of kids) f.appendChild(typeof k === 'string' ? document.createTextNode(k) : k);
        return f;
    }
    function span(text: string, cls?: string) { return el('span', cls, text); }
    function anchor(text: string, href: string, newTab = true): HTMLAnchorElement {
        const a = document.createElement('a');
        a.href = href;
        a.textContent = text;
        if (newTab) { a.target = '_blank'; a.rel = 'noopener noreferrer'; }
        return a;
    }

    /* ─────────────────────────────────────────────────
       shell
       ───────────────────────────────────────────────── */
    type CommandFn = (args: string[], shell: Shell) => void;
    interface Command {
        name: string;
        summary: string;
        hidden?: boolean;
        run: CommandFn;
    }

    class Shell {
        historyEl: HTMLElement;
        bodyEl: HTMLElement;
        input: HTMLInputElement;
        commands: Map<string, Command> = new Map();
        aliases: Map<string, string> = new Map();
        cmdHistory: string[] = [];
        historyIdx = -1;
        commandCount = 0;
        chuckUsed = false;
        hintShown = false;

        constructor(history: HTMLElement, body: HTMLElement, input: HTMLInputElement) {
            this.historyEl = history;
            this.bodyEl = body;
            this.input = input;
            try { this.cmdHistory = JSON.parse(localStorage.getItem(HIST_KEY) || '[]'); }
            catch { this.cmdHistory = []; }
            this.historyIdx = this.cmdHistory.length;
        }

        register(cmd: Command, ...aliases: string[]) {
            this.commands.set(cmd.name, cmd);
            aliases.forEach(a => this.aliases.set(a, cmd.name));
        }
        resolve(name: string): Command | undefined {
            return this.commands.get(name) || this.commands.get(this.aliases.get(name) || '');
        }

        /* ─── rendering ─── */
        writeLine(content: Node | string, cls = 'line--out') {
            const p = el('p', 'line ' + cls);
            p.appendChild(typeof content === 'string' ? document.createTextNode(content) : content);
            this.historyEl.appendChild(p);
            this.scroll();
        }
        writeText(text: string, cls = 'line--out') {
            this.writeLine(document.createTextNode(text), cls);
        }
        spacer() {
            const d = el('div', 'spacer');
            this.historyEl.appendChild(d);
        }
        echo(raw: string) {
            const p = el('p', 'line line--echo');
            const prompt = el('span', 'echo-prompt');
            prompt.appendChild(el('span', 's', '$'));
            const cmd = el('span', 'echo-cmd', raw);
            p.append(prompt, document.createTextNode(' '), cmd);
            this.historyEl.appendChild(p);
        }
        scroll() {
            this.bodyEl.scrollTop = this.bodyEl.scrollHeight;
            this.historyEl.scrollTop = this.historyEl.scrollHeight;
        }
        clear() {
            while (this.historyEl.firstChild) this.historyEl.removeChild(this.historyEl.firstChild);
            this.intro();
        }

        /* ─── bio rendered on boot ─── */
        intro() {
            const name = el('p', 'line line--out');
            name.appendChild(span('kacper pruszyński', 'k'));
            this.historyEl.appendChild(name);

            const meta = el('p', 'line line--out');
            meta.append(span('software engineer', 'd'), span(' · ', 'd'), span('backend', 'd'), span(' · ', 'd'), span('warsaw', 'd'));
            this.historyEl.appendChild(meta);

            this.spacer();

            const cv = el('p', 'line line--out');
            cv.append(span('→ ', 'd'), anchor('resume', 'cv/cv.pdf'));
            this.historyEl.appendChild(cv);

            const gh = el('p', 'line line--out');
            gh.append(span('→ ', 'd'), anchor('github.com/plumthedev', 'https://github.com/plumthedev'));
            this.historyEl.appendChild(gh);

            const li = el('p', 'line line--out');
            li.append(span('→ ', 'd'), anchor('linkedin.com/in/plumthedev', 'https://www.linkedin.com/in/plumthedev/'));
            this.historyEl.appendChild(li);

            this.spacer();

            this.writeText("type 'help' for commands.", 'line--hint');
        }

        /* ─── execution ─── */
        submit(raw: string) {
            const trimmed = raw.trim();
            if (!trimmed) { this.echo(''); return; }

            this.echo(trimmed);
            this.pushHistory(trimmed);

            const [name, ...args] = trimmed.split(/\s+/);
            const cmd = this.resolve(name.toLowerCase());
            if (!cmd) {
                this.writeLine(
                    frag(span('command not found: ', 'd'), span(name), ' — try ', span('help', 'k'), '.'),
                    'line--error'
                );
            } else {
                try { cmd.run(args, this); }
                catch (e) { this.writeText('error: ' + String(e), 'line--error'); }
            }

            this.commandCount += 1;
            if (name.toLowerCase() === 'chuck') this.chuckUsed = true;
            this.maybeHint();
        }

        pushHistory(cmd: string) {
            if (this.cmdHistory[this.cmdHistory.length - 1] === cmd) return;
            this.cmdHistory.push(cmd);
            this.cmdHistory = this.cmdHistory.slice(-50);
            this.historyIdx = this.cmdHistory.length;
            try { localStorage.setItem(HIST_KEY, JSON.stringify(this.cmdHistory)); } catch {}
        }

        maybeHint() {
            if (this.hintShown || this.chuckUsed) return;
            if (this.commandCount >= 8) {
                this.hintShown = true;
                this.spacer();
                this.writeText('// there\u2019s more.', 'line--hint');
            }
        }

        /* ─── arrow-key history nav ─── */
        stepHistory(delta: number) {
            if (!this.cmdHistory.length) return;
            this.historyIdx = Math.max(0, Math.min(this.cmdHistory.length, this.historyIdx + delta));
            this.input.value = this.cmdHistory[this.historyIdx] ?? '';
            requestAnimationFrame(() => {
                this.input.setSelectionRange(this.input.value.length, this.input.value.length);
            });
        }

        /* ─── tab-complete ─── */
        complete() {
            const v = this.input.value;
            if (!v) return;
            const parts = v.split(/\s+/);
            if (parts.length !== 1) return;
            const prefix = parts[0].toLowerCase();
            const visible = [...this.commands.values()].filter(c => !c.hidden).map(c => c.name);
            const matches = visible.filter(n => n.startsWith(prefix));
            if (matches.length === 1) {
                this.input.value = matches[0] + ' ';
            } else if (matches.length > 1) {
                const line = el('span');
                matches.forEach((m, i) => {
                    if (i > 0) line.appendChild(document.createTextNode('  '));
                    line.appendChild(span(m, 'k'));
                });
                this.writeLine(line);
            }
        }
    }

    function openUrl(url: string, newTab = true) {
        if (newTab) window.open(url, '_blank', 'noopener,noreferrer');
        else location.href = url;
    }

    function registerCommands(shell: Shell) {
        shell.register({
            name: 'help',
            summary: 'list commands',
            run: (_a, s) => {
                for (const c of s.commands.values()) {
                    if (c.hidden) continue;
                    const row = el('span');
                    row.append(span(c.name.padEnd(8, ' '), 'k'), span(c.summary, 'd'));
                    s.writeLine(row);
                }
            }
        }, '?');

        shell.register({
            name: 'links',
            summary: 'contact & profiles',
            run: (_a, s) => {
                const row = (label: string, display: string, href: string, mailto = false) => {
                    const line = el('span');
                    line.append(
                        span('→ ', 'd'),
                        span(label.padEnd(10, ' '), 'k'),
                        anchor(display, mailto ? 'mailto:' + display : href)
                    );
                    return line;
                };
                s.writeLine(row('email', 'kacper.pruszynski99@gmail.com', '', true));
                s.writeLine(row('github', 'github.com/plumthedev', 'https://github.com/plumthedev'));
                s.writeLine(row('linkedin', 'linkedin.com/in/plumthedev', 'https://www.linkedin.com/in/plumthedev/'));
            }
        });

        shell.register({
            name: 'cv',
            summary: 'open resume',
            run: (_a, s) => { s.writeText('→ opening resume…', 'line--hint'); openUrl('cv/cv.pdf'); }
        }, 'resume');

        shell.register({
            name: 'clear',
            summary: 'clear screen',
            run: (_a, s) => s.clear()
        }, 'cls');

        shell.register({
            name: 'exit',
            summary: 'close session',
            hidden: true,
            run: (_a, s) => {
                s.writeText('closing session…', 'line--hint');
                setTimeout(() => document.getElementById('terminal')?.dispatchEvent(new CustomEvent('terminal:close')), 300);
            }
        }, 'quit', 'logout');

        shell.register({
            name: 'chuck',
            summary: 'some doors should stay closed',
            run: (_a, s) => {
                s.writeText('initiating protocol-chuck…', 'line--hint');
                setTimeout(() => (location.href = 'protocol-c.html'), 450);
            }
        });
    }

    function setupTerminal() {
        const root = document.getElementById('terminal');
        const bodyEl = document.getElementById('terminal-body');
        const historyEl = document.getElementById('history');
        const form = document.getElementById('prompt-form') as HTMLFormElement | null;
        const input = document.getElementById('terminal-input') as HTMLInputElement | null;
        const closedOverlay = document.getElementById('closed-overlay');
        const restoreBtn = document.getElementById('restore');
        if (!root || !bodyEl || !historyEl || !form || !input) return;
        const rootEl = root;
        const inputEl = input;

        const shell = new Shell(historyEl, bodyEl, inputEl);
        registerCommands(shell);
        shell.intro();

        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const v = input.value;
            input.value = '';
            shell.submit(v);
        });

        input.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowUp')        { e.preventDefault(); shell.stepHistory(-1); }
            else if (e.key === 'ArrowDown') { e.preventDefault(); shell.stepHistory(1); }
            else if (e.key === 'Tab')       { e.preventDefault(); shell.complete(); }
            else if (e.key === 'l' && e.ctrlKey) { e.preventDefault(); shell.clear(); }
            else if (e.key === 'c' && e.ctrlKey) {
                e.preventDefault();
                shell.echo(input.value + '^C');
                input.value = '';
            }
        });

        bodyEl.addEventListener('click', (e) => {
            const sel = window.getSelection();
            if (sel && sel.toString().length > 0) return;
            if ((e.target as HTMLElement).closest('a, button')) return;
            input.focus();
        });

        document.addEventListener('keydown', (e) => {
            if (root.classList.contains('is-minimized')) return;
            if (closedOverlay && !closedOverlay.hidden) return;
            if (document.activeElement === input) return;
            if (e.ctrlKey || e.metaKey || e.altKey) return;
            const target = e.target as HTMLElement | null;
            if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
            if (e.key.length === 1 || e.key === 'Backspace' || e.key === 'Enter') {
                input.focus();
            }
        });

        input.focus();

        root.querySelectorAll<HTMLElement>('.dot').forEach(btn => {
            btn.addEventListener('click', () => {
                const action = btn.dataset.action;
                if (action === 'close') closeTerminal();
                else if (action === 'min') root.classList.toggle('is-minimized');
                else if (action === 'max') root.classList.toggle('is-maxed');
                if (!root.classList.contains('is-minimized')) input.focus();
            });
        });

        root.addEventListener('terminal:close', () => closeTerminal());
        restoreBtn?.addEventListener('click', reopenTerminal);

        function closeTerminal() {
            if (!closedOverlay) return;
            closedOverlay.hidden = false;
            rootEl.classList.remove('is-minimized');
        }
        function reopenTerminal() {
            if (!closedOverlay) return;
            closedOverlay.hidden = true;
            shell.clear();
            inputEl.focus();
        }
    }

    /* boot */
    setupConsent();
    setupTerminal();
})();
