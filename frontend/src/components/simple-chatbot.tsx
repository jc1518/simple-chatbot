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
import { ControlButtons } from "./ui/control-buttons";
import {
  Send,
  Bot,
  User,
  Trash2,
  LogOut,
  Network,
  Link,
  Check,
  Copy,
  Wifi,
} from "lucide-react";
import { fetchAuthSession } from "aws-amplify/auth";
import { SignatureV4 } from "@aws-sdk/signature-v4";
import { HttpRequest } from "@aws-sdk/protocol-http";
import { Sha256 } from "@aws-crypto/sha256-browser";
import { signOut } from "aws-amplify/auth";
import { config, AmplifyConfig } from "../Config";
import { Amplify } from "aws-amplify";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";

Amplify.configure(AmplifyConfig);

interface Message {
  text: string;
  sender: "user" | "bot";
  isLoading?: boolean;
}

interface BedrockMessage {
  role: "user" | "assistant";
  content: Array<{ text: string }>;
}

interface Backends {
  lambdaUrl: string;
  apiUrl: string;
  websocketUrl: string;
}

export function ChatBot() {
  const [input, setInput] = useState<string>("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [selectedEndpoint, setSelectedEndpoint] =
    useState<keyof Backends>("lambdaUrl");

  const backends: Backends = {
    lambdaUrl: config.lambdaUrl,
    apiUrl: config.apiUrl,
    websocketUrl: config.websocketUrl,
  };

  // Load messages from localStorage when component mounts
  useEffect(() => {
    try {
      const savedMessages = localStorage.getItem("chatHistory");
      if (savedMessages) {
        const parsedMessages = JSON.parse(savedMessages);
        // Validate that parsed data is an array of Message objects
        if (
          Array.isArray(parsedMessages) &&
          parsedMessages.every(
            (msg) =>
              msg.text &&
              typeof msg.text === "string" &&
              (msg.sender === "user" || msg.sender === "bot")
          )
        ) {
          setMessages(parsedMessages);
        }
      }
    } catch (error) {
      console.error("Error loading chat history:", error);
    }
  }, []);

  // Save messages to localStorage whenever they change
  useEffect(() => {
    try {
      // Only save if messages is not empty
      if (messages.length > 0) {
        localStorage.setItem("chatHistory", JSON.stringify(messages));
      }

      // Auto-scroll to bottom
      if (scrollAreaRef.current) {
        scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
      }
    } catch (error) {
      console.error("Error saving chat history:", error);
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
      let response: Response | null = null;

      if (selectedEndpoint === "lambdaUrl") {
        const backend = backends["lambdaUrl"];
        const url = new URL(backend);

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

        response = await fetch(backend, {
          method: signedRequest.method,
          headers: signedRequest.headers,
          body: signedRequest.body,
        });
      }

      if (selectedEndpoint === "apiUrl") {
        const backend = backends["apiUrl"];

        const authToken = (
          await fetchAuthSession()
        ).tokens?.idToken?.toString();

        response = await fetch(`${backend}/chat`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: authToken!,
          },
          body: JSON.stringify({ messages: bedrockMessages }),
        });
      }

      if (selectedEndpoint === "websocketUrl") {
        const backend = backends["websocketUrl"];
        try {
          const authToken = (
            await fetchAuthSession()
          ).tokens?.idToken?.toString();

          if (!authToken) {
            throw new Error("Authentication token is required");
          }

          return new Promise((resolve, reject) => {
            const ws = new WebSocket(`${backend}?Auth=${authToken}`);

            ws.onopen = () => {
              console.log(
                "WebSocket connection established, readyState:",
                ws.readyState
              );
              resolve(void 0);

              try {
                const message = {
                  action: "sendmessage",
                  messages: bedrockMessages,
                };
                ws.send(JSON.stringify(message));
              } catch (sendError) {
                console.error("Error sending message:", sendError);
                reject(sendError);
                ws.close();
              }
            };

            ws.onmessage = (event) => {
              try {
                const response = JSON.parse(event.data);
                if (
                  response.type === "message" &&
                  response.content?.type === "chunk"
                ) {
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
                          return {
                            text: message.text + response.content.content,
                            sender: "bot",
                          };
                        }
                        return message;
                      });
                    }

                    // Otherwise, add a new bot message
                    return [
                      ...prev,
                      {
                        text: response.content.content,
                        sender: "bot",
                      },
                    ];
                  });
                } else if (response.type === "error") {
                  console.error(
                    "Error from WebSocket:",
                    response.content.message
                  );
                  setMessages((prev) => [
                    ...prev,
                    {
                      text: response.content.message || "An error occurred",
                      sender: "bot",
                    },
                  ]);
                }
              } catch (error) {
                console.error("Error parsing WebSocket message:", error);
              }
            };

            ws.onclose = (event) => {
              console.log("WebSocket connection closed", {
                code: event.code,
                reason: event.reason,
                wasClean: event.wasClean,
              });
              if (!event.wasClean) {
                setMessages((prev) => [
                  ...prev,
                  {
                    text: "Connection lost. Please refresh the page.",
                    sender: "bot",
                  },
                ]);
              }
            };

            ws.onerror = (error) => {
              console.error("WebSocket error:", {
                error,
                readyState: ws.readyState,
              });
              setMessages((prev) => [
                ...prev,
                {
                  text: "Connection error. Please try again.",
                  sender: "bot",
                },
              ]);
              reject(error);
              ws.close();
            };

            setTimeout(() => {
              if (ws.readyState === WebSocket.CONNECTING) {
                console.error(
                  "WebSocket connection timeout - still in CONNECTING state"
                );
                reject(new Error("WebSocket connection timeout"));
                ws.close();
              }
            }, 10000);
          });
        } catch (error) {
          console.error("Error in WebSocket setup:", error);
          setMessages((prev) => [
            ...prev,
            {
              text: "Sorry, there was an error. Please try again.",
              sender: "bot",
            },
          ]);
        } finally {
          setIsLoading(false);
        }
      }

      if (!response!.ok) {
        console.error("Response status:", response!.status);
        console.error(
          "Response headers:",
          Object.fromEntries(response!.headers)
        );
        throw new Error(`HTTP error! status: ${response!.status}`);
      }

      if (selectedEndpoint === "lambdaUrl") {
        const reader = response!.body?.getReader();
        console.log(response);
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
      }

      if (selectedEndpoint === "apiUrl") {
        const data = await response!.json();
        const result = data.output?.message?.content[0].text;
        setMessages((prev) => [...prev, { text: result, sender: "bot" }]);
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

  const clearHistory = () => {
    setMessages([]);
    localStorage.removeItem("chatHistory");
  };

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.log("Error signing out:", error);
    }
  };

  return (
    <Card className="w-[90vw] max-w-6xl h-[90vh] flex flex-col shadow-xl">
      <CardHeader className="border-b bg-white/50 backdrop-blur-sm">
        <div className="flex items-center justify-center space-x-3">
          <div className="p-2 rounded-full bg-blue-100 hover:bg-blue-200 transition-all duration-300">
            <Bot className="h-6 w-6 text-blue-600" />
          </div>
          <CardTitle className="text-2xl font-bold text-gray-800">
            Simple Chatbot
          </CardTitle>
        </div>
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
      <ControlButtons
        selectedEndpoint={selectedEndpoint}
        setSelectedEndpoint={(value) =>
          setSelectedEndpoint(value as keyof Backends)
        }
        clearHistory={clearHistory}
        handleSignOut={handleSignOut}
      />
    </Card>
  );
}

interface MessageListProps {
  messages: Message[];
}

function MessageList({ messages }: MessageListProps) {
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

interface MessageBubbleProps {
  message: Message;
}

function MessageBubble({ message }: MessageBubbleProps) {
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
        return (
          <p key={index} className="whitespace-pre-wrap">
            {segment.content}
          </p>
        );
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

function CodeBlock({ code, language }: { code: string; language: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group">
      <div className="absolute right-2 top-2 z-10 flex items-center space-x-2">
        <span className="text-xs text-gray-400 bg-gray-800 px-2 py-1 rounded">
          {language}
        </span>
        <button
          onClick={handleCopy}
          className="bg-gray-800 hover:bg-gray-700 text-gray-300 rounded p-1 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          {copied ? (
            <Check className="h-4 w-4" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </button>
      </div>
      <SyntaxHighlighter
        language={language}
        style={vscDarkPlus}
        customStyle={{
          margin: 0,
          borderRadius: "0.375rem",
          fontSize: "0.9rem",
          padding: "1.5rem 1rem",
        }}
        showLineNumbers
      >
        {code}
      </SyntaxHighlighter>
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
