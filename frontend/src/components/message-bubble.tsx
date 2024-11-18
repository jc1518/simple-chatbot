import { Message } from "./simple-chatbot";
import { Bot, User } from "lucide-react";
import { CodeBlock } from "./code-block";
import { motion } from "framer-motion";

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
          <p
            key={`${index}-${lineIndex}`}
            className="whitespace-pre-wrap leading-relaxed"
          >
            {line}
          </p>
        ));
      } else {
        return (
          <div key={index} className="my-3">
            <CodeBlock code={segment.content} language={segment.language!} />
          </div>
        );
      }
    });
  };

  if (message.isLoading) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex mb-4 justify-start message-transition"
      >
        <div className="flex items-start space-x-3 max-w-[85%]">
          <div className="p-2.5 rounded-full bg-gradient-to-br from-cyan-200 to-blue-300 dark:from-cyan-700 dark:to-blue-800 shadow-sm">
            <Bot className="h-5 w-5 text-gray-600 dark:text-gray-300" />
          </div>
          <div className="bg-gradient-to-br from-cyan-50 to-blue-100 dark:from-cyan-900 dark:to-blue-950 rounded-2xl px-5 py-3 shadow-sm">
            <div className="flex space-x-2">
              <div className="animate-bounce">●</div>
              <div className="animate-bounce delay-100">●</div>
              <div className="animate-bounce delay-200">●</div>
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex mb-6 ${
        message.sender === "user" ? "justify-end" : "justify-start"
      }`}
    >
      <div
        className={`flex items-start space-x-3 max-w-[85%] ${
          message.sender === "user" ? "flex-row-reverse space-x-reverse" : ""
        }`}
      >
        <div
          className={`p-2.5 rounded-full shadow-sm ${
            message.sender === "user"
              ? "bg-gradient-to-br from-blue-500 to-cyan-600"
              : "bg-gradient-to-br from-cyan-200 to-blue-300 dark:from-cyan-700 dark:to-blue-800"
          }`}
        >
          {message.sender === "user" ? (
            <User className="h-5 w-5 text-white" />
          ) : (
            <Bot className="h-5 w-5 text-gray-600 dark:text-gray-300" />
          )}
        </div>
        <div
          className={`p-5 rounded-2xl shadow-sm ${
            message.sender === "user"
              ? "bg-gradient-to-br from-blue-500 to-cyan-600 text-white"
              : "bg-gradient-to-br from-cyan-50 to-blue-100 dark:from-cyan-900 dark:to-blue-950"
          }`}
        >
          {renderContent(message.text)}
        </div>
      </div>
    </motion.div>
  );
}
