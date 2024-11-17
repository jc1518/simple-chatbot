import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Link, Network, Wifi, Trash2, LogOut } from "lucide-react";

interface ControlButtonsProps {
  selectedEndpoint: string;
  setSelectedEndpoint: (value: string) => void;
  clearHistory: () => void;
  handleSignOut: () => void;
}

export function ControlButtons({
  selectedEndpoint,
  setSelectedEndpoint,
  clearHistory,
  handleSignOut,
}: ControlButtonsProps) {
  return (
    <div className="border-t bg-gray-50/50 backdrop-blur-sm px-3 sm:px-6 py-3 sm:py-4">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between max-w-2xl mx-auto gap-3">
        <Select value={selectedEndpoint} onValueChange={setSelectedEndpoint}>
          <SelectTrigger className="w-full sm:w-[180px] bg-white hover:bg-gray-50 transition-colors duration-200 border-gray-200 shadow-sm h-auto py-2">
            <SelectValue>
              <div className="flex items-center space-x-2">
                {selectedEndpoint === "lambdaUrl" ? (
                  <>
                    <Link className="h-4 w-4 text-blue-500 flex-shrink-0" />
                    <span className="truncate">Lambda URL</span>
                  </>
                ) : selectedEndpoint === "apiUrl" ? (
                  <>
                    <Network className="h-4 w-4 text-green-500 flex-shrink-0" />
                    <span className="truncate">Rest API</span>
                  </>
                ) : (
                  <>
                    <Wifi className="h-4 w-4 text-purple-500 flex-shrink-0" />
                    <span className="truncate">Websocket API</span>
                  </>
                )}
              </div>
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="lambdaUrl" className="flex items-center">
              <div className="flex items-center space-x-2">
                <Link className="h-4 w-4 text-blue-500 flex-shrink-0" />
                <span>Lambda URL</span>
              </div>
            </SelectItem>
            <SelectItem value="apiUrl" className="flex items-center">
              <div className="flex items-center space-x-2">
                <Network className="h-4 w-4 text-green-500 flex-shrink-0" />
                <span>Rest API</span>
              </div>
            </SelectItem>
            <SelectItem value="websocketUrl" className="flex items-center">
              <div className="flex items-center space-x-2">
                <Wifi className="h-4 w-4 text-purple-500 flex-shrink-0" />
                <span>Websocket API</span>
              </div>
            </SelectItem>
          </SelectContent>
        </Select>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <Button
            variant="outline"
            onClick={clearHistory}
            className="flex-1 sm:flex-initial h-auto py-2 px-4 bg-white hover:bg-red-50 text-red-600 border-red-200 hover:border-red-300 transition-colors duration-200"
          >
            <Trash2 className="h-4 w-4 mr-2 flex-shrink-0" />
            <span className="whitespace-nowrap">Clear History</span>
          </Button>

          <Button
            variant="outline"
            onClick={handleSignOut}
            className="flex-1 sm:flex-initial h-auto py-2 px-4 bg-white hover:bg-gray-50 border-gray-200 hover:border-gray-300 transition-colors duration-200"
          >
            <LogOut className="h-4 w-4 mr-2 flex-shrink-0" />
            <span className="whitespace-nowrap">Sign Out</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
