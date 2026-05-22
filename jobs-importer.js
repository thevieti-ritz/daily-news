// ============================================================
// DAILY NEWS UGANDA — Automated Jobs Importer
// Runs every 12 hours via GitHub Actions
// Fetches from: ReliefWeb, UN Jobs, RemoteOK, Indeed Uganda, Devex
// Pushes directly to Firebase with approved: true
// ============================================================

const https = require('https');
const http = require('http');

// ─── FIREBASE CONFIG ────────────────────────────────────────
const FIREBASE_PROJECT_ID = 'daily-news-a8c64';
const FIREBASE_API_KEY    = 'AIzaSyC4U6MWTPKDQZ_oICtSLdfnFP3a-HFILb4';
const FIRESTORE_BASE_URL  = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents`;

// ─── HELPERS ────────────────────────────────────────────────
function fetchUrl(url) {
    return new Promise((resolve, reject) => {
        const client = url.startsWith('https') ? https : http;
        let data = '';
        const req = client.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; DailyNewsUG/1.0; +https://dailynewsug.online)',
                'Accept': 'application/json, application/xml, text/xml, */*'
            }
        }, res => {
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(data));
        });
        req.on('error', reject);
        req.setTimeout(15000, () => { req.destroy(); reject(new Error('Timeout')); });
    });
}

function postJson(url, body) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify(body);
        const urlObj = new URL(url);
        const options = {
            hostname: urlObj.hostname,
            path: urlObj.pathname + urlObj.search,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(data)
            }
        };
        const req = https.request(options, res => {
            let body = '';
            res.on('data', c => body += c);
            res.on('end', () => resolve(JSON.parse(body)));
        });
        req.on('error', reject);
        req.write(data);
        req.end();
    });
}

function parseXml(xml, tag) {
    const results = [];
    const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'gi');
    let match;
    while ((match = regex.exec(xml)) !== null) results.push(match[1]);
    return results;
}

function getXmlValue(item, tag) {
    const m = item.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>|<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
    if (!m) return '';
    return (m[1] || m[2] || '').replace(/<[^>]+>/g, '').trim();
}

function slugify(str) {
    return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function formatDate(dateStr) {
    try {
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' });
    } catch { return new Date().toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' }); }
}

function detectCategory(title, desc) {
    const text = (title + ' ' + desc).toLowerCase();
    if (/journalist|media|editor|reporter|broadcast|radio|tv|communication/.test(text)) return 'Media & Journalism';
    if (/software|developer|engineer|it |tech|data|cyber|network|system|web dev|frontend|backend|fullstack/.test(text)) return 'Technology & IT';
    if (/ngo|un |unicef|unhcr|undp|who |world bank|government|ministry|public service|humanitarian|relief|aid/.test(text)) return 'Government & NGO';
    if (/finance|accountan|audit|bank|insurance|investment|economist|treasury/.test(text)) return 'Business & Finance';
    if (/doctor|nurse|health|medical|clinical|pharmacy|hospital|physician|dentist/.test(text)) return 'Health & Medical';
    if (/teacher|lecturer|professor|education|school|university|training|tutor/.test(text)) return 'Education & Teaching';
    if (/engineer|construction|architect|civil|mechanical|electrical|structural/.test(text)) return 'Engineering';
    if (/sales|marketing|brand|advertis|customer|client|retail|business dev/.test(text)) return 'Sales & Marketing';
    if (/online|virtual|digital|content|social media|freelance|remote/.test(text)) return 'Online & Remote';
    return 'Other';
}

function detectJobType(title, desc) {
    const text = (title + ' ' + desc).toLowerCase();
    if (/remote|work from home|wfh/.test(text)) return 'Remote';
    if (/hybrid/.test(text)) return 'Hybrid';
    if (/part.time|part time/.test(text)) return 'Part Time';
    if (/contract|consultant|consultancy|freelance/.test(text)) return 'Contract';
    if (/intern|attachment|volunteer/.test(text)) return 'Internship';
    if (/online|virtual/.test(text)) return 'Online';
    return 'Full Time';
}

function detectLocation(title, desc, defaultLoc) {
    const text = (title + ' ' + desc + ' ' + defaultLoc).toLowerCase();
    if (/kampala|uganda/.test(text)) return 'Kampala, Uganda';
    if (/nairobi|kenya/.test(text)) return 'Nairobi, Kenya';
    if (/dar es salaam|tanzania/.test(text)) return 'Dar es Salaam, Tanzania';
    if (/kigali|rwanda/.test(text)) return 'Kigali, Rwanda';
    if (/addis|ethiopia/.test(text)) return 'Addis Ababa, Ethiopia';
    if (/east africa/.test(text)) return 'East Africa';
    if (/africa/.test(text)) return 'Africa';
    if (/remote|worldwide|global|anywhere/.test(text)) return 'Remote';
    if (/hybrid/.test(text)) return 'Hybrid';
    if (/online|virtual/.test(text)) return 'Online';
    return defaultLoc || 'International';
}

// ─── FIRESTORE: GET EXISTING JOB IDs ────────────────────────
async function getExistingJobIds() {
    try {
        const url = `${FIRESTORE_BASE_URL}/jobs?key=${FIREBASE_API_KEY}&pageSize=300`;
        const data = await fetchUrl(url);
        const parsed = JSON.parse(data);
        const ids = new Set();
        if (parsed.documents) {
            parsed.documents.forEach(doc => {
                const fields = doc.fields || {};
                if (fields.sourceId) ids.add(fields.sourceId.stringValue);
            });
        }
        return ids;
    } catch (e) {
        console.error('Error fetching existing jobs:', e.message);
        return new Set();
    }
}

// ─── FIRESTORE: SAVE JOB ────────────────────────────────────
async function saveJob(job) {
    try {
        const url = `${FIRESTORE_BASE_URL}/jobs?key=${FIREBASE_API_KEY}`;
        const body = {
            fields: {
                title:        { stringValue: job.title || '' },
                company:      { stringValue: job.company || '' },
                category:     { stringValue: job.category || 'Other' },
                type:         { stringValue: job.type || 'Full Time' },
                location:     { stringValue: job.location || 'International' },
                deadline:     { stringValue: job.deadline || '' },
                description:  { stringValue: job.description || '' },
                applyLink:    { stringValue: job.applyLink || '' },
                salary:       { stringValue: job.salary || '' },
                contactName:  { stringValue: 'Auto-imported' },
                contactEmail: { stringValue: 'jobs@dailynewsug.online' },
                plan:         { stringValue: 'Basic' },
                price:        { stringValue: '$0' },
                approved:     { booleanValue: true },
                source:       { stringValue: job.source || '' },
                sourceId:     { stringValue: job.sourceId || '' },
                createdAt:    { stringValue: new Date().toISOString() },
                date:         { stringValue: formatDate(new Date()) }
            }
        };
        await postJson(url, body);
        return true;
    } catch (e) {
        console.error(`Error saving job "${job.title}":`, e.message);
        return false;
    }
}

// ════════════════════════════════════════════════════════════
// SOURCE 1: RELIEFWEB API
// ════════════════════════════════════════════════════════════
async function fetchReliefWeb(existingIds) {
    console.log('\n📡 Fetching ReliefWeb jobs...');
    const jobs = [];
    try {
        const url = 'https://api.reliefweb.int/v1/jobs?appname=dailynewsug&limit=50&sort[]=date:desc&fields[include][]=title&fields[include][]=body&fields[include][]=source&fields[include][]=date&fields[include][]=url&fields[include][]=country&fields[include][]=city&fields[include][]=type&fields[include][]=closing_date';
        const data = await fetchUrl(url);
        const parsed = JSON.parse(data);

        for (const item of (parsed.data || [])) {
            const f = item.fields || {};
            const sourceId = `reliefweb-${item.id}`;
            if (existingIds.has(sourceId)) continue;

            const title = f.title || '';
            const desc = (f.body || '').replace(/<[^>]+>/g, '').substring(0, 600);
            const company = (f.source && f.source[0]) ? f.source[0].name : 'ReliefWeb';
            const country = (f.country && f.country[0]) ? f.country[0].name : '';
            const city = f.city || '';
            const locationRaw = [city, country].filter(Boolean).join(', ');

            jobs.push({
                title,
                company,
                category: detectCategory(title, desc),
                type: detectJobType(title, desc),
                location: detectLocation(title, desc, locationRaw),
                deadline: f.closing_date ? f.closing_date.split('T')[0] : '',
                description: desc,
                applyLink: f.url || '',
                salary: '',
                source: 'ReliefWeb',
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
// SOURCE 2: UN JOBS RSS
// ════════════════════════════════════════════════════════════
async function fetchUNJobs(existingIds) {
    console.log('\n📡 Fetching UN Jobs RSS...');
    const jobs = [];
    try {
        const url = 'https://careers.un.org/lbw/api/JobFeedRSS.aspx?type=rss';
        const xml = await fetchUrl(url);
        const items = parseXml(xml, 'item');

        for (const item of items.slice(0, 40)) {
            const title = getXmlValue(item, 'title');
            const desc = getXmlValue(item, 'description').substring(0, 600);
            const link = getXmlValue(item, 'link');
            const pubDate = getXmlValue(item, 'pubDate');
            const sourceId = `unjobs-${slugify(title)}-${slugify(pubDate)}`;
            if (existingIds.has(sourceId)) continue;

            jobs.push({
                title,
                company: 'United Nations',
                category: detectCategory(title, desc),
                type: detectJobType(title, desc),
                location: detectLocation(title, desc, 'International'),
                deadline: '',
                description: desc,
                applyLink: link,
                salary: '',
                source: 'UN Jobs',
                sourceId
            });
        }
        console.log(`  ✅ Found ${jobs.length} new jobs from UN Jobs`);
    } catch (e) {
        console.error('  ❌ UN Jobs error:', e.message);
    }
    return jobs;
}

// ════════════════════════════════════════════════════════════
// SOURCE 3: REMOTEOK API
// ════════════════════════════════════════════════════════════
async function fetchRemoteOK(existingIds) {
    console.log('\n📡 Fetching RemoteOK jobs...');
    const jobs = [];
    try {
        const url = 'https://remoteok.com/api';
        const data = await fetchUrl(url);
        const parsed = JSON.parse(data);

        for (const item of parsed.slice(1, 51)) {
            if (!item.id) continue;
            const sourceId = `remoteok-${item.id}`;
            if (existingIds.has(sourceId)) continue;

            const title = item.position || '';
            const desc = (item.description || '').replace(/<[^>]+>/g, '').substring(0, 600);

            jobs.push({
                title,
                company: item.company || 'Remote Company',
                category: detectCategory(title, desc),
                type: 'Remote',
                location: 'Remote',
                deadline: '',
                description: desc,
                applyLink: item.url || `https://remoteok.com/l/${item.id}`,
                salary: item.salary_min ? `$${item.salary_min.toLocaleString()} - $${item.salary_max ? item.salary_max.toLocaleString() : '?'}/yr` : '',
                source: 'RemoteOK',
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
// SOURCE 4: INDEED UGANDA RSS
// ════════════════════════════════════════════════════════════
async function fetchIndeedUganda(existingIds) {
    console.log('\n📡 Fetching Indeed Uganda RSS...');
    const jobs = [];
    try {
        const url = 'https://www.indeed.com/rss?q=&l=Uganda&sort=date&limit=50';
        const xml = await fetchUrl(url);
        const items = parseXml(xml, 'item');

        for (const item of items.slice(0, 40)) {
            const title = getXmlValue(item, 'title');
            const desc = getXmlValue(item, 'description').substring(0, 600);
            const link = getXmlValue(item, 'link');
            const company = getXmlValue(item, 'source') || 'Company';
            const pubDate = getXmlValue(item, 'pubDate');
            const sourceId = `indeed-ug-${slugify(title)}-${slugify(company)}`;
            if (existingIds.has(sourceId)) continue;

            jobs.push({
                title,
                company,
                category: detectCategory(title, desc),
                type: detectJobType(title, desc),
                location: detectLocation(title, desc, 'Uganda'),
                deadline: '',
                description: desc,
                applyLink: link,
                salary: '',
                source: 'Indeed',
                sourceId
            });
        }
        console.log(`  ✅ Found ${jobs.length} new jobs from Indeed Uganda`);
    } catch (e) {
        console.error('  ❌ Indeed error:', e.message);
    }
    return jobs;
}

// ════════════════════════════════════════════════════════════
// SOURCE 5: DEVEX RSS
// ════════════════════════════════════════════════════════════
async function fetchDevex(existingIds) {
    console.log('\n📡 Fetching Devex jobs...');
    const jobs = [];
    try {
        const url = 'https://www.devex.com/jobs/rss';
        const xml = await fetchUrl(url);
        const items = parseXml(xml, 'item');

        for (const item of items.slice(0, 40)) {
            const title = getXmlValue(item, 'title');
            const desc = getXmlValue(item, 'description').substring(0, 600);
            const link = getXmlValue(item, 'link');
            const pubDate = getXmlValue(item, 'pubDate');
            const sourceId = `devex-${slugify(title)}-${slugify(pubDate)}`;
            if (existingIds.has(sourceId)) continue;

            jobs.push({
                title,
                company: getXmlValue(item, 'author') || 'International Organisation',
                category: detectCategory(title, desc),
                type: detectJobType(title, desc),
                location: detectLocation(title, desc, 'International'),
                deadline: '',
                description: desc,
                applyLink: link,
                salary: '',
                source: 'Devex',
                sourceId
            });
        }
        console.log(`  ✅ Found ${jobs.length} new jobs from Devex`);
    } catch (e) {
        console.error('  ❌ Devex error:', e.message);
    }
    return jobs;
}

// ════════════════════════════════════════════════════════════
// SOURCE 6: WHO AFRICA RSS
// ════════════════════════════════════════════════════════════
async function fetchWHOAfrica(existingIds) {
    console.log('\n📡 Fetching WHO Africa jobs...');
    const jobs = [];
    try {
        const url = 'https://www.afro.who.int/jobs/rss';
        const xml = await fetchUrl(url);
        const items = parseXml(xml, 'item');

        for (const item of items.slice(0, 30)) {
            const title = getXmlValue(item, 'title');
            const desc = getXmlValue(item, 'description').substring(0, 600);
            const link = getXmlValue(item, 'link');
            const pubDate = getXmlValue(item, 'pubDate');
            const sourceId = `who-${slugify(title)}-${slugify(pubDate)}`;
            if (existingIds.has(sourceId)) continue;

            jobs.push({
                title,
                company: 'World Health Organization',
                category: 'Health & Medical',
                type: detectJobType(title, desc),
                location: detectLocation(title, desc, 'Africa'),
                deadline: '',
                description: desc,
                applyLink: link,
                salary: '',
                source: 'WHO Africa',
                sourceId
            });
        }
        console.log(`  ✅ Found ${jobs.length} new jobs from WHO Africa`);
    } catch (e) {
        console.error('  ❌ WHO Africa error:', e.message);
    }
    return jobs;
}

// ════════════════════════════════════════════════════════════
// SOURCE 7: AFRICAN DEVELOPMENT BANK
// ════════════════════════════════════════════════════════════
async function fetchAfDB(existingIds) {
    console.log('\n📡 Fetching African Development Bank jobs...');
    const jobs = [];
    try {
        const url = 'https://www.afdb.org/en/careers/rss';
        const xml = await fetchUrl(url);
        const items = parseXml(xml, 'item');

        for (const item of items.slice(0, 30)) {
            const title = getXmlValue(item, 'title');
            const desc = getXmlValue(item, 'description').substring(0, 600);
            const link = getXmlValue(item, 'link');
            const pubDate = getXmlValue(item, 'pubDate');
            const sourceId = `afdb-${slugify(title)}-${slugify(pubDate)}`;
            if (existingIds.has(sourceId)) continue;

            jobs.push({
                title,
                company: 'African Development Bank',
                category: 'Business & Finance',
                type: detectJobType(title, desc),
                location: detectLocation(title, desc, 'Africa'),
                deadline: '',
                description: desc,
                applyLink: link,
                salary: '',
                source: 'AfDB',
                sourceId
            });
        }
        console.log(`  ✅ Found ${jobs.length} new jobs from AfDB`);
    } catch (e) {
        console.error('  ❌ AfDB error:', e.message);
    }
    return jobs;
}

// ════════════════════════════════════════════════════════════
// MAIN — RUN ALL SOURCES
// ════════════════════════════════════════════════════════════
async function main() {
    console.log('🚀 Daily News Uganda — Jobs Importer Starting...');
    console.log(`⏰ Run time: ${new Date().toISOString()}`);

    // Get existing job IDs to avoid duplicates
    console.log('\n🔍 Checking existing jobs in Firebase...');
    const existingIds = await getExistingJobIds();
    console.log(`  Found ${existingIds.size} existing jobs`);

    // Fetch from all sources
    const [
        reliefwebJobs,
        unJobs,
        remoteOkJobs,
        indeedJobs,
        devexJobs,
        whoJobs,
        afdbJobs
    ] = await Promise.allSettled([
        fetchReliefWeb(existingIds),
        fetchUNJobs(existingIds),
        fetchRemoteOK(existingIds),
        fetchIndeedUganda(existingIds),
        fetchDevex(existingIds),
        fetchWHOAfrica(existingIds),
        fetchAfDB(existingIds)
    ]).then(results => results.map(r => r.status === 'fulfilled' ? r.value : []));

    const allJobs = [
        ...reliefwebJobs,
        ...unJobs,
        ...remoteOkJobs,
        ...indeedJobs,
        ...devexJobs,
        ...whoJobs,
        ...afdbJobs
    ];

    console.log(`\n📊 Total new jobs to import: ${allJobs.length}`);

    if (allJobs.length === 0) {
        console.log('✅ No new jobs to import. All up to date!');
        return;
    }

    // Save all to Firebase
    console.log('\n💾 Saving to Firebase...');
    let saved = 0;
    let failed = 0;

    for (const job of allJobs) {
        const success = await saveJob(job);
        if (success) {
            saved++;
            console.log(`  ✅ Saved: ${job.title} (${job.company}) — ${job.source}`);
        } else {
            failed++;
        }
        // Small delay to avoid rate limiting
        await new Promise(r => setTimeout(r, 200));
    }

    console.log('\n🎉 Import Complete!');
    console.log(`  ✅ Saved:  ${saved} jobs`);
    console.log(`  ❌ Failed: ${failed} jobs`);
    console.log(`  ⏭️  Skipped (duplicates): already counted`);
}

main().catch(err => {
    console.error('💥 Fatal error:', err);
    process.exit(1);
});