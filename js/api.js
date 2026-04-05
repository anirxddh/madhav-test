/**
 * ============================================================
 * MADHAV.AI — api.js
 * Backend idhar hai
 *
 * HOW TO GO LIVE (3 steps):
 *   1. Set USE_MOCK = false
 *   2. Set BASE_URL to your FastAPI server (e.g. 'http://localhost:8000')
 *   3. Make sure your endpoints match the shapes documented below
 *
 * Every function is documented with:
 *   - HTTP method + path
 *   - Request body / query params
 *   - Expected response shape
 * ============================================================
 */

// ── Configuration ─────────────────────────────────────────────
const USE_MOCK  = true;                    // ← flip to false when backend is ready
const BASE_URL  = 'http://localhost:8000'; // ← your FastAPI base URL


// ── API Layer ─────────────────────────────────────────────────
//
// Each function returns a Promise that resolves to the response shape.
// When USE_MOCK is true, it returns mock data after a fake delay.
// When USE_MOCK is false, it calls the real backend endpoint.

const API = {

  /**
   * AI Chat
   * Handles Normal, Research, and Study mode queries.
   *
   * POST /chat
   * Body:     { query: string, mode: 'normal' | 'research' | 'study' }
   *
   * Response (normal / research):
   *   { text: string, cases: Case[] }
   *
   * Response (study):
   *   { sections: StudySection[] }
   */
  async chat(query, mode) {
    if (USE_MOCK) return _mockChat(query, mode);

    const res = await fetch(`${BASE_URL}/chat`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ query, mode }),
    });
    return res.json();
  },


  /**
   * Keyword / Token Search (Traditional Mode)
   *
   * GET /search
   * Params:
   *   q          string   — free-text keyword
   *   court      string   — e.g. 'supreme', 'delhi', 'bombay'
   *   year_from  number
   *   year_to    number
   *   act        string   — statute keyword
   *   judge      string
   *   exclude    string   — comma-separated exclude terms
   *
   * Response:
   *   { cases: Case[], total: number }
   */
  async search(params = {}) {
    if (USE_MOCK) return _mockSearch(params);

    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v !== '' && v != null))
    );
    const res = await fetch(`${BASE_URL}/search?${qs}`);
    return res.json();
  },


  /**
   * Fetch a single case (for the inline viewer / PDF panel)
   *
   * GET /case/:id
   *
   * Response: Case (full object — see shape below)
   */
  async getCase(id) {
    if (USE_MOCK) {
      await _delay(200);
      const c = MOCK_CASES.find(x => x.id === id);
      return c || null;
    }

    const res = await fetch(`${BASE_URL}/case/${id}`);
    return res.json();
  },


  /**
   * Suggestion lookup for token search input
   * Called as user types in Traditional Mode search bar.
   *
   * GET /suggestions?q=<partial>
   *
   * Response: { suggestions: Suggestion[] }
   *
   * Note: Currently uses a static client-side list (SUGGESTIONS below).
   * Replace with the live call when the backend supports it.
   */
  async getSuggestions(partial) {
    // When backend is ready, swap this out:
    //   const res = await fetch(`${BASE_URL}/suggestions?q=${partial}`);
    //   return res.json();

    await _delay(0); // keep async contract
    const q = partial.toLowerCase();
    const matched = SUGGESTIONS.filter(s =>
      s.label.toLowerCase().includes(q) ||
      s.keywords.some(k => k.includes(q))
    ).slice(0, 7);
    return { suggestions: matched };
  },

};


// ============================================================
// MOCK DATA
// Mirrors what your real backend will return.
// These shapes ARE the contract between frontend and backend.
// ============================================================

/**
 * Case shape syntax(backend must return this structure):
 *
 * {
 *   id:              string,
 *   name:            string,
 *   court:           string,
 *   year:            number,
 *   citation:        string,
 *   bench:           string,    // e.g. "3 Judges"
 *   authority_score: number,    // 0–100, based on citation frequency + bench size
 *   tags:            string[],
 *   summary:         string,
 *   facts:           string[],
 *   judgement:       string,
 *   paragraphs:      { id: string, text: string }[],
 *   cited_in:        { name, court, year, citation, context }[],
 * }
 */
const MOCK_CASES = [
  {
    id: 'case_001',
    name: 'Samatha v. State of Andhra Pradesh',
    court: 'Supreme Court of India',
    year: 1997,
    citation: 'AIR 1997 SC 3297',
    bench: '3 Judges',
    authority_score: 92,
    tags: ['tribal land', 'fifth schedule', 'mining leases', 'constitutional law'],
    summary: 'A landmark constitutional judgment delivered by a three-judge bench of the Supreme Court. The Court held that the State cannot grant mining leases in Scheduled Areas to non-tribal entities — including government companies — as this violates the Fifth Schedule of the Constitution. It directed that 20% of net profits from ongoing mining operations must be placed in a permanent fund for tribal development.',
    facts: [
      'Samatha, an NGO, challenged mining leases granted to non-tribal companies in tribal areas of Andhra Pradesh.',
      'The leases were granted under the Mines and Minerals (Regulation and Development) Act, 1957.',
      'The affected areas were Scheduled Areas under the Fifth Schedule of the Constitution.',
      'The State Government argued it had statutory power to grant such leases regardless of tribal protections.',
      'A key question was whether government corporations qualified as "non-tribals" under Fifth Schedule restrictions.',
    ],
    judgement: 'The Supreme Court held that the State cannot transfer tribal land in Scheduled Areas to non-tribals — including government companies — by way of mining leases. The Fifth Schedule imposes an absolute prohibition. The Court directed that 20% of net profits from ongoing mining operations be placed in a permanent fund for tribal welfare and ecological restoration.',
    paragraphs: [
      { id: 'p1', text: 'The Fifth Schedule of the Constitution was designed to protect the tribal communities in their lands, culture and autonomy from exploitation by outsiders.' },
      { id: 'p2', text: 'The Governor of a State with Scheduled Areas has special responsibilities under the Constitution for the welfare and protection of tribal communities residing there.' },
      { id: 'p3', text: 'Leases of tribal land to non-tribals, including by the Government or its corporations, are constitutionally impermissible in Scheduled Areas under the Fifth Schedule.' },
      { id: 'p4', text: 'Land is the most important natural resource of the tribal communities. It is the source of their livelihood and the foundation of their culture and social organisation.' },
      { id: 'p5', text: 'Twenty per cent of net profits from any ongoing mining operations in Scheduled Areas shall be set aside in a permanent fund for tribal welfare and ecological restoration.' },
    ],
    cited_in: [
      { name: 'Orissa Mining Corporation v. Ministry of Environment & Forests', court: 'Supreme Court of India', year: 2013, citation: '(2013) 6 SCC 476', context: 'Court applied <em>Samatha</em> to hold that gram sabha consent is mandatory before mining in Scheduled Areas under the Forest Rights Act.' },
      { name: 'Nandini Sundar v. State of Chhattisgarh', court: 'Supreme Court of India', year: 2011, citation: '(2011) 7 SCC 547', context: 'The Samatha principles on tribal autonomy and Fifth Schedule protections were extensively cited in the context of the Salwa Judum operations.' },
      { name: 'Kailas v. State of Maharashtra', court: 'Bombay High Court', year: 2011, citation: 'AIR 2011 Bom 182', context: 'The court relied on Samatha to affirm the prohibition on transfer of tribal land to non-tribal entities through government intermediaries.' },
      { name: 'Vedanta Resources v. Union of India', court: 'Supreme Court of India', year: 2014, citation: 'WP(C) 180/2011', context: "Samatha's welfare fund directive (20% net profits) was referenced as precedent for environmental and tribal compensation requirements." },
    ],
  },
  {
    id: 'case_002',
    name: 'Paschim Banga Khet Mazdoor Samity v. State of West Bengal',
    court: 'Supreme Court of India',
    year: 1996,
    citation: '(1996) 4 SCC 37',
    bench: '2 Judges',
    authority_score: 76,
    tags: ['right to health', 'article 21', 'emergency medical care', 'state obligation'],
    summary: 'A significant Supreme Court judgment expanding the right to life under Article 21 to include the right to emergency medical care. The case arose after a labourer was denied treatment at multiple government hospitals due to lack of facilities.',
    facts: [
      'Hakim Seikh, a farm labourer, suffered severe head injuries after falling from a train.',
      'He was turned away from several government hospitals citing lack of beds and facilities.',
      'He was eventually treated at a private hospital at enormous personal cost.',
      'The petitioner argued that denial of emergency medical care violated Article 21.',
      'The State argued that limited resources justified the inability to provide immediate care.',
    ],
    judgement: 'The Supreme Court held that the right to life under Article 21 includes the right to emergency medical care. The State has a constitutional obligation to provide healthcare. The Court directed the State to pay compensation and to establish a proper scheme for emergency treatment across government hospitals.',
    paragraphs: [
      { id: 'p1', text: 'The right to life enshrined in Article 21 imposes an obligation on the State to safeguard the life of every person within its territory.' },
      { id: 'p2', text: 'Failure to provide timely medical treatment to a person in need of emergency care is a violation of the fundamental right to life under Article 21.' },
      { id: 'p3', text: 'The State cannot avoid its constitutional obligation to provide emergency medical care by pleading financial constraints or inadequacy of resources.' },
    ],
    cited_in: [
      { name: 'State of Punjab v. Mohinder Singh Chawla', court: 'Supreme Court of India', year: 1997, citation: 'AIR 1997 SC 1225', context: 'The court affirmed the right to medical treatment as a fundamental right, citing Paschim Banga as primary precedent.' },
      { name: 'Consumer Education & Research Centre v. Union of India', court: 'Supreme Court of India', year: 1995, citation: '(1995) 3 SCC 42', context: 'Referenced for the expanded interpretation of the right to life including health and medical care as part of Article 21.' },
      { name: 'Laxmi Kant Pandey v. Union of India', court: 'Supreme Court of India', year: 2002, citation: 'AIR 2002 SC 1509', context: 'Financial constraints cannot excuse denial of emergency medical care — applied in the context of government hospital facilities.' },
    ],
  },
  {
    id: 'case_003',
    name: 'Om Kumar v. Union of India',
    court: 'Supreme Court of India',
    year: 2001,
    citation: '(2001) 2 SCC 386',
    bench: '3 Judges',
    authority_score: 71,
    tags: ['doctrine of proportionality', 'administrative law', 'judicial review', 'article 14'],
    summary: 'The Supreme Court applied the doctrine of proportionality in Indian administrative law, holding that courts can examine whether administrative actions are proportionate to the objective sought.',
    facts: [
      'The case involved a civil servant who challenged a punishment order in departmental proceedings.',
      'The appellant argued the penalty imposed was disproportionate to the misconduct found.',
      'The central question was the scope of judicial review of administrative punishments.',
      'The Court examined proportionality as developed in European human rights jurisprudence.',
      'The respondent argued courts should not interfere with disciplinary authority decisions.',
    ],
    judgement: 'The Supreme Court held that the doctrine of proportionality is part of Indian constitutional law. Courts can examine whether the penalty imposed is proportionate to the gravity of misconduct. Where fundamental rights are at stake, stricter proportionality review applies.',
    paragraphs: [
      { id: 'p1', text: 'The doctrine of proportionality ensures that measures taken by administrative authorities are not excessive in relation to the legitimate aim pursued.' },
      { id: 'p2', text: 'Where an administrative action impacts fundamental rights, a stricter standard of proportionality review applies and the courts examine it more rigorously.' },
      { id: 'p3', text: 'Courts are not required to substitute their own view but must examine whether the decision falls within a reasonable range of responses.' },
    ],
    cited_in: [
      { name: 'Union of India v. G. Ganayutham', court: 'Supreme Court of India', year: 1997, citation: '(1997) 7 SCC 463', context: 'The proportionality standard was applied to review the severity of punishment in disciplinary proceedings.' },
      { name: 'Coimbatore District Central Cooperative Bank v. Employees Association', court: 'Supreme Court of India', year: 2007, citation: '(2007) 4 SCC 669', context: "Om Kumar's proportionality doctrine was extended to industrial disputes and collective bargaining." },
    ],
  },
  {
    id: 'case_004',
    name: 'Kesavananda Bharati v. State of Kerala',
    court: 'Supreme Court of India',
    year: 1973,
    citation: 'AIR 1973 SC 1461',
    bench: '13 Judges',
    authority_score: 98,
    tags: ['basic structure doctrine', 'constitutional amendment', 'parliament powers', 'fundamental rights'],
    summary: 'The most significant constitutional judgment in Indian legal history. A 13-judge bench evolved the "basic structure doctrine", holding that while Parliament has wide powers to amend the Constitution, it cannot alter its essential basic structure.',
    facts: [
      'Kesavananda Bharati challenged Kerala land reform laws that restricted his religious institution\'s property.',
      'The case raised the fundamental question of Parliament\'s power to amend the Constitution.',
      'The previous Golaknath judgment held Parliament could not amend fundamental rights at all.',
      'The 24th Constitutional Amendment was enacted specifically to override Golaknath.',
      'A 13-judge bench was constituted to definitively determine the ambit of Parliament\'s amending power.',
    ],
    judgement: 'By a 7:6 majority, the Court held Parliament has wide power to amend the Constitution including fundamental rights, but cannot destroy its "basic structure". Basic structure includes: supremacy of the Constitution, republican and democratic government, secular character, separation of powers, federal character, and the rule of law.',
    paragraphs: [
      { id: 'p1', text: 'The Constitution is not a document for fastening its provisions for all time, but is an organism capable of growth and development through interpretation.' },
      { id: 'p2', text: 'Parliament has wide powers of amendment under Article 368 but cannot use them to destroy or abrogate the basic structure of the Constitution.' },
      { id: 'p3', text: 'The basic features of the Constitution include the supremacy of the Constitution, republican democratic government, secular character of the State, separation of powers, and federal character.' },
    ],
    cited_in: [
      { name: 'Indira Nehru Gandhi v. Raj Narain', court: 'Supreme Court of India', year: 1975, citation: 'AIR 1975 SC 2299', context: 'The basic structure doctrine was invoked to strike down the 39th Constitutional Amendment.' },
      { name: 'Minerva Mills Ltd. v. Union of India', court: 'Supreme Court of India', year: 1980, citation: 'AIR 1980 SC 1789', context: 'Kesavananda was affirmed — judicial review and harmony between Part III and Part IV were declared basic structure features.' },
      { name: 'S.R. Bommai v. Union of India', court: 'Supreme Court of India', year: 1994, citation: 'AIR 1994 SC 1918', context: 'Federalism, democracy, and secularism held to be part of the inviolable basic structure.' },
      { name: 'I.R. Coelho v. State of Tamil Nadu', court: 'Supreme Court of India', year: 2007, citation: '(2007) 2 SCC 1', context: 'Nine-judge bench reaffirmed Kesavananda — Ninth Schedule laws can be challenged if they violate basic structure.' },
    ],
  },
  {
    id: 'case_005',
    name: 'Vishaka v. State of Rajasthan',
    court: 'Supreme Court of India',
    year: 1997,
    citation: 'AIR 1997 SC 3011',
    bench: '3 Judges',
    authority_score: 88,
    tags: ['sexual harassment', 'workplace rights', 'gender equality', 'article 14', 'article 21'],
    summary: 'The Supreme Court laid down the Vishaka Guidelines for prevention of sexual harassment at the workplace in the absence of specific legislation, recognising it as a violation of fundamental rights.',
    facts: [
      'A social worker was gang-raped while performing government duties in Rajasthan.',
      'No specific domestic law existed to address sexual harassment at the workplace.',
      'NGOs filed a PIL seeking judicial intervention and enforceable guidelines.',
      'The Court had to formulate binding guidelines in the complete absence of legislation.',
      "India's obligations under CEDAW formed part of the Court's reasoning.",
    ],
    judgement: 'The Supreme Court laid down the Vishaka Guidelines making it mandatory for employers to prevent and address workplace sexual harassment. These guidelines had the force of law until the Sexual Harassment of Women at Workplace Act, 2013 was enacted.',
    paragraphs: [
      { id: 'p1', text: 'Sexual harassment at the workplace constitutes a violation of fundamental rights of gender equality and the right to life and liberty under Articles 14 and 21.' },
      { id: 'p2', text: 'Every employer must prevent sexual harassment and provide procedures for resolution of complaints.' },
      { id: 'p3', text: 'Each complaint shall be addressed by a Complaints Committee at the employer\'s level, with a woman in the majority.' },
    ],
    cited_in: [
      { name: 'Apparel Export Promotion Council v. A.K. Chopra', court: 'Supreme Court of India', year: 1999, citation: '(1999) 1 SCC 759', context: 'Vishaka guidelines applied — sexual harassment need not involve physical contact to attract liability.' },
      { name: 'Medha Kotwal Lele v. Union of India', court: 'Supreme Court of India', year: 2013, citation: '(2013) 1 SCC 297', context: 'Court monitored compliance with Vishaka and directed comprehensive state-level implementation.' },
    ],
  },
];


/**
 * Suggestion shape (for token search dropdown):
 * { label: string, type: 'court'|'keyword'|'year'|'judge'|'exclude', value: string, keywords: string[] }
 */
const SUGGESTIONS = [
  // Courts
  { label: 'Supreme Court of India', type: 'court',   value: 'supreme',   keywords: ['sc', 'supreme', 'apex'] },
  { label: 'Delhi High Court',       type: 'court',   value: 'delhi',     keywords: ['delhi', 'dhc'] },
  { label: 'Bombay High Court',      type: 'court',   value: 'bombay',    keywords: ['bombay', 'bom', 'mumbai'] },
  { label: 'Madras High Court',      type: 'court',   value: 'madras',    keywords: ['madras', 'mad', 'chennai'] },
  { label: 'Calcutta High Court',    type: 'court',   value: 'calcutta',  keywords: ['calcutta', 'cal'] },
  { label: 'Allahabad High Court',   type: 'court',   value: 'allahabad', keywords: ['allahabad', 'alh'] },

  // Keywords
  { label: 'Tribal Land',            type: 'keyword', value: 'tribal land',       keywords: ['tribal', 'schedule', 'fifth'] },
  { label: 'Article 21',             type: 'keyword', value: 'article 21',        keywords: ['art21', 'article21', '21'] },
  { label: 'Proportionality',        type: 'keyword', value: 'proportionality',   keywords: ['prop', 'proportional'] },
  { label: 'Basic Structure',        type: 'keyword', value: 'basic structure',   keywords: ['basic', 'struct', 'kesavananda'] },
  { label: 'Sexual Harassment',      type: 'keyword', value: 'sexual harassment', keywords: ['vishaka', 'harassment', 'posh'] },
  { label: 'Mining Leases',          type: 'keyword', value: 'mining leases',     keywords: ['mining', 'lease', 'mineral'] },
  { label: 'Fundamental Rights',     type: 'keyword', value: 'fundamental rights',keywords: ['fundamental', 'rights', 'fr'] },
  { label: 'Administrative Law',     type: 'keyword', value: 'administrative law',keywords: ['admin', 'admn'] },
  { label: 'Gender Equality',        type: 'keyword', value: 'gender equality',   keywords: ['gender', 'equality', 'women'] },

  // Years
  { label: 'After 2000',  type: 'year', value: 'after_2000',  keywords: ['2000', 'after'] },
  { label: 'After 2010',  type: 'year', value: 'after_2010',  keywords: ['2010'] },
  { label: 'Before 2000', type: 'year', value: 'before_2000', keywords: ['before'] },
  { label: '1990s',       type: 'year', value: '1990s',        keywords: ['90s', '1990'] },
  { label: '1970s',       type: 'year', value: '1970s',        keywords: ['70s', '1970'] },

  // Judges
  { label: 'Justice P.B. Sawant',    type: 'judge', value: 'sawant',    keywords: ['sawant'] },
  { label: 'Justice Y.K. Sabharwal', type: 'judge', value: 'sabharwal', keywords: ['sabharwal'] },
  { label: 'Chief Justice Khanna',   type: 'judge', value: 'khanna',    keywords: ['khanna'] },
];

// Token display helpers (used by app.js — do not remove)
const TOKEN_ICON  = { court: 'CT', keyword: 'KW', exclude: 'NO', year: 'YR', judge: 'JG' };
const TOKEN_LABEL = { court: 'Court', keyword: 'Keyword', exclude: 'Exclude', year: 'Year', judge: 'Judge' };


// ============================================================
// MOCK IMPLEMENTATIONS
// These replicate what the real backend returns.
// Keep the response shapes identical when building the backend.
// ============================================================

async function _mockChat(query, mode) {
  const delay = mode === 'research' ? 2200 : 1200;
  await _delay(delay);

  const q = query.toLowerCase();

  if (mode === 'study') {
    return _mockStudy(q);
  }

  // Normal + Research: return { text, cases }
  let text = '', cases = [];

  if (q.includes('samatha') || q.includes('tribal') || q.includes('scheduled area')) {
    text = mode === 'research'
      ? `<strong>Deep Research — Tribal Land Rights & Fifth Schedule</strong><br><br>The Fifth Schedule creates a constitutional framework for tribal area administration. Key findings:<br><br><strong>1. Absolute Prohibition:</strong> Transfer of tribal land to non-tribals — private or government — is constitutionally prohibited.<br><strong>2. 20% Welfare Fund:</strong> Net profits from mining must flow into a permanent tribal welfare fund.<br><strong>3. Governor's Special Duty:</strong> The Fifth Schedule vests special administrative responsibility in the Governor for Scheduled Areas.`
      : 'The <strong>Samatha judgment (1997)</strong> is a landmark decision protecting tribal land rights. The Supreme Court held that mining leases in Scheduled Areas cannot be granted to non-tribal entities — including government companies — as this violates the Fifth Schedule of the Constitution.';
    cases = [MOCK_CASES[0]];

  } else if (q.includes('health') || q.includes('article 21') || q.includes('medical')) {
    text = mode === 'research'
      ? `<strong>Deep Research — Right to Health under Article 21</strong><br><br>Key milestones:<br><strong>1. Vincent Panikurlangara (1987):</strong> Health maintenance is part of Article 21.<br><strong>2. Paschim Banga (1996):</strong> Emergency care is a fundamental right; financial constraints are no defence.<br><strong>3. State of Punjab v. Mohinder Singh Chawla (1997):</strong> State must provide treatment at government expense.`
      : 'The right to health flows from <strong>Article 21 (Right to Life)</strong>. In <em>Paschim Banga (1996)</em>, the Supreme Court held that denial of emergency medical care violates Article 21. The State cannot plead financial constraints.';
    cases = [MOCK_CASES[1]];

  } else if (q.includes('proportional') || q.includes('administrative')) {
    text = 'The <strong>Doctrine of Proportionality</strong> — recognised in <em>Om Kumar v. Union of India (2001)</em> — requires that administrative actions be proportionate to the objective sought. A stricter standard applies when fundamental rights are affected.';
    cases = [MOCK_CASES[2]];

  } else if (q.includes('basic structure') || q.includes('kesavananda')) {
    text = 'The <strong>Basic Structure Doctrine</strong> emerged from <em>Kesavananda Bharati (1973)</em> decided by a 13-judge bench. Parliament cannot amend the Constitution in a way that destroys its basic structure — which includes democracy, secularism, separation of powers, and judicial review.';
    cases = [MOCK_CASES[3]];

  } else if (q.includes('vishaka') || q.includes('harassment') || q.includes('workplace')) {
    text = 'The <strong>Vishaka Guidelines (1997)</strong> were laid down by the Supreme Court in the absence of legislation on workplace sexual harassment, recognising it as a violation of Articles 14, 15, 19 and 21.';
    cases = [MOCK_CASES[4]];

  } else {
    text = 'I found cases relevant to your query. Click <strong>Open Case ↓</strong> to read the full judgment, summary, citations, and PDF.';
    cases = MOCK_CASES.slice(0, 3);
  }

  return { text, cases };
}

function _mockStudy(q) {
  if (q.includes('proportional')) {
    return { sections: [
      { label: 'Topic Summary',   body: 'The Doctrine of Proportionality requires that government measures be proportionate to the objective pursued. It is a cornerstone of judicial review in Indian administrative law.' },
      { label: 'Legal Principle', body: 'Administrative actions must not be excessive or arbitrary. Courts examine: (1) Is the measure suitable? (2) Is it the least restrictive? (3) Does it strike a fair balance between individual rights and public interest?' },
      { label: 'Key Cases',       body: '<ul><li><strong>Om Kumar v. Union of India (2001)</strong> — Primary Indian authority on proportionality review.</li><li><strong>State of MP v. Baldeo Prasad (1960)</strong> — Early recognition of disproportionate administrative action as invalid.</li></ul>' },
      { label: 'Important Points',body: '<ul><li>Stricter standard than Wednesbury unreasonableness.</li><li>Fundamental rights cases attract closer scrutiny.</li><li>Courts check if the decision is within a reasonable range — they do not substitute their own view.</li></ul>' },
      { label: 'Exam Notes',      body: 'Proportionality = was the measure too severe? Cite <em>Om Kumar (2001)</em> as primary authority. Distinguish primary review (courts) vs secondary review (appellate bodies).' },
    ]};
  }
  if (q.includes('basic structure') || q.includes('constitutional')) {
    return { sections: [
      { label: 'Topic Summary',   body: "The Basic Structure Doctrine limits Parliament's power to amend the Constitution under Article 368. Emerged from Kesavananda Bharati (1973)." },
      { label: 'Legal Principle', body: 'Parliament cannot use its amending power to destroy the essential features that form the basic structure of the Constitution.' },
      { label: 'Key Cases',       body: '<ul><li><strong>Kesavananda Bharati (1973)</strong> — 13-judge bench, 7:6 majority — origin of the doctrine.</li><li><strong>Indira Gandhi v. Raj Narain (1975)</strong> — Free and fair elections = basic structure.</li><li><strong>Minerva Mills (1980)</strong> — Judicial review = basic structure.</li></ul>' },
      { label: 'Important Points',body: '<ul><li>No exhaustive list — an evolving, judge-made concept.</li><li>Includes: supremacy of Constitution, democracy, secularism, separation of powers, federalism, judicial review, free elections.</li><li>Test: Does the amendment damage or destroy the constitutional identity?</li></ul>' },
      { label: 'Exam Notes',      body: 'Timeline to know: Golaknath (1967) → 24th Amendment → Kesavananda middle path. Always mention the 7:6 majority. Apply the "identity test" in answers.' },
    ]};
  }
  // Default
  return { sections: [
    { label: 'Topic Summary',   body: 'This topic covers foundational principles of Indian constitutional law, especially the expansive interpretation of Articles 14, 19 and 21.' },
    { label: 'Legal Principle', body: 'The Indian Constitution is a living document. Fundamental rights are not isolated — they are read harmoniously with Directive Principles of State Policy.' },
    { label: 'Key Cases',       body: '<ul><li><strong>Maneka Gandhi v. Union of India (1978)</strong> — Procedure must be just, fair, and reasonable.</li><li><strong>Olga Tellis v. BMCM (1985)</strong> — Right to livelihood under Article 21.</li></ul>' },
    { label: 'Important Points',body: '<ul><li>Article 21 is the most expansively interpreted fundamental right in India.</li><li>Fundamental rights are justiciable; DPSPs are not, but they guide interpretation.</li></ul>' },
    { label: 'Exam Notes',      body: 'Standard Article 21 answer: (1) Identify the right claimed. (2) Is there a State action? (3) Is it protected by Art 21? (4) Is the restriction permissible? Apply the Maneka Gandhi test.' },
  ]};
}

async function _mockSearch(params = {}) {
  await _delay(800);

  const { q = '', court = '', year_from = 0, year_to = 9999, act = '', exclude = '' } = params;
  const qLow     = q.toLowerCase();
  const excludeTerms = exclude ? exclude.split(',').map(s => s.trim().toLowerCase()).filter(Boolean) : [];
  const courtMap = { supreme: 'supreme court', delhi: 'delhi', bombay: 'bombay', madras: 'madras', calcutta: 'calcutta', allahabad: 'allahabad' };

  const cases = MOCK_CASES.filter(c => {
    // Text match
    if (qLow && !(c.name.toLowerCase().includes(qLow) || c.citation.toLowerCase().includes(qLow) || c.tags.some(t => t.includes(qLow)) || c.summary.toLowerCase().includes(qLow))) return false;
    // Court
    if (court && !c.court.toLowerCase().includes(courtMap[court] || court)) return false;
    // Year
    if (year_from && c.year < Number(year_from)) return false;
    if (year_to < 9999 && c.year > Number(year_to)) return false;
    // Act/statute keyword
    if (act && !c.tags.some(t => t.includes(act.toLowerCase()))) return false;
    // Exclude terms
    if (excludeTerms.some(ex => c.name.toLowerCase().includes(ex) || c.tags.some(t => t.includes(ex)))) return false;
    return true;
  });

  return { cases, total: cases.length };
}

// Tiny promise-based delay helper
function _delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
