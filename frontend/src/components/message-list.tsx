import { useRef, useEffect } from "react";
import { Message } from "./simple-chatbot";
import { MessageBubble } from "./message-bubble";

interface MessageListProps {
  messages: Message[];
}

export function MessageList({ messages }: MessageListProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const prevMessagesLengthRef = useRef(messages.length);

  const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
    if (messagesEndRef.current && containerRef.current) {
      const container = containerRef.current;
      const scrollTarget = messagesEndRef.current;

      container.scrollTo({
        top: scrollTarget.offsetTop,
        behavior,
      });
    }
  };

  useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    const hasNewMessage = messages.length > prevMessagesLengthRef.current;
    const isNotLoading = !lastMessage?.isLoading;

    if (hasNewMessage) {
      if (lastMessage.sender === "user") {
        // For user messages, scroll immediately but smoothly
        scrollToBottom("smooth");
      } else if (isNotLoading) {
        // For bot messages, add a small delay
        setTimeout(() => scrollToBottom("smooth"), 100);
      }
    }

    prevMessagesLengthRef.current = messages.length;
  }, [messages]);

  return (
    <div
      ref={containerRef}
      className="flex flex-col h-[600px] overflow-y-auto scroll-smooth"
    >
      {messages.map((msg, index) => (
        <MessageBubble key={index} message={msg} />
      ))}
      <div ref={messagesEndRef} className="h-4" />
    </div>
  );
}
