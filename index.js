// simulate-50-local.js
// Usage:
// 1) npm init -y
// 2) npm i -D playwright
// 3) npx playwright install
// 4) node index.js

import { chromium } from 'playwright';

const TOTAL_RUNS = 50;           // number of simulated visits
const CONCURRENCY = 10;          // how many run in parallel (tune to your RAM)
const TARGET_URL = 'https://wakaoapp.com/'; // final URL to hit
const KEYWORDS = ['wakao app', 'wakao ai', 'wakao social', 'wakao'];
const SEARCH_ENGINE = 'https://www.google.com'; // change if you prefer duckduckgo

// small helpers
function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function sleep(ms) { return new Promise(res => setTimeout(res, ms)); }

const USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 13_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.2 Safari/605.1.15',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
];

async function runSingleVisit(id, browser) {
    const ua = USER_AGENTS[id % USER_AGENTS.length];
    const keyword = KEYWORDS[id % KEYWORDS.length];

    const context = await browser.newContext({
        userAgent: ua,
        viewport: { width: randInt(1000, 1400), height: randInt(700, 1000) },
        locale: 'en-US',
        javaScriptEnabled: true
    });

    const page = await context.newPage();

    try {
        // 1) Go to search engine
        await page.goto(SEARCH_ENGINE, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(()=>{});

        // 1.a) Best-effort: accept consent dialog if present
        try {
            const consentSelectors = [
                'button:has-text("I agree")',
                'button:has-text("I Agree")',
                'button:has-text("Accept all")',
                'button:has-text("Accept")',
                'text=I agree'
            ];
            for (const sel of consentSelectors) {
                const el = await page.$(sel);
                if (el) { await el.click().catch(()=>{}); await sleep(randInt(200,600)); break; }
            }
        } catch (e) { /* ignore */ }

        // 2) Type query and submit
        const qSel = 'input[name="q"], input[title="Search"], input[type="search"]';
        await page.waitForSelector(qSel, { timeout: 7000 }).catch(()=>{});
        await page.fill(qSel, keyword).catch(()=>{});
        await sleep(randInt(300, 900));
        await page.keyboard.press('Enter').catch(()=>{});

        // 3) Wait a bit, then try clicking first organic result
        await page.waitForLoadState('domcontentloaded', { timeout: 10000 }).catch(()=>{});
        await sleep(randInt(800, 2000));

        let clicked = false;
        try {
            const h3 = await page.$('h3');
            if (h3) {
                // try to find anchor parent of h3
                const linkHandle = await h3.evaluateHandle(n => {
                    let cur = n;
                    while (cur && cur.tagName && cur.tagName.toLowerCase() !== 'a') cur = cur.parentElement;
                    return cur;
                });
                if (linkHandle) {
                    const el = linkHandle.asElement();
                    if (el) {
                        await el.click({ timeout: 3000 }).catch(()=>{});
                        clicked = true;
                    }
                }
            }
        } catch (e) { /* ignore */ }

        if (clicked) {
            await page.waitForLoadState('domcontentloaded', { timeout: 10000 }).catch(()=>{});
            await sleep(randInt(1000, 2500));
        } else {
            await sleep(randInt(700, 1500));
        }

        // 4) Finally navigate to the target URL (ensures the server receives the hit)
        await page.goto(TARGET_URL, { waitUntil: 'networkidle', timeout: 30000 }).catch(()=>{});
        await sleep(randInt(1200, 3000));

        console.log(`[${id + 1}/${TOTAL_RUNS}] DONE keyword="${keyword}" ua="${ua.split(' ')[0]}"`);
    } catch (err) {
        console.error(`[${id + 1}] ERROR:`, err.message || err);
    } finally {
        try { await page.close(); } catch (e) {}
        try { await context.close(); } catch (e) {}
    }
}

// Concurrency-limited runner (reuses one browser)
async function runAll() {
    console.log(`Starting ${TOTAL_RUNS} runs with concurrency ${CONCURRENCY} ...`);
    const browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    let started = 0;
    let inFlight = 0;

    return new Promise((resolve) => {
        async function scheduleNext() {
            while (inFlight < CONCURRENCY && started < TOTAL_RUNS) {
                const id = started++;
                inFlight++;
                // kick off the run (do not await)
                runSingleVisit(id, browser)
                    .catch(e => console.error(`runSingleVisit(${id}) failed:`, e))
                    .finally(() => {
                        inFlight--;
                        // schedule more as slots free up
                        scheduleNext();
                    });
            }

            // finish condition
            if (started >= TOTAL_RUNS && inFlight === 0) {
                (async () => {
                    try { await browser.close(); } catch (e) {}
                    console.log('All runs completed. Browser closed.');
                    resolve();
                })();
            }
        }

        // start initial batch
        scheduleNext();
    });
}

(async () => {
    try {
        await runAll();
    } catch (err) {
        console.error('Fatal error:', err);
        process.exit(1);
    }
})();
