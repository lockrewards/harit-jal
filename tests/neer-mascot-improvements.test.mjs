import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';

let viteServer;
let IntentDetector;
let NeerAIService;
let KnowledgeBaseService;

describe('NEER AI MASCOT REMEDIATION & PRODUCT KNOWLEDGE TESTS', () => {
  before(async () => {
    // Setup in-memory localStorage for Node environment
    const store = new Map();
    globalThis.localStorage = {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(String(k), String(v)),
      removeItem: (k) => store.delete(String(k)),
      clear: () => store.clear(),
    };

    viteServer = await createServer({
      server: { middlewareMode: true },
      appType: 'custom',
    });

    ({ IntentDetector } = await viteServer.ssrLoadModule('/src/services/intentDetector.ts'));
    ({ KnowledgeBaseService } = await viteServer.ssrLoadModule('/src/services/knowledgeBase.ts'));
    ({ NeerAIService } = await viteServer.ssrLoadModule('/src/services/neerAI.ts'));
  });

  after(async () => {
    if (viteServer) {
      await viteServer.close();
    }
  });

  it('TEST 1: Customer Name "samrat kumar" on First Turn (Unprompted)', async () => {
    const analysis = IntentDetector.analyze('samrat kumar');
    assert.equal(analysis.primaryIntent, 'name_provided', 'Must detect name_provided intent');
    assert.equal(analysis.entities.customerName, 'Samrat Kumar', 'Must accurately extract "Samrat Kumar"');

    const res = await NeerAIService.processMessage('samrat kumar', [], {
      language: 'hinglish',
      currentPage: '/home',
      turnsCount: 0,
    });

    assert.ok(res.response.text.includes('Samrat Kumar'), 'Neer response must include customer name Samrat Kumar');
    assert.ok(
      res.response.text.toLowerCase().includes('mobile number') || res.response.text.toLowerCase().includes('phone'),
      'Must ask for mobile number after receiving customer name'
    );
    assert.equal(res.updatedContext.customerName, 'Samrat Kumar');
  });

  it('TEST 2: Customer Name "samrat" without letter mangling ("mr" not stripped)', async () => {
    const analysis = IntentDetector.analyze('samrat');
    assert.equal(analysis.primaryIntent, 'name_provided', 'Must detect name_provided intent for single word name');
    assert.equal(analysis.entities.customerName, 'Samrat', 'Must be "Samrat", NEVER "Saat"');
    assert.notEqual(analysis.entities.customerName, 'Saat', 'Letter mr inside Samrat must NOT be stripped');

    const res = await NeerAIService.processMessage('samrat', [], {
      language: 'english',
      currentPage: '/home',
      turnsCount: 1,
      lastQuestionAsked: 'customer_name',
    });

    assert.ok(res.response.text.includes('Samrat'), 'Response must address customer as Samrat');
    assert.ok(!res.response.text.includes('Saat'), 'Response must NOT contain "Saat"');
  });

  it('TEST 3: 1 Liter Bottle Query "ky aap ke pash 1liter ka bottle hai"', async () => {
    const query = 'ky aap ke pash 1liter ka bottle hai';
    const analysis = IntentDetector.analyze(query);

    assert.equal(analysis.entities.bottleSize, '1000ml', 'Must normalize 1liter to 1000ml');
    assert.equal(analysis.primaryIntent, 'product_info', 'Must detect product_info intent');

    const res = await NeerAIService.processMessage(query, [], {
      language: 'hinglish',
      currentPage: '/home',
      turnsCount: 0,
    });

    const reply = res.response.text.toLowerCase();
    assert.ok(
      reply.includes('1000ml') || reply.includes('1 litre') || reply.includes('1 liter'),
      'Reply must confirm availability of 1000ml / 1 Litre bottles'
    );
    assert.ok(
      reply.includes('dhaba') || reply.includes('family') || reply.includes('estate') || reply.includes('11.00'),
      'Reply must specify 1000ml models (Dhaba PET / Estate Glass) and pricing'
    );
    // Crucial: Must NOT return 500ml Classic Dining Glass Bottle
    assert.ok(
      !reply.includes('the 500ml classic dining glass bottle is crafted'),
      'Reply must NEVER confuse 1000ml with the 500ml classic dining bottle'
    );
  });

  it('TEST 4: RAG Knowledge Base Size Isolation (1000ml vs 500ml)', () => {
    const results1L = KnowledgeBaseService.searchKnowledge('1liter bottle', 3);
    assert.ok(results1L.length > 0, 'Must return at least 1 result for 1liter bottle');
    assert.ok(
      results1L[0].item.title.toLowerCase().includes('1000ml') || results1L[0].item.title.toLowerCase().includes('1 litre'),
      `Top result for 1liter must be 1000ml, got: ${results1L[0].item.title}`
    );

    const results500 = KnowledgeBaseService.searchKnowledge('500ml bottle price', 3);
    assert.ok(results500.length > 0, 'Must return at least 1 result for 500ml');
    assert.ok(
      results500[0].item.title.toLowerCase().includes('500ml'),
      `Top result for 500ml must be 500ml, got: ${results500[0].item.title}`
    );
  });

  it('TEST 5: Continuous Learning & Auto-Training Queue for Unanswered Queries', async () => {
    NeerAIService.clearUnansweredQueries();
    const initialAnalytics = NeerAIService.getAnalytics();
    assert.equal(initialAnalytics.unansweredQueries.length, 0, 'Queue must be empty initially');

    // Trigger an out-of-scope query
    const outOfScopeQuery = 'kya aap spaceship banate ho';
    await NeerAIService.processMessage(outOfScopeQuery, [], {
      language: 'hinglish',
      currentPage: '/home',
      turnsCount: 0,
    });

    const updatedAnalytics = NeerAIService.getAnalytics();
    assert.ok(
      updatedAnalytics.unansweredQueries.some(q => q.query.toLowerCase().includes('spaceship')),
      'Unanswered query must be recorded into the learning queue for admin training'
    );
  });
});

