import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Bot, User } from "lucide-react";
import { fetchAuthSession } from "aws-amplify/auth";
import { SignatureV4 } from "@aws-sdk/signature-v4";
import { HttpRequest } from "@aws-sdk/protocol-http";
import { Sha256 } from "@aws-crypto/sha256-browser";

interface ChatBotProps {
  apiUrl: string;
}

interface Message {
  text: string;
  sender: "user" | "bot";
}

interface BedrockMessage {
  role: "user" | "assistant";
  content: Array<{ text: string }>;
}

export function ChatBot(props: ChatBotProps) {
  const [input, setInput] = useState<string>("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;

    setMessages((prev) => [...prev, { text: input, sender: "user" }]);
    setInput("");
    setIsLoading(true);

    try {
      const bedrockMessages: BedrockMessage[] = messages.map((msg) => ({
        role: msg.sender === "user" ? "user" : "assistant",
        content: [{ text: msg.text }],
      }));
      bedrockMessages.push({
        role: "user",
        content: [{ text: input }],
      });
      const { credentials } = await fetchAuthSession();

      const url = new URL(props.apiUrl);

      const request = new HttpRequest({
        method: "POST",
        protocol: url.protocol,
        hostname: url.hostname,
        path: url.pathname,
        headers: {
          "Content-Type": "application/json",
          host: url.hostname,
        },
        body: JSON.stringify({ messages: bedrockMessages }),
      });

      const signer = new SignatureV4({
        credentials: {
          accessKeyId: credentials!.accessKeyId,
          secretAccessKey: credentials!.secretAccessKey,
          sessionToken: credentials!.sessionToken,
        },
        region: "ap-southeast-2",
        service: "lambda",
        sha256: Sha256,
      });

      const signedRequest = await signer.sign(request);

      const response = await fetch(props.apiUrl, {
        method: signedRequest.method,
        headers: signedRequest.headers,
        body: signedRequest.body,
      });

      if (!response.ok) {
        console.error("Response status:", response.status);
        console.error(
          "Response headers:",
          Object.fromEntries(response.headers)
        );
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      let result = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = new TextDecoder("utf-8").decode(value);
          const lines = chunk.split("\n").filter(Boolean);

          for (const line of lines) {
            try {
              const data = JSON.parse(line);

              if (data.type === "chunk" && data.content) {
                result += data.content;
                setMessages((prev) => {
                  // Find if there's already a bot message after the last user message
                  let lastUserIndex = -1;
                  for (let i = prev.length - 1; i >= 0; i--) {
                    if (prev[i].sender === "user") {
                      lastUserIndex = i;
                      break;
                    }
                  }
                  // If there's a bot message after the last user message, update it
                  if (lastUserIndex >= 0 && lastUserIndex < prev.length - 1) {
                    return prev.map((message, index) => {
                      if (index === lastUserIndex + 1) {
                        return { text: result, sender: "bot" };
                      }
                      return message;
                    });
                  }
                  // Otherwise, add a new bot message
                  return [...prev, { text: result, sender: "bot" }];
                });
              } else if (data.type === "error") {
                console.error("Stream error:", data.message);
                setMessages((prev) => [
                  ...prev,
                  {
                    text: "Sorry, there was an error. Please try again.",
                    sender: "bot",
                  },
                ]);
              }
            } catch (e) {
              console.error("Error parsing JSON:", e);
            }
          }
        }
      }
    } catch (error) {
      console.error("Error:", error);
      setMessages((prev) => [
        ...prev,
        { text: "Sorry, there was an error. Please try again.", sender: "bot" },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-4xl h-[90vh] flex flex-col shadow-xl">
      <CardHeader className="border-b bg-white/50 backdrop-blur-sm">
        <CardTitle className="text-2xl font-bold text-center">
          Simple Chatbot
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-grow overflow-hidden p-6">
        <ScrollArea className="h-full pr-4" ref={scrollAreaRef}>
          <MessageList messages={messages} />
          <LoadingIndicator isLoading={isLoading} />
        </ScrollArea>
      </CardContent>
      <ChatInput
        input={input}
        setInput={setInput}
        handleSend={handleSend}
        isLoading={isLoading}
      />
    </Card>
  );
}

interface MessageListProps {
  messages: Message[];
}

function MessageList({ messages }: MessageListProps) {
  return (
    <>
      {messages.map((msg, index) => (
        <MessageBubble key={index} message={msg} />
      ))}
    </>
  );
}

interface MessageBubbleProps {
  message: Message;
}

function MessageBubble({ message }: MessageBubbleProps) {
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
            message.sender === "user" ? "bg-primary" : "bg-secondary"
          } shadow-sm`}
        >
          {message.sender === "user" ? (
            <User className="h-5 w-5 text-primary-foreground" />
          ) : (
            <Bot className="h-5 w-5 text-secondary-foreground" />
          )}
        </div>
        <div
          className={`p-3 rounded-lg ${
            message.sender === "user"
              ? "bg-primary text-primary-foreground"
              : "bg-secondary text-secondary-foreground"
          } shadow-sm`}
        >
          <p className="whitespace-pre-wrap">{message.text}</p>
        </div>
      </div>
    </div>
  );
}

function LoadingIndicator({ isLoading }: { isLoading: boolean }) {
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

interface ChatInputProps {
  input: string;
  setInput: (value: string) => void;
  handleSend: () => void;
  isLoading: boolean;
}

function ChatInput({ input, setInput, handleSend, isLoading }: ChatInputProps) {
  return (
    <CardFooter className="border-t p-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        className="flex w-full items-center space-x-2"
      >
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your message..."
          className="flex-grow shadow-sm"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
        />
        <Button
          type="submit"
          size="icon"
          disabled={isLoading || !input.trim()}
          className="shadow-sm"
        >
          <Send className="h-4 w-4" />
          <span className="sr-only">Send</span>
        </Button>
      </form>
    </CardFooter>
  );
}
