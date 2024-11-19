import { useRef, useEffect, useState } from "react";
import { ScrollToBottom } from "./scroll-to-bottom";
import { Message } from "./simple-chatbot";
import { MessageBubble } from "./message-bubble";

interface MessageListProps {
  messages: Message[];
}

export function MessageList({ messages }: MessageListProps) {
  const [showScrollButton, setShowScrollButton] = useState(false);
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
    <div className="relative">
      <div
        ref={containerRef}
        onScroll={(e) => {
          const target = e.target as HTMLDivElement;
          const isNearBottom =
            target.scrollHeight - target.scrollTop - target.clientHeight < 100;
          setShowScrollButton(!isNearBottom);
        }}
        className="message-list-container flex flex-col overflow-y-auto scroll-smooth message-scroll-area px-2 sm:px-3 md:px-4 space-y-2 sm:space-y-3 md:space-y-4"
      >
        {messages.map((msg, index) => (
          <MessageBubble key={index} message={msg} />
        ))}
        <div ref={messagesEndRef} className="h-4" />
        <ScrollToBottom
          visible={showScrollButton}
          onClick={() => scrollToBottom("smooth")}
        />
      </div>
    </div>
  );
}
