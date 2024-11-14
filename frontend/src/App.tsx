"use client";

import { ChatBot } from "@/components/simple-chatbot";

import "@aws-amplify/ui-react/styles.css";
import { Authenticator } from "@aws-amplify/ui-react";

export function App() {
  return (
    <Authenticator>
      <ChatBot />
    </Authenticator>
  );
}
