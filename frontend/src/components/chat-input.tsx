import { CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send } from "lucide-react";
import { motion } from "framer-motion";

interface ChatInputProps {
  input: string;
  setInput: (value: string) => void;
  handleSend: () => void;
  isLoading: boolean;
}

export function ChatInput({
  input,
  setInput,
  handleSend,
  isLoading,
}: ChatInputProps) {
  return (
    <CardFooter>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        className="flex w-full items-center space-x-2 px-2 sm:px-3 md:px-4"
      >
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your message..."
          className="flex-grow shadow-sm text-base rounded-xl border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 transition-all duration-200 h-11 text-gray-800 dark:text-gray-100 bg-white dark:bg-gray-800"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
        />
        <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
          <Button
            type="submit"
            size="lg"
            disabled={isLoading || !input.trim()}
            className="shadow-sm bg-blue-500 hover:bg-blue-600 text-white rounded-xl w-11 h-11 p-0 flex items-center justify-center"
          >
            <Send className="h-5 w-5" />
            <span className="sr-only">Send</span>
          </Button>
        </motion.div>
      </form>
    </CardFooter>
  );
}
