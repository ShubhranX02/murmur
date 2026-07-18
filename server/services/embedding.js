let pipelineFn = null;
let extractor = null;
let extractorPromise = null;

const EMBEDDING_BATCH_SIZE = 16;
const MATCH_SCORE_SCALE_VERSION = 2;

// The score scale makes strong compatibility feel as strong as it is while
// preserving every ordering relationship in the underlying match calculation.
const MATCH_SCORE_SCALE = [
  [0, 0],
  [10, 10],
  [20, 20],
  [30, 32],
  [40, 48],
  [50, 60],
  [60, 71],
  [70, 82],
  [80, 90],
  [90, 95],
  [100, 100]
];

async function getExtractor() {
  if (extractor) return extractor;

  // Reuse the same loading promise if several users begin onboarding together.
  if (!extractorPromise) {
    extractorPromise = (async () => {
      if (!pipelineFn) {
        const module = await import('@huggingface/transformers');
        pipelineFn = module.pipeline;
      }

      console.log('Loading embedding model... (this may take a moment on first run)');
      extractor = await pipelineFn('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
      console.log('Embedding model loaded successfully!');
      return extractor;
    })().catch(error => {
      extractorPromise = null;
      throw error;
    });
  }

  return extractorPromise;
}

async function generateEmbedding(text) {
  const [embedding] = await batchEmbed([text]);
  return embedding;
}

async function batchEmbed(texts) {
  if (!texts.length) return [];

  const extract = await getExtractor();
  const embeddings = [];

  // Sending a group of video descriptions to the model in one call avoids
  // hundreds of sequential inference runs on Render's limited CPU.
  for (let start = 0; start < texts.length; start += EMBEDDING_BATCH_SIZE) {
    const batch = texts.slice(start, start + EMBEDDING_BATCH_SIZE);
    const output = await extract(batch, { pooling: 'mean', normalize: true });
    const dimensions = output.dims[output.dims.length - 1];
    const values = output.data;

    for (let index = 0; index < batch.length; index++) {
      const offset = index * dimensions;
      embeddings.push(Array.from(values.slice(offset, offset + dimensions)));
    }

    console.log(`Generated embeddings for ${Math.min(start + batch.length, texts.length)}/${texts.length} items`);
  }

  return embeddings;
}

function cosineSimilarity(vecA, vecB) {
  if (!Array.isArray(vecA) || !Array.isArray(vecB) || vecA.length === 0 || vecA.length !== vecB.length) {
    return 0;
  }

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



function skewMatchScore(rawScore) {
  const score = Math.max(0, Math.min(100, Number(rawScore) || 0));

  for (let index = 1; index < MATCH_SCORE_SCALE.length; index++) {
    const [upperInput, upperOutput] = MATCH_SCORE_SCALE[index];
    if (score <= upperInput) {
      const [lowerInput, lowerOutput] = MATCH_SCORE_SCALE[index - 1];
      const progress = (score - lowerInput) / (upperInput - lowerInput);
      return Math.round(lowerOutput + progress * (upperOutput - lowerOutput));
    }
  }

  return 100;
}

function computeMatchScore(userA, userB) {
  // 1. Embedding Similarity
  const embSim = cosineSimilarity(userA.embedding || [], userB.embedding || []);

  // 2. Category Similarity
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
  // 60% embeddings, 40% categories
  // Clamp similarities between 0 and 1 to prevent negative scores
  const clampedEmbSim = Math.max(0, Math.min(1, embSim));
  const clampedCatSim = Math.max(0, Math.min(1, catSim));
  
  const embeddingScore = Math.round(clampedEmbSim * 100);
  const categoryScore = Math.round(clampedCatSim * 100);
  const rawScore = Math.round((0.6 * embeddingScore) + (0.4 * categoryScore));
  const score = skewMatchScore(rawScore);

  return {
    score,
    rawScore,
    scoreScaleVersion: MATCH_SCORE_SCALE_VERSION,
    embeddingScore,
    categoryScore
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
  skewMatchScore,
  MATCH_SCORE_SCALE_VERSION,
  computeMatchScore,
  createUserEmbedding
};
