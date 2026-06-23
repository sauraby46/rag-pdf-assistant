'use client';

import * as React from "react";
import { FileUp, UploadCloud, X } from 'lucide-react';
import { useAuth } from "@clerk/nextjs";

const FileUploadComponent: React.FC = () => {
    const { getToken } = useAuth();
    const inputRef = React.useRef<HTMLInputElement | null>(null);
    const [isDragging, setIsDragging] = React.useState(false);
    const [isUploading, setIsUploading] = React.useState(false);
    const [selectedFileName, setSelectedFileName] = React.useState<string | null>(null);
    const [statusMessage, setStatusMessage] = React.useState<string>("Drop a PDF here or browse to upload.");

    const uploadFile = async (file: File) => {
        if (file.type !== 'application/pdf') {
            setStatusMessage('Please upload a PDF file.');
            return;
        }

        setIsUploading(true);
        setSelectedFileName(file.name);
        setStatusMessage(`Uploading ${file.name}...`);

        try {
            const token = await getToken();
            const formData = new FormData();
            formData.append('pdf', file);

            const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
            const response = await fetch(`${apiBaseUrl}/upload/pdf`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData,
            });

            if (!response.ok) {
                throw new Error('Upload failed');
            }

            setStatusMessage(`${file.name} uploaded successfully.`);
            console.log('File uploaded successfully');
        } catch (error) {
            console.error('File upload failed:', error);
            setStatusMessage('Upload failed. Please try again.');
        } finally {
            setIsUploading(false);
        }
    };

    const handleFileUploadButtonClick = () => {
        inputRef.current?.click();
    };

    const handleDrop = async (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        setIsDragging(false);

        const file = event.dataTransfer.files?.[0];
        if (file) {
            await uploadFile(file);
        }
    };

    const handleInputChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            await uploadFile(file);
        }
    };

    return (
        <div className="w-full max-w-xl rounded-[2rem] border border-white/20 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 p-6 text-white shadow-[0_24px_80px_rgba(15,23,42,0.35)]">
            <div className="mb-6 flex items-start justify-between gap-4">
                <div>
                    <p className="text-sm font-medium uppercase tracking-[0.24em] text-sky-300">Document ingest</p>
                    <h3 className="mt-2 text-2xl font-semibold text-white">Upload your PDF</h3>
                    <p className="mt-2 max-w-md text-sm leading-6 text-slate-300">
                        Drag and drop a PDF or use the file picker. Your document will be processed and indexed for chat.
                    </p>
                </div>
                <div className="rounded-2xl bg-white/10 p-3 text-sky-300 ring-1 ring-white/10">
                    <FileUp className="h-6 w-6" />
                </div>
            </div>

            <div
                onClick={handleFileUploadButtonClick}
                onDragEnter={(event) => {
                    event.preventDefault();
                    setIsDragging(true);
                }}
                onDragOver={(event) => {
                    event.preventDefault();
                    setIsDragging(true);
                }}
                onDragLeave={(event) => {
                    event.preventDefault();
                    setIsDragging(false);
                }}
                onDrop={handleDrop}
                className={`group relative flex min-h-64 cursor-pointer flex-col items-center justify-center rounded-[1.75rem] border border-dashed px-6 py-10 text-center transition-all duration-200 ${
                    isDragging
                        ? 'border-sky-300 bg-sky-400/10 shadow-[0_0_0_1px_rgba(125,211,252,0.3)]'
                        : 'border-white/15 bg-white/5 hover:border-sky-300/60 hover:bg-white/10'
                }`}
            >
                <input
                    ref={inputRef}
                    type="file"
                    accept="application/pdf"
                    className="hidden"
                    onChange={handleInputChange}
                />

                <div className="mb-4 rounded-full bg-white/10 p-4 text-sky-300 transition-transform duration-200 group-hover:scale-105">
                    <UploadCloud className="h-8 w-8" />
                </div>

                <p className="text-lg font-medium text-white">Drag & drop your PDF here</p>
                <p className="mt-2 text-sm text-slate-300">or click to browse files from your device</p>

                <div className="mt-6 flex flex-wrap items-center justify-center gap-2 text-xs text-slate-300">
                    <span className="rounded-full bg-white/10 px-3 py-1">PDF only</span>
                    <span className="rounded-full bg-white/10 px-3 py-1">Fast upload</span>
                    <span className="rounded-full bg-white/10 px-3 py-1">Chat-ready indexing</span>
                </div>

                {selectedFileName ? (
                    <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm text-white ring-1 ring-white/10">
                        <span className="max-w-[220px] truncate">{selectedFileName}</span>
                        <button
                            type="button"
                            onClick={(event) => {
                                event.stopPropagation();
                                setSelectedFileName(null);
                                setStatusMessage('Drop a PDF here or browse to upload.');
                                if (inputRef.current) {
                                    inputRef.current.value = '';
                                }
                            }}
                            className="rounded-full p-1 text-slate-300 transition hover:bg-white/10 hover:text-white"
                            aria-label="Clear selected file"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                ) : null}

                <p className="mt-5 text-sm text-slate-300">
                    {isUploading ? 'Uploading your document...' : statusMessage}
                </p>
            </div>
        </div>
    );
};


export default FileUploadComponent;