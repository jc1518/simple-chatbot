import { Bot } from "lucide-react";

export function LoadingIndicator({ isLoading }: { isLoading: boolean }) {
  if (!isLoading) return null;

  return (
    <div className="flex justify-start mb-4">
      <div className="flex items-start space-x-2 max-w-[70%]">
        <div className="p-2 rounded-full bg-secondary">
          <Bot className="h-5 w-5 text-secondary-foreground" />
        </div>
        <div className="p-3 rounded-lg bg-secondary text-secondary-foreground">
          <div className="animate-pulse flex space-x-1">
            <div className="w-2 h-2 bg-current rounded-full"></div>
            <div className="w-2 h-2 bg-current rounded-full"></div>
            <div className="w-2 h-2 bg-current rounded-full"></div>
          </div>
        </div>
      </div>
    </div>
  );
}
