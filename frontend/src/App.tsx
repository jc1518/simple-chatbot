"use client";

import { ChatBot } from "@/components/simple-chatbot";

import "@aws-amplify/ui-react/styles.css";
import "@/components/message-list-updates.css";
import { Authenticator } from "@aws-amplify/ui-react";

export function App() {
  return (
    <Authenticator>
      <ChatBot />
    </Authenticator>
  );
}
