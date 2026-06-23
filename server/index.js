import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { Queue } from "bullmq";
import { QdrantVectorStore } from "@langchain/qdrant";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { GoogleGenAI } from '@google/genai';
import { clerkMiddleware, getAuth } from '@clerk/express';

const ai = new GoogleGenAI({
    apiKey: process.env.GOOGLE_API_KEY,
});

const redisConnection = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
};

if (process.env.REDIS_PASSWORD) {
    redisConnection.password = process.env.REDIS_PASSWORD;
    redisConnection.tls = {}; // Upstash requires SSL/TLS
}

const queue = new Queue("file-upload-queue", {
    connection: redisConnection
});


const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, `${uniqueSuffix}-${file.originalname}`);
    }
});

const app = express();
app.use(cors());
app.use(clerkMiddleware());
const upload = multer({ storage: storage });

app.get('/', (req, res) => {
    res.send('Hello World!');
});
 
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.post('/upload/pdf', upload.single('pdf'), async (req, res) => {
    const { userId } = getAuth(req);
    if (!userId) {
        return res.status(401).json({ message: 'Unauthorized' });
    }
    if (!req.file) {
        return res.status(400).json({ message: 'No PDF file was uploaded.' });
    }

    try {
        await queue.add('file-ready', {
            fileName: req.file.originalname,
            destination: req.file.destination,
            path: req.file.path,
        });

        return res.json({ message: 'PDF uploaded successfully' });
    } catch (error) {
        console.error('Upload succeeded, but job enqueue failed:', error);
        return res.status(202).json({
            message: 'PDF uploaded successfully, but processing is pending because the queue is unavailable.',
        });
    }
});

app.get('/chat', async (req, res) => {
    const { userId } = getAuth(req);
    if (!userId) {
        return res.status(401).json({ message: 'Unauthorized' });
    }
    const userQuery = req.query.message;

    const embeddings = new GoogleGenerativeAIEmbeddings({
            model: "gemini-embedding-001",
            apiKey: process.env.GOOGLE_API_KEY,
    });

    const vectorStore = await QdrantVectorStore.fromExistingCollection(
        embeddings,
        {
            url: process.env.QDRANT_URL || 'http://localhost:6333',
            apiKey: process.env.QDRANT_API_KEY,
            collectionName: process.env.QDRANT_COLLECTION_NAME || 'pdf-docs',
        }
    );

    const ret = vectorStore.asRetriever({
        k: 5,
    });
    const result = await ret.invoke(userQuery);

    const SYSTEM_PROMPT = `
    You are a helpful assistant for answering questions based on the provided context. Use only the information from the retrieved documents to answer the user's question. If you don't know the answer, say you don't know. Always use all available information from the retrieved documents to provide a comprehensive answer.
    Context:
    ${JSON.stringify(result)}
    `;
    const chatResult = await ai.models.generateContent({
        model: "gemini-2.5-flash", 
        contents: userQuery, 

        config: {
        systemInstruction: SYSTEM_PROMPT, 
        }
    });

    return res.json({ 
        message: chatResult.text, 
        docs: result 
    });
})

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
    console.log(`Server is running on port: ${PORT}`);
});

// Start the BullMQ worker inside the same process to run everything for free!
import './worker.js';
