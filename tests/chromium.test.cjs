const assert = require('node:assert/strict');
const { execFile } = require('node:child_process');
const { existsSync } = require('node:fs');
const { mkdtemp, readFile, rm, writeFile } = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const { pathToFileURL } = require('node:url');
const { promisify } = require('node:util');

const extension = path.join(__dirname, '..', 'chrome_extension');
const { content_scripts: scripts } = require('../chrome_extension/manifest.json');
const runBrowser = promisify(execFile);
const chromium = process.env.CHROMIUM_PATH || [
    path.join(process.env.PROGRAMFILES || '', 'Google/Chrome/Application/chrome.exe'),
    path.join(process.env['PROGRAMFILES(X86)'] || '', 'Microsoft/Edge/Application/msedge.exe'),
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/chromium',
    '/usr/bin/google-chrome'
].find(existsSync) || 'chromium';

const inlineScript = source => `<script>${source.replace(/<\/script/gi, '<\\/script')}</script>`;

for (const [name, route] of Object.entries({
    home: 'https://store.steampowered.com/',
    product: 'https://store.steampowered.com/app/*',
    cart: 'https://store.steampowered.com/cart*'
})) {
    test(name, async () => {
        const temporary = await mkdtemp(path.join(os.tmpdir(), 'timbocito-test-'));
        try {
            const entry = scripts.find(script => script.matches.includes(route));
            const [fixture, harness, ...extensionScripts] = await Promise.all([
                readFile(path.join(__dirname, 'fixtures', `${name}.html`), 'utf8'),
                readFile(path.join(__dirname, 'browser-cases.js'), 'utf8'),
                ...entry.js.map(file => readFile(path.join(extension, file), 'utf8'))
            ]);
            const [setup, checks] = harness.split('// Browser checks');
            const page = path.join(temporary, `${name}.html`);
            await writeFile(page, `<!doctype html><meta charset="utf-8"><body data-fixture="${name}">
                <pre id="test-result">PENDING</pre>${fixture}
                ${[setup, ...extensionScripts, checks].map(inlineScript).join('\n')}`);

            const { stdout } = await runBrowser(chromium, [
                '--headless', '--disable-extensions', '--no-first-run', '--disable-background-networking',
                '--no-proxy-server', '--virtual-time-budget=10000', '--dump-dom',
                `--user-data-dir=${path.join(temporary, 'profile')}`, pathToFileURL(page).href
            ], { timeout: 30_000, maxBuffer: 4 * 1024 * 1024, windowsHide: true });
            assert.equal(stdout.match(/<pre id="test-result">([^<]*)<\/pre>/)?.[1], 'PASS');
        } finally {
            await rm(temporary, { recursive: true, force: true, maxRetries: 3 });
        }
    });
}
