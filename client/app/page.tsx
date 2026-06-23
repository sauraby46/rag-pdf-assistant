import FileUploadComponent from './components/file-upload';
import ChatComponent from './components/chat';

export default function Home() {
  return (
    <div className="h-full w-full overflow-hidden">
      <div className="flex h-full w-full">
        <div className="w-[40vw] h-full p-4 flex items-center justify-center">
          <FileUploadComponent />
        </div>
        <div className="w-[60vw] h-full border-l border-slate-200">
          <ChatComponent />
        </div>
      </div>
    </div>
  );
}
