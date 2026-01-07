import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Bot, ChevronDown, Send, Loader2, Sparkles, X, Maximize2, Minimize2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Message {
  role: 'user' | 'assistant';
  content: string;
  citations?: string[];
}

export const AdminAIAssistant = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('admin-ai-assistant', {
        body: { 
          message: userMessage,
          includeContext: true
        }
      });

      if (error) throw error;

      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: data.response,
        citations: data.citations
      }]);
    } catch (error) {
      console.error('AI Assistant error:', error);
      toast.error('Failed to get AI response. Please try again.');
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: 'Sorry, I encountered an error. Please try again.'
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearChat = () => {
    setMessages([]);
  };

  const chatWidth = isExpanded ? 'w-[90vw] md:w-[700px] lg:w-[800px]' : 'w-[380px] md:w-[420px]';
  const chatHeight = isExpanded ? 'h-[70vh]' : 'h-[350px]';

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <Button 
            className="rounded-full h-14 w-14 shadow-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
            size="icon"
          >
            {isOpen ? (
              <ChevronDown className="h-6 w-6" />
            ) : (
              <Bot className="h-6 w-6" />
            )}
          </Button>
        </CollapsibleTrigger>

        <CollapsibleContent className="absolute bottom-16 right-0">
          <Card className={`${chatWidth} shadow-2xl border-0 overflow-hidden transition-all duration-300`}>
            {/* Header */}
            <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-4 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5" />
                  <h3 className="font-semibold">AI Assistant</h3>
                </div>
                <div className="flex items-center gap-1">
                  {messages.length > 0 && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={clearChat}
                      className="text-white/80 hover:text-white hover:bg-white/10 h-8 px-2"
                    >
                      Clear
                    </Button>
                  )}
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="text-white/80 hover:text-white hover:bg-white/10 h-8 w-8"
                    title={isExpanded ? "Minimize" : "Expand"}
                  >
                    {isExpanded ? (
                      <Minimize2 className="h-4 w-4" />
                    ) : (
                      <Maximize2 className="h-4 w-4" />
                    )}
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => setIsOpen(false)}
                    className="text-white/80 hover:text-white hover:bg-white/10 h-8 w-8"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <p className="text-sm text-white/80 mt-1">
                Ask me about your portal data
              </p>
            </div>

            {/* Messages */}
            <ScrollArea className={`${chatHeight} p-4 transition-all duration-300`} ref={scrollRef}>
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
                  <Bot className="h-12 w-12 mb-4 opacity-50" />
                  <p className="text-sm">
                    I can help you analyze employee data, identify trends, and answer questions about your portal.
                  </p>
                  <div className="mt-4 space-y-2 text-xs">
                    <p className="font-medium">Try asking:</p>
                    <p className="bg-muted px-3 py-1.5 rounded-full">"How many pending reimbursements?"</p>
                    <p className="bg-muted px-3 py-1.5 rounded-full">"Show me incident trends"</p>
                    <p className="bg-muted px-3 py-1.5 rounded-full">"Summarize mover feedback"</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {messages.map((msg, idx) => (
                    <div 
                      key={idx} 
                      className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div 
                        className={`rounded-2xl px-4 py-2.5 ${
                          isExpanded ? 'max-w-[90%]' : 'max-w-[85%]'
                        } ${
                          msg.role === 'user' 
                            ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white' 
                            : 'bg-muted'
                        }`}
                      >
                        <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                        {msg.citations && msg.citations.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-border/50 text-xs opacity-70">
                            <p className="font-medium mb-1">Sources:</p>
                            {msg.citations.map((cite, cIdx) => (
                              <a 
                                key={cIdx} 
                                href={cite} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="block truncate hover:underline"
                              >
                                {cite}
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  {isLoading && (
                    <div className="flex justify-start">
                      <div className="bg-muted rounded-2xl px-4 py-2.5">
                        <Loader2 className="h-5 w-5 animate-spin" />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </ScrollArea>

            {/* Input */}
            <div className="p-4 border-t bg-background">
              <div className="flex gap-2">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyPress}
                  placeholder="Ask about your data..."
                  disabled={isLoading}
                  className="flex-1"
                />
                <Button 
                  onClick={sendMessage} 
                  disabled={!input.trim() || isLoading}
                  size="icon"
                  className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </Card>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
};