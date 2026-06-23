'use client';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import * as React from "react";
import { useAuth } from "@clerk/nextjs";

interface Doc {
    pageContent?: string;
    metadata?: {
        loc?: {
            pageNumber?: number;
        };
        source?: string;
    };
}

interface IMessage {
    role: 'assistant' | 'user';
    content?: string;
    documents?: Doc[];
}

type ChatResponse = {
    message?: string;
    docs?: Doc[];
    data?: {
        message?: string;
        docs?: Doc[];
    };
};

const getOriginalFileName = (source?: string) => {
    if (!source) {
        return 'Unknown file';
    }

    const fileName = source.split(/[/\\]/).pop() ?? source;
    const parts = fileName.split('-');

    return parts.length > 2 ? parts.slice(2).join('-') : fileName;
};

const ChatComponent: React.FC = () => {
    const { getToken } = useAuth();
    const [message, setMessage] = React.useState<string>("");
    const [chatHistory, setChatHistory] = React.useState<IMessage[]>([]);
    const [isSending, setIsSending] = React.useState(false);

    const handleSendChatMessage = async () => {
        const trimmedMessage = message.trim();

        if (!trimmedMessage || isSending) {
            return;
        }

        setIsSending(true);
        setChatHistory((prev) => [...prev, { role: 'user', content: trimmedMessage }]);
        setMessage("");

        try {
            const token = await getToken();
            const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
            const res = await fetch(`${apiBaseUrl}/chat?message=${encodeURIComponent(trimmedMessage)}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (!res.ok) {
                const errorText = await res.text();
                throw new Error(`Request failed with status ${res.status}: ${errorText}`);
            }
            const data: ChatResponse = await res.json();
            const assistantMessage = data?.message ?? data?.data?.message ?? 'No response returned from the server.';
            const assistantDocs = data?.docs ?? data?.data?.docs;

            setChatHistory((prev) => [...prev, { role: 'assistant', content: assistantMessage, documents: assistantDocs }]);
            console.log("Received response:", data);
        } catch (error) {
            setChatHistory((prev) => [...prev, { role: 'assistant', content: 'Sorry, I could not load a response right now.' }]);
            console.error("Chat request failed:", error);
        } finally {
            setIsSending(false);
        }
    }

    return(
        <div className="flex h-full min-h-0 flex-col bg-slate-50 p-4">
            <div className="flex-1 min-h-0 space-y-4 overflow-y-auto pb-28">
                {chatHistory.map((msg, idx) => (
                    <div
                        key={idx}
                        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                        <div
                            className={`max-w-[80%] rounded-2xl px-4 py-3 shadow-sm ${msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-white text-slate-900 border border-slate-200'}`}
                        >
                            <p className="whitespace-pre-wrap text-sm leading-6">
                                {msg.content ?? 'No content available.'}
                            </p>
                            {msg.documents?.map((doc, docIdx) => (
                                <div key={docIdx} className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
                                    <p>
                                        Reference: page {doc.metadata?.loc?.pageNumber ?? 'Unknown'}, {getOriginalFileName(doc.metadata?.source)}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
            <div className="sticky bottom-0 border-t border-slate-200 bg-white/95 px-0 py-4 backdrop-blur">
                <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
                <Input
                    value={message}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            handleSendChatMessage();
                        }
                    }}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Type your message..." />  
                <Button onClick={ handleSendChatMessage } disabled={!message.trim() || isSending}>
                    {isSending ? 'Sending...' : 'Send'}
                </Button>
                </div>
            </div>
        </div>
    )
}

export default ChatComponent;