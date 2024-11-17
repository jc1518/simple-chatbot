import { Message } from "./simple-chatbot";
import { Bot, User } from "lucide-react";
import { CodeBlock } from "./code-block";

interface MessageBubbleProps {
  message: Message;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const detectCodeBlocks = (text: string) => {
    const segments = text.split("```");
    if (segments.length < 3) return [{ type: "text", content: text }];

    return segments.map((segment, index) => {
      if (index % 2 === 0) {
        return { type: "text", content: segment };
      } else {
        const lines = segment.split("\n");
        const language = lines[0].trim();
        const code = lines.slice(1).join("\n");
        return { type: "code", content: code, language };
      }
    });
  };

  const renderContent = (text: string) => {
    const segments = detectCodeBlocks(text);

    return segments.map((segment, index) => {
      if (segment.type === "text") {
        return segment.content.split("\n").map((line, lineIndex) => (
          <p key={`${index}-${lineIndex}`} className="whitespace-pre-wrap">
            {line}
          </p>
        ));
      } else {
        return (
          <div key={index} className="my-2">
            <CodeBlock code={segment.content} language={segment.language!} />
          </div>
        );
      }
    });
  };

  if (message.isLoading) {
    return (
      <div className="flex mb-4 justify-start">
        <div className="flex items-start space-x-2 max-w-[80%]">
          <div className="p-2 rounded-full bg-gray-200 dark:bg-gray-700">
            <Bot className="h-5 w-5 text-gray-600 dark:text-gray-300" />
          </div>
          <div className="bg-gray-100 dark:bg-gray-800 rounded-lg px-4 py-2">
            <div className="flex space-x-2">
              <div className="animate-bounce">●</div>
              <div className="animate-bounce delay-100">●</div>
              <div className="animate-bounce delay-200">●</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex mb-4 ${
        message.sender === "user" ? "justify-end" : "justify-start"
      }`}
    >
      <div
        className={`flex items-start space-x-2 max-w-[80%] ${
          message.sender === "user" ? "flex-row-reverse space-x-reverse" : ""
        }`}
      >
        <div
          className={`p-2 rounded-full ${
            message.sender === "user"
              ? "bg-blue-600"
              : "bg-gray-200 dark:bg-gray-700"
          }`}
        >
          {message.sender === "user" ? (
            <User className="h-5 w-5 text-white" />
          ) : (
            <Bot className="h-5 w-5 text-gray-600 dark:text-gray-300" />
          )}
        </div>
        <div
          className={`p-4 rounded-lg ${
            message.sender === "user"
              ? "bg-blue-600 text-white"
              : "bg-gray-100 dark:bg-gray-800"
          }`}
        >
          {renderContent(message.text)}
        </div>
      </div>
    </div>
  );
}
