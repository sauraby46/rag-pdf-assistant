import 'dotenv/config';
import { Worker } from 'bullmq';
import { QdrantVectorStore } from "@langchain/qdrant";
import { PDFLoader} from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";

const redisConnection = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
};

if (process.env.REDIS_PASSWORD) {
    redisConnection.password = process.env.REDIS_PASSWORD;
    redisConnection.tls = {}; // Upstash requires SSL/TLS
}

const worker = new Worker(
    'file-upload-queue',
    async job => {
        console.log('Processing job:', job.id);
        const data = typeof job.data === 'string' ? JSON.parse(job.data) : job.data;

        if (!process.env.GOOGLE_API_KEY) {
            throw new Error('GOOGLE_API_KEY is missing. Set it before starting the worker.');
        }

        const loader = new PDFLoader(data.path);
        const docs = await loader.load();

        // Split long pages into smaller chunks before embedding.
        const splitter = new RecursiveCharacterTextSplitter({ chunkSize: 1000, chunkOverlap: 200 });
        const splitDocs = await splitter.splitDocuments(docs);
        
        const embeddings = new GoogleGenerativeAIEmbeddings({
            model: "gemini-embedding-001",
            apiKey: process.env.GOOGLE_API_KEY,
        });

        const vectorStore = new QdrantVectorStore(
            embeddings,
            {
                url: process.env.QDRANT_URL || 'http://localhost:6333',
                collectionName: process.env.QDRANT_COLLECTION_NAME || 'pdf-docs',
            }
        );

        const batchSize = 50;
        for (let i = 0; i < splitDocs.length; i += batchSize) {
            const batch = splitDocs.slice(i, i + batchSize);
            console.log(`Ingesting batch ${i / batchSize + 1}/${Math.ceil(splitDocs.length / batchSize)} (size: ${batch.length})...`);
            
            let attempts = 0;
            const maxAttempts = 4;
            while (attempts < maxAttempts) {
                try {
                    await vectorStore.addDocuments(batch);
                    break;
                } catch (err) {
                    attempts++;
                    if (attempts >= maxAttempts) {
                        throw err;
                    }
                    console.warn(`Batch failed (attempt ${attempts}/${maxAttempts}). Retrying in 6 seconds...`, err.message);
                    await new Promise(resolve => setTimeout(resolve, 6000));
                }
            }
            
            if (i + batchSize < splitDocs.length) {
                // Wait 5 seconds between batches to respect free tier rate limits (15 RPM)
                await new Promise(resolve => setTimeout(resolve, 5000));
            }
        }
        console.log('Documents added to Qdrant collection: pdf-docs');

}, { concurrency: 100, connection: redisConnection }
);

worker.on('completed', (job) => {
    console.log(`Job completed: ${job.id}`);
});

worker.on('failed', (job, err) => {
    console.error(`Job failed: ${job?.id}`, err);
});

console.log('Worker is running and waiting for jobs...');