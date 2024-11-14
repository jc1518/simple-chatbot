"use client";

import { ChatBot } from "@/components/simple-chatbot";
import { Button } from "@/components/ui/button";
import { Amplify } from "aws-amplify";
import "@aws-amplify/ui-react/styles.css";
import { signOut } from "aws-amplify/auth";
import { Authenticator } from "@aws-amplify/ui-react";
import { config, AmplifyConfig } from "./Config";

Amplify.configure(AmplifyConfig);

export function App() {
  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.log("Error signing out:", error);
    }
  };

  return (
    <Authenticator>
      <Button onClick={handleSignOut}>Sign Out</Button>
      <ChatBot apiUrl={config.apiUrl} />
    </Authenticator>
  );
}
