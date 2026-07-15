let pipelineFn = null;
let extractor = null;

async function getExtractor() {
  if (!extractor) {
    if (!pipelineFn) {
      const module = await import('@huggingface/transformers');
      pipelineFn = module.pipeline;
    }
    console.log('Loading embedding model... (this may take a moment on first run)');
    extractor = await pipelineFn('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    console.log('Embedding model loaded successfully!');
  }
  return extractor;
}

async function generateEmbedding(text) {
  const extract = await getExtractor();
  const output = await extract(text, { pooling: 'mean', normalize: true });
  return Array.from(output.data);
}

async function batchEmbed(texts) {
  const embeddings = [];
  for (let i = 0; i < texts.length; i++) {
    embeddings.push(await generateEmbedding(texts[i]));
    if ((i + 1) % 10 === 0) {
      console.log(`Generated embeddings for ${i + 1}/${texts.length} items`);
    }
  }
  return embeddings;
}

function cosineSimilarity(vecA, vecB) {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

function jaccardSimilarity(setA, setB) {
  const intersection = new Set([...setA].filter(x => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  if (union.size === 0) return 0;
  return intersection.size / union.size;
}

function computeMatchScore(userA, userB) {
  // 1. Embedding Similarity
  const embSim = cosineSimilarity(userA.embedding || [], userB.embedding || []);

  // 2. Subscription Similarity
  const subsA = new Set(userA.subscriptionIds || []);
  const subsB = new Set(userB.subscriptionIds || []);
  const subSim = jaccardSimilarity(subsA, subsB);

  // 3. Category Similarity
  const catDistA = userA.categoryDistribution || {};
  const catDistB = userB.categoryDistribution || {};
  const allCategories = new Set([...Object.keys(catDistA), ...Object.keys(catDistB)]);
  
  const catVecA = [];
  const catVecB = [];
  
  allCategories.forEach(cat => {
    catVecA.push(catDistA[cat] || 0);
    catVecB.push(catDistB[cat] || 0);
  });
  
  const catSim = cosineSimilarity(catVecA, catVecB);

  // Weighted Score
  // 50% embeddings, 30% subscriptions, 20% categories
  const rawScore = (0.5 * embSim) + (0.3 * subSim) + (0.2 * catSim);

  // Normalize using sigmoid
  const normalized = 1 / (1 + Math.exp(-8 * (rawScore - 0.3)));
  const score = Math.round(normalized * 100);

  return {
    score,
    embeddingScore: Math.round(embSim * 100),
    subscriptionScore: Math.round(subSim * 100),
    categoryScore: Math.round(catSim * 100)
  };
}

function createUserEmbedding(videoEmbeddings) {
  if (!videoEmbeddings || videoEmbeddings.length === 0) return [];
  
  const dim = videoEmbeddings[0].length;
  const avg = new Array(dim).fill(0);
  
  for (const emb of videoEmbeddings) {
    for (let i = 0; i < dim; i++) {
      avg[i] += emb[i];
    }
  }
  
  let magnitude = 0;
  for (let i = 0; i < dim; i++) {
    avg[i] /= videoEmbeddings.length;
    magnitude += avg[i] * avg[i];
  }
  
  magnitude = Math.sqrt(magnitude);
  
  if (magnitude > 0) {
    for (let i = 0; i < dim; i++) {
      avg[i] /= magnitude;
    }
  }
  
  return avg;
}

module.exports = {
  getExtractor,
  generateEmbedding,
  batchEmbed,
  cosineSimilarity,
  jaccardSimilarity,
  computeMatchScore,
  createUserEmbedding
};
