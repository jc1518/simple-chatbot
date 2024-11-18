import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ControlButtons } from "./control-buttons";
import { MessageList } from "./message-list";
import { LoadingIndicator } from "./loading-indicator";
import { ChatInput } from "./chat-input";
import { Bot } from "lucide-react";
import { fetchAuthSession } from "aws-amplify/auth";
import { SignatureV4 } from "@aws-sdk/signature-v4";
import { HttpRequest } from "@aws-sdk/protocol-http";
import { Sha256 } from "@aws-crypto/sha256-browser";
import { signOut } from "aws-amplify/auth";
import { config, AmplifyConfig } from "../Config";
import { Amplify } from "aws-amplify";

Amplify.configure(AmplifyConfig);

export interface Message {
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
    <Card className="w-[95vw] md:w-[90vw] max-w-6xl h-[98vh] md:h-[90vh] flex flex-col shadow-xl rounded-2xl bg-gradient-to-b from-indigo-50 to-purple-50 dark:from-gray-900 dark:to-black">
      <CardHeader className="border-b bg-white/30 dark:bg-black/30 backdrop-blur-sm">
        <div className="flex items-center justify-center space-x-3">
          <div className="p-2 rounded-full bg-gradient-to-br from-indigo-100 to-purple-200 hover:from-indigo-200 hover:to-purple-300 transition-all duration-300">
            <Bot className="h-6 w-6 text-indigo-600" />
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
