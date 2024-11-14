"use client";

import { ChatBot } from "@/components/simple-chatbot";

import "@aws-amplify/ui-react/styles.css";
import { Authenticator } from "@aws-amplify/ui-react";
import { config } from "./Config";

export function App() {
  return (
    <Authenticator>
      <ChatBot apiUrl={config.apiUrl} />
    </Authenticator>
  );
}
