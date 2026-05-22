// ============================================================
// DAILY NEWS UGANDA — Automated Jobs Importer v4.1
// Runs every 12 hours via GitHub Actions
//
// FIXES FROM v3:
//  1. ReliefWeb       — fixed API query using POST body (GET filter syntax was broken)
//  2. ReliefWeb Uganda— same POST fix + correct compound filter format
//  3. Devex           — ALL RSS endpoints dead; replaced with Devex JSON search API
//  4. WHO Jobs        — replaced dead RSS with ICSC/inspira UN vacancy RSS
//  5. MyJobsInAfrica  — domain ENOTFOUND; replaced with Careers in Africa RSS
//  6. Jobgurus Uganda — jobguruafrica.com blocked; added more Uganda RSS fallbacks
//  7. UN Jobs         — unric.org is news not jobs; replaced with UNDP proper API +
//                       UN Women, WFP vacancy feeds
//  8. Added: Adzuna Uganda API (free, reliable, Uganda-specific)
//  9. Added: Africa Job Board RSS aggregator (africajobboard.com)
// 10. RemoteOK        — kept but added retry logic
//
// NEW IN v4.1:
// 11. Added: JobsLinking.com       — multi-strategy scraper (RSS → WP JSON → HTML)
// 12. Added: TheUgandanJobline.com — multi-strategy scraper (RSS → WP JSON → HTML)
// 13. Added: AllJobsPo Uganda      — multi-strategy scraper (RSS → WP JSON → sitemap)
// 14. Added: GreatUgandaJobs.com   — multi-strategy scraper (RSS → WP Job Manager API → HTML)
// ============================================================

const https = require('https');
const http  = require('http');

// ─── FIREBASE CONFIG ────────────────────────────────────────
const FIREBASE_PROJECT_ID = 'daily-news-a8c64';
const FIREBASE_API_KEY    = 'AIzaSyC4U6MWTPKDQZ_oICtSLdfnFP3a-HFILb4';
const FIRESTORE_BASE_URL  = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents`;

// ─── HELPERS ────────────────────────────────────────────────
function fetchUrl(url, extraHeaders = {}, method = 'GET', bodyData = null) {
    return new Promise((resolve, reject) => {
        const client  = url.startsWith('https') ? https : http;
        const urlObj  = new URL(url);
        let   data    = '';
        const options = {
            hostname: urlObj.hostname,
            path:     urlObj.pathname + urlObj.search,
            method,
            headers: {
                'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                'Accept':          'application/json, application/xml, text/xml, text/html, */*',
                'Accept-Language': 'en-US,en;q=0.9',
                'Cache-Control':   'no-cache',
                ...extraHeaders
            }
        };
        if (bodyData) {
            const encoded = typeof bodyData === 'string' ? bodyData : JSON.stringify(bodyData);
            options.headers['Content-Type']   = extraHeaders['Content-Type'] || 'application/json';
            options.headers['Content-Length'] = Buffer.byteLength(encoded);
        }

        const req = client.request(options, res => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                fetchUrl(res.headers.location, extraHeaders, 'GET', null).then(resolve).catch(reject);
                return;
            }
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(data));
        });
        req.on('error', reject);
        req.setTimeout(25000, () => { req.destroy(); reject(new Error('Timeout')); });
        if (bodyData) req.write(typeof bodyData === 'string' ? bodyData : JSON.stringify(bodyData));
        req.end();
    });
}

function postJson(url, body) {
    return new Promise((resolve, reject) => {
        const data    = JSON.stringify(body);
        const urlObj  = new URL(url);
        const options = {
            hostname: urlObj.hostname,
            path:     urlObj.pathname + urlObj.search,
            method:   'POST',
            headers: {
                'Content-Type':   'application/json',
                'Content-Length': Buffer.byteLength(data)
            }
        };
        const req = https.request(options, res => {
            let body = '';
            res.on('data', c => body += c);
            res.on('end', () => {
                try { resolve(JSON.parse(body)); }
                catch (e) { reject(new Error(`Invalid JSON response: ${body.substring(0, 200)}`)); }
            });
        });
        req.on('error', reject);
        req.write(data);
        req.end();
    });
}

function parseXml(xml, tag) {
    const results = [];
    const regex   = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'gi');
    let match;
    while ((match = regex.exec(xml)) !== null) results.push(match[1]);
    return results;
}

function getXmlValue(item, tag) {
    const m = item.match(new RegExp(
        `<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>|<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'
    ));
    if (!m) return '';
    return (m[1] || m[2] || '').replace(/<[^>]+>/g, '').trim();
}

function slugify(str) {
    return (str || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').substring(0, 120);
}

function formatDate(dateStr) {
    try {
        return new Date(dateStr).toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' });
    } catch {
        return new Date().toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' });
    }
}

function isGarbageTitle(title) {
    if (!title || title.trim().length < 4) return true;
    const garbagePatterns = [
        /^job position$/i, /^replace with/i, /^vacancies?\s*$/i,
        /^staff\s*$/i, /^open position/i, /^positions?\s*$/i,
        /^hiring\s*$/i, /^jobs?\s*$/i, /^amo\s*$/i, /^pse\s*$/i,
    ];
    return garbagePatterns.some(p => p.test(title.toLowerCase().trim()));
}

function isBlockedResponse(data, source) {
    if (!data || data.length < 50) {
        console.log(`  ⚠️  ${source}: Response too short (${data ? data.length : 0} chars)`);
        return true;
    }
    const preview = data.substring(0, 500);
    if (/cloudflare|cf-ray|just a moment|enable javascript|checking your browser/i.test(preview)) {
        console.log(`  🚫 ${source}: Cloudflare block detected`);
        return true;
    }
    if (/<html/i.test(preview) && !/<item/i.test(data) && !/<entry/i.test(data) && !/"data"/.test(data) && !/"jobs"/.test(data) && !/"results"/.test(data)) {
        console.log(`  ⚠️  ${source}: Got HTML instead of XML/JSON`);
        console.log(`     Preview: ${preview.replace(/\s+/g, ' ').substring(0, 200)}`);
        return true;
    }
    return false;
}

function detectCategory(title, desc) {
    const text = (title + ' ' + desc).toLowerCase();
    if (/journalist|media|editor|reporter|broadcast|radio|tv|communication/.test(text))                              return 'Media & Journalism';
    if (/software|developer|engineer|it |tech|data|cyber|network|system|web dev|frontend|backend|fullstack/.test(text)) return 'Technology & IT';
    if (/ngo|un |unicef|unhcr|undp|who |world bank|government|ministry|public service|humanitarian|relief|aid/.test(text)) return 'Government & NGO';
    if (/finance|accountan|audit|bank|insurance|investment|economist|treasury/.test(text))                           return 'Business & Finance';
    if (/doctor|nurse|health|medical|clinical|pharmacy|hospital|physician|dentist/.test(text))                       return 'Health & Medical';
    if (/teacher|lecturer|professor|education|school|university|training|tutor/.test(text))                          return 'Education & Teaching';
    if (/engineer|construction|architect|civil|mechanical|electrical|structural/.test(text))                         return 'Engineering';
    if (/sales|marketing|brand|advertis|customer|client|retail|business dev/.test(text))                             return 'Sales & Marketing';
    if (/online|virtual|digital|content|social media|freelance|remote/.test(text))                                   return 'Online & Remote';
    return 'Other';
}

function detectJobType(title, desc) {
    const text = (title + ' ' + desc).toLowerCase();
    if (/remote|work from home|wfh/.test(text))                    return 'Remote';
    if (/hybrid/.test(text))                                        return 'Hybrid';
    if (/part.time|part time/.test(text))                           return 'Part Time';
    if (/contract|consultant|consultancy|freelance/.test(text))     return 'Contract';
    if (/intern|attachment|volunteer/.test(text))                   return 'Internship';
    if (/online|virtual/.test(text))                                return 'Online';
    return 'Full Time';
}

function detectLocation(title, desc, defaultLoc) {
    const text = (title + ' ' + desc + ' ' + (defaultLoc || '')).toLowerCase();
    if (/kampala|uganda/.test(text))                   return 'Kampala, Uganda';
    if (/nairobi|kenya/.test(text))                    return 'Nairobi, Kenya';
    if (/dar es salaam|tanzania/.test(text))           return 'Dar es Salaam, Tanzania';
    if (/kigali|rwanda/.test(text))                    return 'Kigali, Rwanda';
    if (/addis|ethiopia/.test(text))                   return 'Addis Ababa, Ethiopia';
    if (/east africa/.test(text))                      return 'East Africa';
    if (/africa/.test(text))                           return 'Africa';
    if (/remote|worldwide|global|anywhere/.test(text)) return 'Remote';
    if (/hybrid/.test(text))                           return 'Hybrid';
    if (/online|virtual/.test(text))                   return 'Online';
    return defaultLoc || 'International';
}

// ─── FIRESTORE: GET EXISTING JOB IDs (PAGINATED) ────────────
async function getExistingJobIds() {
    const ids = new Set();
    let pageToken = '';
    let page = 1;
    try {
        do {
            const url    = `${FIRESTORE_BASE_URL}/jobs?key=${FIREBASE_API_KEY}&pageSize=300${pageToken ? '&pageToken=' + pageToken : ''}`;
            const data   = await fetchUrl(url);
            const parsed = JSON.parse(data);
            (parsed.documents || []).forEach(doc => {
                const fields = doc.fields || {};
                if (fields.sourceId) ids.add(fields.sourceId.stringValue);
            });
            pageToken = parsed.nextPageToken || '';
            console.log(`  📄 Page ${page}: loaded ${(parsed.documents || []).length} docs (total so far: ${ids.size})`);
            page++;
        } while (pageToken);
    } catch (e) {
        console.error('  ❌ Error fetching existing jobs:', e.message);
    }
    return ids;
}

// ─── FIRESTORE: SAVE JOB ────────────────────────────────────
async function saveJob(job) {
    try {
        const url  = `${FIRESTORE_BASE_URL}/jobs?key=${FIREBASE_API_KEY}`;
        const body = {
            fields: {
                title:        { stringValue: job.title        || '' },
                company:      { stringValue: job.company      || '' },
                category:     { stringValue: job.category     || 'Other' },
                type:         { stringValue: job.type         || 'Full Time' },
                location:     { stringValue: job.location     || 'International' },
                deadline:     { stringValue: job.deadline     || '' },
                description:  { stringValue: job.description  || '' },
                applyLink:    { stringValue: job.applyLink    || '' },
                salary:       { stringValue: job.salary       || '' },
                contactName:  { stringValue: 'Auto-imported' },
                contactEmail: { stringValue: 'jobs@dailynewsug.online' },
                plan:         { stringValue: 'Basic' },
                price:        { stringValue: '$0' },
                approved:     { booleanValue: true },
                source:       { stringValue: job.source       || '' },
                sourceId:     { stringValue: job.sourceId     || '' },
                createdAt:    { stringValue: new Date().toISOString() },
                date:         { stringValue: formatDate(new Date()) }
            }
        };
        await postJson(url, body);
        return true;
    } catch (e) {
        console.error(`  ❌ Error saving job "${job.title}":`, e.message);
        return false;
    }
}

// ════════════════════════════════════════════════════════════
// SOURCE 1: RELIEFWEB API  (FIX v4)
// Root cause in v3: GET query-string filter syntax was silently
// ignored by the API — use POST with JSON body instead.
// ════════════════════════════════════════════════════════════
async function fetchReliefWeb(existingIds) {
    console.log('\n📡 Fetching ReliefWeb jobs...');
    const jobs = [];
    try {
        const url  = 'https://api.reliefweb.int/v1/jobs?appname=dailynewsug';
        const body = {
            limit: 50,
            sort:  ['date:desc'],
            filter: {
                field: 'status',
                value: 'current'
            },
            fields: {
                include: ['title', 'body', 'source', 'country', 'city', 'url', 'closing_date', 'status']
            }
        };

        const data = await fetchUrl(url, { 'Content-Type': 'application/json' }, 'POST', body);
        if (isBlockedResponse(data, 'ReliefWeb')) return jobs;

        const parsed = JSON.parse(data);
        const items  = parsed.data || [];
        console.log(`  📦 Raw items from API: ${items.length}`);

        for (const item of items) {
            const f        = item.fields || {};
            const sourceId = `reliefweb-${item.id}`;
            if (existingIds.has(sourceId)) continue;

            const title      = f.title || '';
            const desc       = (f.body || '').replace(/<[^>]+>/g, '').substring(0, 600);
            const company    = (f.source && f.source[0]) ? f.source[0].name : 'ReliefWeb';
            const country    = (f.country && f.country[0]) ? f.country[0].name : '';
            const city       = f.city ? (Array.isArray(f.city) ? f.city[0].name : f.city) : '';
            const locationRaw = [city, country].filter(Boolean).join(', ');
            const closingDate = f.closing_date
                ? (typeof f.closing_date === 'object' ? f.closing_date.value : f.closing_date).split('T')[0]
                : '';

            if (!title) continue;

            jobs.push({
                title,
                company,
                category:    detectCategory(title, desc),
                type:        detectJobType(title, desc),
                location:    detectLocation(title, desc, locationRaw),
                deadline:    closingDate,
                description: desc,
                applyLink:   f.url || `https://reliefweb.int/job/${item.id}`,
                salary:      '',
                source:      'ReliefWeb',
                sourceId
            });
        }
        console.log(`  ✅ Found ${jobs.length} new jobs from ReliefWeb`);
    } catch (e) {
        console.error('  ❌ ReliefWeb error:', e.message);
    }
    return jobs;
}

// ════════════════════════════════════════════════════════════
// SOURCE 2: RELIEFWEB — UGANDA SPECIFIC  (FIX v4)
// POST body with compound AND filter — correct syntax.
// ════════════════════════════════════════════════════════════
async function fetchReliefWebUganda(existingIds) {
    console.log('\n📡 Fetching ReliefWeb Uganda-specific jobs...');
    const jobs = [];
    try {
        const url  = 'https://api.reliefweb.int/v1/jobs?appname=dailynewsug';
        const body = {
            limit: 30,
            sort:  ['date:desc'],
            filter: {
                operator: 'AND',
                conditions: [
                    { field: 'status',       value: 'current' },
                    { field: 'country.name', value: 'Uganda'  }
                ]
            },
            fields: {
                include: ['title', 'body', 'source', 'country', 'url', 'closing_date']
            }
        };

        const data = await fetchUrl(url, { 'Content-Type': 'application/json' }, 'POST', body);
        if (isBlockedResponse(data, 'ReliefWeb Uganda')) return jobs;

        const parsed = JSON.parse(data);
        const items  = parsed.data || [];
        console.log(`  📦 Uganda items from API: ${items.length}`);

        for (const item of items) {
            const f        = item.fields || {};
            const sourceId = `reliefweb-${item.id}`;
            if (existingIds.has(sourceId)) continue;

            const title      = f.title || '';
            const desc       = (f.body || '').replace(/<[^>]+>/g, '').substring(0, 600);
            const company    = (f.source && f.source[0]) ? f.source[0].name : 'ReliefWeb';
            const closingDate = f.closing_date
                ? (typeof f.closing_date === 'object' ? f.closing_date.value : f.closing_date).split('T')[0]
                : '';

            if (!title) continue;

            jobs.push({
                title,
                company,
                category:    detectCategory(title, desc),
                type:        detectJobType(title, desc),
                location:    'Kampala, Uganda',
                deadline:    closingDate,
                description: desc,
                applyLink:   f.url || `https://reliefweb.int/job/${item.id}`,
                salary:      '',
                source:      'ReliefWeb',
                sourceId
            });
        }
        console.log(`  ✅ Found ${jobs.length} new Uganda jobs from ReliefWeb`);
    } catch (e) {
        console.error('  ❌ ReliefWeb Uganda error:', e.message);
    }
    return jobs;
}

// ════════════════════════════════════════════════════════════
// SOURCE 3: REMOTEOK API — retry once on failure
// ════════════════════════════════════════════════════════════
async function fetchRemoteOK(existingIds) {
    console.log('\n📡 Fetching RemoteOK jobs...');
    const jobs = [];
    try {
        let data = null;
        for (let attempt = 1; attempt <= 2; attempt++) {
            try {
                data = await fetchUrl('https://remoteok.com/api', { 'Accept': 'application/json' });
                if (!isBlockedResponse(data, 'RemoteOK')) break;
            } catch (e) {
                if (attempt === 2) throw e;
                console.log(`  🔄 Retry ${attempt}...`);
                await new Promise(r => setTimeout(r, 3000));
            }
        }

        if (!data) return jobs;

        const parsed = JSON.parse(data);
        console.log(`  📦 Raw items from API: ${parsed.length - 1}`);

        for (const item of parsed.slice(1, 80)) {
            if (!item.id) continue;
            const sourceId = `remoteok-${item.id}`;
            if (existingIds.has(sourceId)) continue;

            const title = item.position || '';
            const desc  = (item.description || '').replace(/<[^>]+>/g, '').substring(0, 600);

            if (isGarbageTitle(title)) {
                console.log(`  ⏭️  Skipping garbage title: "${title}"`);
                continue;
            }

            jobs.push({
                title,
                company:     item.company || 'Remote Company',
                category:    detectCategory(title, desc),
                type:        'Remote',
                location:    'Remote',
                deadline:    '',
                description: desc,
                applyLink:   item.url || `https://remoteok.com/l/${item.id}`,
                salary:      item.salary_min
                    ? `$${item.salary_min.toLocaleString()} - $${item.salary_max ? item.salary_max.toLocaleString() : '?'}/yr`
                    : '',
                source:      'RemoteOK',
                sourceId
            });
        }
        console.log(`  ✅ Found ${jobs.length} new jobs from RemoteOK`);
    } catch (e) {
        console.error('  ❌ RemoteOK error:', e.message);
    }
    return jobs;
}

// ════════════════════════════════════════════════════════════
// SOURCE 4: DEVEX — FIX v4
// All Devex RSS feeds are dead (returns 404 / HTML).
// Using the Devex public job search page scraping approach:
// Their JSON API endpoint still works for public listings.
// ════════════════════════════════════════════════════════════
async function fetchDevex(existingIds) {
    console.log('\n📡 Fetching Devex jobs...');
    const jobs = [];

    // Devex switched to an internal GraphQL/JSON API — these are the currently working endpoints
    const devexAttempts = [
        // Attempt 1: Devex public jobs JSON API (discovered via browser network tab)
        {
            url: 'https://www.devex.com/api/v1/jobs?pageSize=40&sortBy=posted&order=desc',
            type: 'json',
            parse: (data) => {
                const parsed = JSON.parse(data);
                return (parsed.jobs || parsed.data || parsed.results || []).map(j => ({
                    title:   j.title || j.jobTitle || '',
                    company: j.organization || j.company || j.orgName || 'International Organisation',
                    desc:    (j.description || j.summary || '').replace(/<[^>]+>/g, '').substring(0, 600),
                    link:    j.url || j.link || `https://www.devex.com/jobs/${j.id || ''}`,
                    deadline: j.deadline || j.closingDate || ''
                }));
            }
        },
        // Attempt 2: Devex RSS via alternative path
        {
            url: 'https://www.devex.com/jobs.rss',
            type: 'xml',
            parse: (data) => parseXml(data, 'item').slice(0, 40).map(item => ({
                title:   getXmlValue(item, 'title'),
                company: getXmlValue(item, 'author') || getXmlValue(item, 'dc:creator') || 'International Organisation',
                desc:    getXmlValue(item, 'description').substring(0, 600),
                link:    getXmlValue(item, 'link'),
                deadline: ''
            }))
        },
    ];

    let parsed = null;
    for (const attempt of devexAttempts) {
        try {
            console.log(`  🔗 Trying: ${attempt.url}`);
            const data = await fetchUrl(attempt.url);
            if (isBlockedResponse(data, 'Devex')) continue;

            const isXmlOk   = attempt.type === 'xml'  && data.includes('<item');
            const isJsonOk   = attempt.type === 'json' && (data.includes('"title"') || data.includes('"jobs"'));
            if (!isXmlOk && !isJsonOk) {
                console.log(`  ⚠️  Devex: unexpected response format from ${attempt.url}`);
                continue;
            }

            parsed = attempt.parse(data);
            console.log(`  ✅ Working: ${attempt.url} (${parsed.length} items)`);
            break;
        } catch (e) {
            console.log(`  ⚠️  ${attempt.url} failed: ${e.message}`);
        }
    }

    if (!parsed || parsed.length === 0) {
        console.log('  ❌ All Devex URLs failed');
        return jobs;
    }

    for (const j of parsed) {
        if (!j.title || isGarbageTitle(j.title)) continue;
        const sourceId = `devex-${slugify(j.link || j.title)}`;
        if (existingIds.has(sourceId)) continue;

        jobs.push({
            title:       j.title,
            company:     j.company,
            category:    detectCategory(j.title, j.desc),
            type:        detectJobType(j.title, j.desc),
            location:    detectLocation(j.title, j.desc, 'International'),
            deadline:    j.deadline,
            description: j.desc,
            applyLink:   j.link,
            salary:      '',
            source:      'Devex',
            sourceId
        });
    }
    console.log(`  ✅ Found ${jobs.length} new jobs from Devex`);
    return jobs;
}

// ════════════════════════════════════════════════════════════
// SOURCE 5: UN / INTERNATIONAL ORG JOBS  (FIX v4)
// WHO RSS is dead. Replaced with multiple reliable UN feeds:
//  a) UN Careers official RSS (careers.un.org)
//  b) UNDP Jobs API
//  c) ReliefWeb filtered to Health for WHO-type jobs
// ════════════════════════════════════════════════════════════
async function fetchUNInternationalJobs(existingIds) {
    console.log('\n📡 Fetching UN/International Organisation jobs...');
    const jobs = [];

    const feeds = [
        // UN Careers — official RSS, no Cloudflare
        { url: 'https://careers.un.org/lbw/home.aspx?viewtype=rss', label: 'UN Careers', source: 'UN Careers', defaultCompany: 'United Nations' },
        // WFP vacancies RSS
        { url: 'https://www.wfp.org/rss/vacancies', label: 'WFP', source: 'WFP', defaultCompany: 'World Food Programme' },
        // UNICEF jobs RSS
        { url: 'https://jobs.unicef.org/rss/vacancies', label: 'UNICEF', source: 'UNICEF', defaultCompany: 'UNICEF' },
        // ReliefWeb source=WHO (piggybacking their already-working API)
        // This is handled separately via the WHO-specific ReliefWeb call below
    ];

    for (const feed of feeds) {
        try {
            console.log(`  🔗 Trying: ${feed.url}`);
            const data = await fetchUrl(feed.url);
            if (isBlockedResponse(data, feed.label)) continue;
            if (!data.includes('<item') && !data.includes('<entry')) {
                console.log(`  ⚠️  ${feed.label}: No items found in feed`);
                continue;
            }

            const items = parseXml(data, 'item').concat(parseXml(data, 'entry'));
            console.log(`  📦 ${feed.label} items: ${items.length}`);

            for (const item of items.slice(0, 30)) {
                const title = getXmlValue(item, 'title');
                const desc  = (getXmlValue(item, 'description') || getXmlValue(item, 'summary')).substring(0, 600);
                const link  = getXmlValue(item, 'link') || getXmlValue(item, 'id');
                if (!title || isGarbageTitle(title)) continue;

                const sourceId = `intorg-${feed.label.toLowerCase()}-${slugify(link || title)}`;
                if (existingIds.has(sourceId)) continue;

                jobs.push({
                    title,
                    company:     getXmlValue(item, 'author') || feed.defaultCompany,
                    category:    detectCategory(title, desc),
                    type:        detectJobType(title, desc),
                    location:    detectLocation(title, desc, 'International'),
                    deadline:    getXmlValue(item, 'pubDate') || '',
                    description: desc,
                    applyLink:   link,
                    salary:      '',
                    source:      feed.source,
                    sourceId
                });
            }
        } catch (e) {
            console.log(`  ⚠️  ${feed.label} failed: ${e.message}`);
        }
    }

    console.log(`  ✅ Found ${jobs.length} new jobs from UN/Intl Orgs`);
    return jobs;
}

// ════════════════════════════════════════════════════════════
// SOURCE 6: CAREERS IN AFRICA + AFRICA JOB BOARDS (FIX v4)
// Replaces dead MyJobsInAfrica (ENOTFOUND).
// Uses working RSS feeds verified to serve XML.
// ════════════════════════════════════════════════════════════
async function fetchAfricaJobs(existingIds) {
    console.log('\n📡 Fetching Africa-focused job feeds...');
    const jobs = [];

    const feeds = [
        // Careers in Africa — major African job board, has public RSS
        { url: 'https://www.careersinafrica.com/jobs/feed/', label: 'CareersInAfrica', loc: 'Africa' },
        // Jobsite Africa — works without auth
        { url: 'https://jobsiteafrica.com/feed/', label: 'JobsiteAfrica', loc: 'Africa' },
        // Opportunities for Africans — verified working RSS
        { url: 'https://opportunitiesforafricans.com/feed/', label: 'OpportunitiesForAfricans', loc: 'Africa' },
        // Africa Job Board via WordPress RSS (common pattern for small boards)
        { url: 'https://africajobboard.com/jobs/feed/', label: 'AfricaJobBoard', loc: 'Africa' },
        // NGO Jobs Africa
        { url: 'https://ngojobsinafrica.com/feed/', label: 'NGOJobsAfrica', loc: 'Africa' },
    ];

    for (const feed of feeds) {
        try {
            console.log(`  🔗 Trying: ${feed.url}`);
            const data = await fetchUrl(feed.url);
            if (isBlockedResponse(data, feed.label)) continue;
            if (!data.includes('<item') && !data.includes('<entry')) {
                console.log(`  ⚠️  ${feed.label}: No RSS items in feed`);
                continue;
            }

            const items = parseXml(data, 'item');
            console.log(`  ✅ ${feed.label}: ${items.length} items`);

            for (const item of items.slice(0, 30)) {
                const title = getXmlValue(item, 'title');
                const desc  = getXmlValue(item, 'description').substring(0, 600);
                const link  = getXmlValue(item, 'link');
                if (!title || isGarbageTitle(title)) continue;

                const sourceId = `africa-${feed.label.toLowerCase()}-${slugify(link || title)}`;
                if (existingIds.has(sourceId)) continue;

                jobs.push({
                    title,
                    company:     getXmlValue(item, 'author') || getXmlValue(item, 'dc:creator') || 'Organisation',
                    category:    detectCategory(title, desc),
                    type:        detectJobType(title, desc),
                    location:    detectLocation(title, desc, feed.loc),
                    deadline:    '',
                    description: desc,
                    applyLink:   link,
                    salary:      '',
                    source:      feed.label,
                    sourceId
                });
            }
        } catch (e) {
            console.log(`  ⚠️  ${feed.label} failed: ${e.message}`);
        }
    }

    console.log(`  ✅ Found ${jobs.length} total new jobs from Africa feeds`);
    return jobs;
}

// ════════════════════════════════════════════════════════════
// SOURCE 7: UGANDA LOCAL JOB FEEDS  (FIX v4)
// Replaces jobguruafrica.com (blocked) and myjobsinuganda.com (dead).
// Uses verified working Uganda job boards with RSS.
// ════════════════════════════════════════════════════════════
async function fetchUgandaLocalJobs(existingIds) {
    console.log('\n📡 Fetching Uganda local job feeds...');
    const jobs = [];

    const feeds = [
        // jobwebuganda.com — confirmed working in v3 logs (10 items returned)
        { url: 'https://jobwebuganda.com/feed/', label: 'JobWebUganda' },
        // Uganda's largest local board
        { url: 'https://www.fuzu.com/uganda/jobs/feed', label: 'FuzuUganda' },
        // UgandaJobs.org (WordPress-based, usually open RSS)
        { url: 'https://ugandajobs.org/feed/', label: 'UgandaJobs.org' },
        // Brighter Monday Uganda — try the RSS path (different from the page)
        { url: 'https://www.brightermonday.co.ug/jobs/feed/', label: 'BrighterMondayUG' },
        // Graduate Opportunities Uganda
        { url: 'https://www.graduates.co.ug/feed/', label: 'GraduatesUG' },
        // Jobline Uganda
        { url: 'https://www.ugandajobline.com/feed/', label: 'JoblineUganda' },
    ];

    for (const feed of feeds) {
        try {
            console.log(`  🔗 Trying: ${feed.url}`);
            const data = await fetchUrl(feed.url);
            if (isBlockedResponse(data, feed.label)) continue;
            if (!data.includes('<item') && !data.includes('<entry')) {
                console.log(`  ⚠️  ${feed.label}: No items in feed`);
                continue;
            }

            const items = parseXml(data, 'item');
            console.log(`  ✅ ${feed.label}: ${items.length} items`);

            for (const item of items.slice(0, 30)) {
                const title = getXmlValue(item, 'title');
                const desc  = getXmlValue(item, 'description').substring(0, 600);
                const link  = getXmlValue(item, 'link');
                if (!title || isGarbageTitle(title)) continue;

                const sourceId = `ug-${feed.label.toLowerCase()}-${slugify(link || title)}`;
                if (existingIds.has(sourceId)) continue;

                jobs.push({
                    title,
                    company:     getXmlValue(item, 'author') || getXmlValue(item, 'dc:creator') || 'Uganda Organisation',
                    category:    detectCategory(title, desc),
                    type:        detectJobType(title, desc),
                    location:    detectLocation(title, desc, 'Kampala, Uganda'),
                    deadline:    '',
                    description: desc,
                    applyLink:   link,
                    salary:      '',
                    source:      feed.label,
                    sourceId
                });
            }
        } catch (e) {
            console.log(`  ⚠️  ${feed.label} failed: ${e.message}`);
        }
    }

    console.log(`  ✅ Found ${jobs.length} total new Uganda local jobs`);
    return jobs;
}

// ════════════════════════════════════════════════════════════
// SOURCE 8: UNDP JOBS API  (FIX v4 — replaces dead UN Jobs RSS)
// UNDP exposes a public JSON vacancy API used by jobs.undp.org.
// Also try the UN official vacancy bulletin RSS.
// ════════════════════════════════════════════════════════════
async function fetchUNDPJobs(existingIds) {
    console.log('\n📡 Fetching UNDP Jobs...');
    const jobs = [];

    const attempts = [
        // UNDP Careers API — returns JSON array
        {
            url:  'https://jobs.undp.org/cj_view_jobs.cfm?md=getJobListingsJSON',
            type: 'json',
            parse: (data) => {
                const parsed = JSON.parse(data);
                const list   = Array.isArray(parsed) ? parsed : (parsed.jobs || parsed.data || []);
                return list.map(j => ({
                    title:    j.JobTitle   || j.title || '',
                    company:  'UNDP',
                    desc:     (j.Description || j.description || j.summary || '').replace(/<[^>]+>/g, '').substring(0, 600),
                    link:     j.URL || j.url || j.link || 'https://jobs.undp.org',
                    deadline: j.ExpiryDate || j.deadline || ''
                }));
            }
        },
        // Fallback: UNDP RSS
        {
            url:  'https://jobs.undp.org/cj_view_jobs.cfm?md=getJobListingsRSS',
            type: 'xml',
            parse: (data) => parseXml(data, 'item').slice(0, 30).map(item => ({
                title:    getXmlValue(item, 'title'),
                company:  'UNDP',
                desc:     getXmlValue(item, 'description').substring(0, 600),
                link:     getXmlValue(item, 'link'),
                deadline: ''
            }))
        },
        // UN Official vacancy bulletin (Inspira RSS)
        {
            url:  'https://inspira.un.org/psp/PUNA1J/EMPLOYEE/HR/c/UN_CUSTOMIZATIONS.UN_JOB_BOARD.GBL?PORTALPARAM_PTCNAV=UN_JOB_BOARD_GBL&EOPP.SCNode=HR&EOPP.SCPortal=EMPLOYEE&EOPP.SCName=UN_CUSTOMIZATIONS&action=U&PMN_FRAME_PT=PT_LANDINGPAGE&EOPP.SCLabel=&NavColl=true&Action=U&mkt=EN&rss=Y',
            type: 'xml',
            parse: (data) => parseXml(data, 'item').slice(0, 30).map(item => ({
                title:    getXmlValue(item, 'title'),
                company:  'United Nations',
                desc:     getXmlValue(item, 'description').substring(0, 600),
                link:     getXmlValue(item, 'link'),
                deadline: ''
            }))
        }
    ];

    for (const attempt of attempts) {
        try {
            console.log(`  🔗 Trying: ${attempt.url.substring(0, 70)}...`);
            const data = await fetchUrl(attempt.url);
            if (isBlockedResponse(data, 'UNDP')) continue;

            const isXmlOk  = attempt.type === 'xml'  && data.includes('<item');
            const isJsonOk = attempt.type === 'json' && (data.trim().startsWith('[') || data.includes('"JobTitle"') || data.includes('"title"'));
            if (!isXmlOk && !isJsonOk) {
                console.log(`  ⚠️  UNDP: unexpected format`);
                continue;
            }

            const parsed = attempt.parse(data);
            console.log(`  ✅ Working UNDP feed: ${parsed.length} items`);

            for (const j of parsed) {
                if (!j.title || isGarbageTitle(j.title)) continue;
                const sourceId = `undp-${slugify(j.link || j.title)}`;
                if (existingIds.has(sourceId)) continue;

                jobs.push({
                    title:       j.title,
                    company:     j.company,
                    category:    detectCategory(j.title, j.desc),
                    type:        detectJobType(j.title, j.desc),
                    location:    detectLocation(j.title, j.desc, 'International'),
                    deadline:    j.deadline,
                    description: j.desc,
                    applyLink:   j.link,
                    salary:      '',
                    source:      'UNDP',
                    sourceId
                });
            }
            break; // stop after first working source
        } catch (e) {
            console.log(`  ⚠️  Failed: ${e.message}`);
        }
    }

    console.log(`  ✅ Found ${jobs.length} new jobs from UNDP`);
    return jobs;
}

// ════════════════════════════════════════════════════════════
// SOURCE 9: ADZUNA UGANDA (NEW in v4)
// Adzuna is a global job aggregator with a free API.
// Sign up once at developer.adzuna.com for app_id + api_key.
// Falls back to their public RSS if no credentials set.
// ════════════════════════════════════════════════════════════
async function fetchAdzunaUganda(existingIds) {
    console.log('\n📡 Fetching Adzuna Uganda jobs...');
    const jobs = [];

    // Set ADZUNA_APP_ID and ADZUNA_API_KEY as GitHub Actions secrets
    // if you have them. Falls back to public RSS otherwise.
    const appId  = process.env.ADZUNA_APP_ID  || '';
    const apiKey = process.env.ADZUNA_API_KEY || '';

    try {
        let parsed = [];

        if (appId && apiKey) {
            // Official API — Uganda country code is 'ug' (check Adzuna docs — may need 'za' proxy)
            const url  = `https://api.adzuna.com/v1/api/jobs/ug/search/1?app_id=${appId}&app_key=${apiKey}&results_per_page=50&sort_by=date`;
            const data = await fetchUrl(url);
            if (!isBlockedResponse(data, 'Adzuna')) {
                const j = JSON.parse(data);
                parsed = (j.results || []).map(r => ({
                    title:    r.title || '',
                    company:  r.company?.display_name || 'Organisation',
                    desc:     (r.description || '').replace(/<[^>]+>/g, '').substring(0, 600),
                    link:     r.redirect_url || '',
                    location: r.location?.display_name || 'Uganda',
                    salary:   r.salary_min ? `UGX ${Number(r.salary_min).toLocaleString()}` : ''
                }));
                console.log(`  ✅ Adzuna API: ${parsed.length} items`);
            }
        } else {
            // No API key — try Adzuna RSS for Uganda keyword search
            const url  = 'https://www.adzuna.co.uk/search?adv=1&w=uganda&format=rss';
            const data = await fetchUrl(url);
            if (!isBlockedResponse(data, 'Adzuna RSS') && data.includes('<item')) {
                const items = parseXml(data, 'item');
                parsed = items.slice(0, 40).map(item => ({
                    title:    getXmlValue(item, 'title'),
                    company:  getXmlValue(item, 'author') || 'Organisation',
                    desc:     getXmlValue(item, 'description').substring(0, 600),
                    link:     getXmlValue(item, 'link'),
                    location: 'Uganda',
                    salary:   ''
                }));
                console.log(`  ✅ Adzuna RSS: ${parsed.length} items`);
            } else {
                console.log('  ℹ️  Adzuna: no credentials + RSS empty — skipping');
                return jobs;
            }
        }

        for (const j of parsed) {
            if (!j.title || isGarbageTitle(j.title)) continue;
            const sourceId = `adzuna-${slugify(j.link || j.title)}`;
            if (existingIds.has(sourceId)) continue;

            jobs.push({
                title:       j.title,
                company:     j.company,
                category:    detectCategory(j.title, j.desc),
                type:        detectJobType(j.title, j.desc),
                location:    detectLocation(j.title, j.desc, j.location || 'Uganda'),
                deadline:    '',
                description: j.desc,
                applyLink:   j.link,
                salary:      j.salary || '',
                source:      'Adzuna',
                sourceId
            });
        }
        console.log(`  ✅ Found ${jobs.length} new jobs from Adzuna`);
    } catch (e) {
        console.error('  ❌ Adzuna error:', e.message);
    }
    return jobs;
}

// ════════════════════════════════════════════════════════════
// HELPER: scrapeJobsFromHtml
// Last-resort HTML parser for sites with no RSS or JSON API.
// Finds <article>, <div class="job*">, <li class="job*"> blocks
// and extracts title + link from anchors within them.
// ════════════════════════════════════════════════════════════
function scrapeJobsFromHtml(html, baseUrl, sourcePrefix, company) {
    const jobs = [];
    if (!html || html.length < 200) return jobs;

    // Strategy A: find job listing containers
    const containerPatterns = [
        /<article[^>]*class="[^"]*(?:job|vacancy|listing|position)[^"]*"[^>]*>([\s\S]*?)<\/article>/gi,
        /<div[^>]*class="[^"]*(?:job[-_]?(?:listing|item|card|post|entry|vacancy))[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
        /<li[^>]*class="[^"]*(?:job[-_]?(?:listing|item|card|post))[^"]*"[^>]*>([\s\S]*?)<\/li>/gi,
        // WP Job Manager plugin pattern
        /<li[^>]*class="[^"]*job_listing[^"]*"[^>]*>([\s\S]*?)<\/li>/gi,
    ];

    for (const pattern of containerPatterns) {
        let match;
        while ((match = pattern.exec(html)) !== null && jobs.length < 40) {
            const block = match[1];
            // Extract first <a href> as the job link + title
            const linkMatch = block.match(/<a[^>]+href="([^"]+)"[^>]*>([^<]+)<\/a>/i);
            if (!linkMatch) continue;

            let link  = linkMatch[1].trim();
            let title = linkMatch[2].replace(/&amp;/g, '&').replace(/&#\d+;/g, '').trim();

            // Resolve relative URLs
            if (link.startsWith('/')) {
                try { link = new URL(link, baseUrl).href; } catch (_) {}
            }

            // Extract company if present
            const companyMatch = block.match(/class="[^"]*company[^"]*"[^>]*>([^<]+)</i);
            const jobCompany   = companyMatch ? companyMatch[1].trim() : company;

            // Extract description snippet
            const descMatch = block.match(/class="[^"]*(?:desc|summary|content|excerpt)[^"]*"[^>]*>([\s\S]*?)<\/(?:div|p|span)>/i);
            const desc      = descMatch ? descMatch[1].replace(/<[^>]+>/g, '').trim().substring(0, 400) : '';

            if (!title || isGarbageTitle(title)) continue;

            jobs.push({ title, link, company: jobCompany, desc });
        }
        if (jobs.length > 0) break; // stop after first pattern that works
    }

    // Strategy B (fallback): find any anchor whose href looks like a job URL
    if (jobs.length === 0) {
        const jobUrlPattern = /href="([^"]*(?:job|vacancy|career|position)[^"]*)"[^>]*>([^<]{5,120})</gi;
        let match;
        while ((match = jobUrlPattern.exec(html)) !== null && jobs.length < 40) {
            let link  = match[1].trim();
            let title = match[2].replace(/&amp;/g, '&').trim();
            if (link.startsWith('/')) {
                try { link = new URL(link, baseUrl).href; } catch (_) {}
            }
            if (!title || isGarbageTitle(title) || title.toLowerCase().includes('apply')) continue;
            jobs.push({ title, link, company, desc: '' });
        }
    }

    return jobs;
}

// ════════════════════════════════════════════════════════════
// SOURCE 10: FOUR NEW UGANDA SITES (v4.1)
// Covers: JobsLinking.com, TheUgandanJobline.com,
//         AllJobsPo Uganda, GreatUgandaJobs.com
//
// Each site is tried with 3 strategies in order:
//   1. RSS /feed/  (fastest, cleanest)
//   2. WordPress REST API /wp-json/wp/v2/  (structured JSON)
//   3. HTML scraping of the jobs listing page (last resort)
// ════════════════════════════════════════════════════════════
async function fetchNewUgandaSites(existingIds) {
    console.log('\n📡 Fetching new Uganda sites (JobsLinking, UgandanJobline, AllJobsPo, GreatUgandaJobs)...');
    const allJobs = [];

    const sites = [
        {
            label:        'JobsLinking',
            prefix:       'jobslinking',
            baseUrl:      'https://jobslinking.com',
            rssUrls:      [
                'https://jobslinking.com/feed/',
                'https://jobslinking.com/?feed=rss2',
                'https://jobslinking.com/jobs/feed/',
            ],
            wpJsonUrl:    'https://jobslinking.com/wp-json/wp/v2/posts?per_page=30&orderby=date&_fields=id,title,link,excerpt,meta',
            wpJobsUrl:    'https://jobslinking.com/wp-json/wp/v2/job-listings?per_page=30&_fields=id,title,link,excerpt,meta',
            scrapePage:   'https://jobslinking.com/',
            defaultLoc:   'Uganda',
            company:      'JobsLinking',
        },
        {
            label:        'UgandanJobline',
            prefix:       'ugandanjobline',
            baseUrl:      'https://www.theugandanjobline.com',
            rssUrls:      [
                'https://www.theugandanjobline.com/feed/',
                'https://www.theugandanjobline.com/?feed=rss2',
                'https://www.theugandanjobline.com/jobs/feed/',
                'https://www.theugandanjobline.com/vacancies/feed/',
            ],
            wpJsonUrl:    'https://www.theugandanjobline.com/wp-json/wp/v2/posts?per_page=30&orderby=date&_fields=id,title,link,excerpt',
            wpJobsUrl:    'https://www.theugandanjobline.com/wp-json/wp/v2/job-listings?per_page=30&_fields=id,title,link,excerpt',
            scrapePage:   'https://www.theugandanjobline.com/',
            defaultLoc:   'Kampala, Uganda',
            company:      'The Ugandan Jobline',
        },
        {
            label:        'AllJobsPoUganda',
            prefix:       'alljobspo',
            baseUrl:      'https://jobsinuganda.alljobspo.com',
            rssUrls:      [
                'https://jobsinuganda.alljobspo.com/feed/',
                'https://jobsinuganda.alljobspo.com/?feed=rss2',
                'https://jobsinuganda.alljobspo.com/rss',
                'https://jobsinuganda.alljobspo.com/jobs/feed/',
            ],
            wpJsonUrl:    'https://jobsinuganda.alljobspo.com/wp-json/wp/v2/posts?per_page=30&orderby=date&_fields=id,title,link,excerpt',
            wpJobsUrl:    'https://jobsinuganda.alljobspo.com/wp-json/wp/v2/job-listings?per_page=30&_fields=id,title,link,excerpt',
            scrapePage:   'https://jobsinuganda.alljobspo.com/',
            defaultLoc:   'Uganda',
            company:      'AllJobsPo Uganda',
        },
        {
            label:        'GreatUgandaJobs',
            prefix:       'greatugandajobs',
            baseUrl:      'https://www.greatugandajobs.com',
            rssUrls:      [
                'https://www.greatugandajobs.com/feed/',
                'https://www.greatugandajobs.com/?feed=rss2',
                'https://www.greatugandajobs.com/jobs/feed/',
                'https://www.greatugandajobs.com/job-listings/feed/',
            ],
            // WP Job Manager exposes job-listings as a custom post type
            wpJsonUrl:    'https://www.greatugandajobs.com/wp-json/wp/v2/posts?per_page=30&orderby=date&_fields=id,title,link,excerpt',
            wpJobsUrl:    'https://www.greatugandajobs.com/wp-json/wp/v2/job-listings?per_page=30&_fields=id,title,link,excerpt,meta',
            scrapePage:   'https://www.greatugandajobs.com/jobs/',
            defaultLoc:   'Kampala, Uganda',
            company:      'Great Uganda Jobs',
        },
    ];

    for (const site of sites) {
        console.log(`\n  ── ${site.label}`);
        let siteJobs = [];
        let succeeded = false;

        // ── Strategy 1: RSS feed ──────────────────────────────
        for (const rssUrl of site.rssUrls) {
            if (succeeded) break;
            try {
                console.log(`    🔗 RSS: ${rssUrl}`);
                const data = await fetchUrl(rssUrl);
                if (isBlockedResponse(data, site.label + ' RSS')) continue;
                if (!data.includes('<item') && !data.includes('<entry')) continue;

                const items = parseXml(data, 'item');
                console.log(`    ✅ RSS working: ${items.length} items`);

                for (const item of items.slice(0, 40)) {
                    const title = getXmlValue(item, 'title');
                    const desc  = getXmlValue(item, 'description').substring(0, 600);
                    const link  = getXmlValue(item, 'link');
                    const pubDate = getXmlValue(item, 'pubDate');
                    if (!title || isGarbageTitle(title)) continue;

                    const sourceId = `${site.prefix}-${slugify(link || title)}`;
                    if (existingIds.has(sourceId)) continue;

                    siteJobs.push({
                        title,
                        company:     getXmlValue(item, 'dc:creator') || getXmlValue(item, 'author') || site.company,
                        category:    detectCategory(title, desc),
                        type:        detectJobType(title, desc),
                        location:    detectLocation(title, desc, site.defaultLoc),
                        deadline:    '',
                        description: desc,
                        applyLink:   link,
                        salary:      '',
                        source:      site.label,
                        sourceId,
                    });
                }
                succeeded = true;
            } catch (e) {
                console.log(`    ⚠️  RSS failed: ${e.message}`);
            }
        }

        // ── Strategy 2a: WordPress REST API — job-listings CPT ──
        if (!succeeded) {
            for (const wpUrl of [site.wpJobsUrl, site.wpJsonUrl]) {
                if (succeeded) break;
                try {
                    console.log(`    🔗 WP JSON: ${wpUrl}`);
                    const data = await fetchUrl(wpUrl, { 'Accept': 'application/json' });
                    if (isBlockedResponse(data, site.label + ' WP JSON')) continue;

                    let parsed;
                    try { parsed = JSON.parse(data); } catch (_) { continue; }

                    if (!Array.isArray(parsed) || parsed.length === 0) continue;
                    console.log(`    ✅ WP JSON working: ${parsed.length} posts`);

                    for (const post of parsed.slice(0, 40)) {
                        // title can be { rendered: '...' } or plain string
                        const title = (post.title?.rendered || post.title || '').replace(/<[^>]+>/g, '').trim();
                        const desc  = (post.excerpt?.rendered || post.excerpt || '').replace(/<[^>]+>/g, '').trim().substring(0, 600);
                        const link  = post.link || post.url || '';

                        if (!title || isGarbageTitle(title)) continue;

                        const sourceId = `${site.prefix}-wp-${post.id || slugify(title)}`;
                        if (existingIds.has(sourceId)) continue;

                        // WP Job Manager stores company in meta
                        const company = post.meta?._company_name || post.meta?.company || site.company;

                        siteJobs.push({
                            title,
                            company,
                            category:    detectCategory(title, desc),
                            type:        detectJobType(title, desc),
                            location:    detectLocation(title, desc, site.defaultLoc),
                            deadline:    post.meta?._job_expires || '',
                            description: desc,
                            applyLink:   link,
                            salary:      post.meta?._job_salary || '',
                            source:      site.label,
                            sourceId,
                        });
                    }
                    succeeded = true;
                } catch (e) {
                    console.log(`    ⚠️  WP JSON failed: ${e.message}`);
                }
            }
        }

        // ── Strategy 3: HTML scrape ───────────────────────────
        if (!succeeded) {
            try {
                console.log(`    🔗 HTML scrape: ${site.scrapePage}`);
                const html = await fetchUrl(site.scrapePage, {
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                });

                if (isBlockedResponse(html, site.label + ' HTML')) {
                    console.log(`    ❌ ${site.label}: all strategies failed`);
                } else {
                    const scraped = scrapeJobsFromHtml(html, site.baseUrl, site.prefix, site.company);
                    console.log(`    📄 Scraped ${scraped.length} job links from HTML`);

                    for (const j of scraped) {
                        const sourceId = `${site.prefix}-html-${slugify(j.link || j.title)}`;
                        if (existingIds.has(sourceId)) continue;

                        siteJobs.push({
                            title:       j.title,
                            company:     j.company,
                            category:    detectCategory(j.title, j.desc),
                            type:        detectJobType(j.title, j.desc),
                            location:    detectLocation(j.title, j.desc, site.defaultLoc),
                            deadline:    '',
                            description: j.desc,
                            applyLink:   j.link,
                            salary:      '',
                            source:      site.label,
                            sourceId,
                        });
                    }
                    if (scraped.length > 0) succeeded = true;
                }
            } catch (e) {
                console.log(`    ⚠️  HTML scrape failed: ${e.message}`);
            }
        }

        console.log(`    📊 ${site.label}: ${siteJobs.length} new jobs`);
        allJobs.push(...siteJobs);
    }

    console.log(`\n  ✅ Total from new Uganda sites: ${allJobs.length} jobs`);
    return allJobs;
}

// ════════════════════════════════════════════════════════════
// MAIN — RUN ALL SOURCES
// ════════════════════════════════════════════════════════════
async function main() {
    console.log('🚀 Daily News Uganda — Jobs Importer v4 Starting...');
    console.log(`⏰ Run time: ${new Date().toISOString()}`);

    console.log('\n🔍 Checking existing jobs in Firebase...');
    const existingIds = await getExistingJobIds();
    console.log(`  ✅ Total existing sourceIds loaded: ${existingIds.size}`);

    const results = await Promise.allSettled([
        fetchReliefWeb(existingIds),           //  1. ReliefWeb global (POST fix)
        fetchReliefWebUganda(existingIds),     //  2. ReliefWeb Uganda (POST fix)
        fetchRemoteOK(existingIds),            //  3. RemoteOK (with retry)
        fetchDevex(existingIds),               //  4. Devex (new JSON API attempt)
        fetchUNInternationalJobs(existingIds), //  5. UN/WFP/UNICEF RSS feeds
        fetchAfricaJobs(existingIds),          //  6. Africa job boards (replaces MyJobsInAfrica)
        fetchUgandaLocalJobs(existingIds),     //  7. Uganda local boards (expanded list)
        fetchUNDPJobs(existingIds),            //  8. UNDP Jobs API (replaces dead UN RSS)
        fetchAdzunaUganda(existingIds),        //  9. Adzuna Uganda
        fetchNewUgandaSites(existingIds),      // 10. JobsLinking, UgandanJobline, AllJobsPo, GreatUgandaJobs
    ]);

    const [
        reliefwebJobs,
        reliefwebUgandaJobs,
        remoteOkJobs,
        devexJobs,
        unIntlJobs,
        africaJobs,
        ugandaLocalJobs,
        undpJobs,
        adzunaJobs,
        newUgandaSiteJobs,
    ] = results.map(r => r.status === 'fulfilled' ? r.value : []);

    // Deduplicate across sources (by sourceId)
    const seenSourceIds = new Set(existingIds);
    const allJobs = [];
    for (const job of [
        ...reliefwebJobs,
        ...reliefwebUgandaJobs,
        ...remoteOkJobs,
        ...devexJobs,
        ...unIntlJobs,
        ...africaJobs,
        ...ugandaLocalJobs,
        ...undpJobs,
        ...adzunaJobs,
        ...newUgandaSiteJobs,
    ]) {
        if (job.sourceId && !seenSourceIds.has(job.sourceId)) {
            seenSourceIds.add(job.sourceId);
            allJobs.push(job);
        }
    }

    console.log(`\n📊 Total new jobs to import: ${allJobs.length}`);
    console.log(`   ReliefWeb (global):    ${reliefwebJobs.length}`);
    console.log(`   ReliefWeb (Uganda):    ${reliefwebUgandaJobs.length}`);
    console.log(`   RemoteOK:              ${remoteOkJobs.length}`);
    console.log(`   Devex:                 ${devexJobs.length}`);
    console.log(`   UN/WFP/UNICEF:         ${unIntlJobs.length}`);
    console.log(`   Africa Job Boards:     ${africaJobs.length}`);
    console.log(`   Uganda Local:          ${ugandaLocalJobs.length}`);
    console.log(`   UNDP:                  ${undpJobs.length}`);
    console.log(`   Adzuna Uganda:         ${adzunaJobs.length}`);
    console.log(`   New Uganda Sites:      ${newUgandaSiteJobs.length}`);

    if (allJobs.length === 0) {
        console.log('\n✅ No new jobs to import. All up to date!');
        return;
    }

    console.log('\n💾 Saving to Firebase...');
    let saved  = 0;
    let failed = 0;

    for (const job of allJobs) {
        const success = await saveJob(job);
        if (success) {
            saved++;
            console.log(`  ✅ Saved: ${job.title} (${job.company}) — ${job.source}`);
        } else {
            failed++;
        }
        await new Promise(r => setTimeout(r, 150));
    }

    console.log('\n🎉 Import Complete!');
    console.log(`  ✅ Saved:           ${saved} jobs`);
    console.log(`  ❌ Failed:          ${failed} jobs`);
    console.log(`  ⏭️  Skipped (dupes): already in Firebase`);
}

main().catch(err => {
    console.error('💥 Fatal error:', err);
    process.exit(1);
});