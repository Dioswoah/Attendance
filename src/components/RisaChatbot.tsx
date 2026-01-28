"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Bot, Send, X, MessageSquare, Loader2, User } from "lucide-react"
import { cn } from "@/lib/utils"

export function RisaChatbot() {
    const [isOpen, setIsOpen] = useState(false)
    const [messages, setMessages] = useState<{ role: 'user' | 'model', content: string }[]>([
        { role: 'model', content: "Hi! I'm RISA, your personal assistant. How can I help you with your attendance or leave data today?" }
    ])
    const [input, setInput] = useState("")
    const [isLoading, setIsLoading] = useState(false)
    const scrollRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight
        }
    }, [messages, isOpen])

    const handleSend = async () => {
        if (!input.trim()) return

        const userMessage = input.trim()
        setInput("")
        setMessages(prev => [...prev, { role: 'user', content: userMessage }])
        setIsLoading(true)

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: userMessage, history: messages }),
            })

            if (!response.ok) {
                throw new Error('Failed to fetch response')
            }

            const data = await response.json()
            setMessages(prev => [...prev, { role: 'model', content: data.response }])
        } catch (error) {
            console.error(error)
            setMessages(prev => [...prev, { role: 'model', content: "I'm sorry, I'm having trouble connecting right now. Please try again later." }])
        } finally {
            setIsLoading(false)
        }
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSend()
        }
    }

    return (
        <>
            {/* Floating Toggle Button */}
            {!isOpen && (
                <Button
                    onClick={() => setIsOpen(true)}
                    className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg bg-sidebar hover:bg-sidebar-accent text-sidebar-foreground z-50 animate-in zoom-in duration-300"
                >
                    <Bot className="h-8 w-8" />
                </Button>
            )}

            {/* Chat Window */}
            {isOpen && (
                <Card className="fixed bottom-6 right-6 w-[350px] sm:w-[400px] h-[500px] shadow-2xl flex flex-col z-50 animate-in slide-in-from-bottom-10 duration-300 border-red-100">
                    <CardHeader className="bg-sidebar text-sidebar-foreground p-4 rounded-t-xl flex flex-row items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
                                <Bot className="h-6 w-6 text-sidebar-foreground" />
                            </div>
                            <div>
                                <CardTitle className="text-lg font-bold">RISA</CardTitle>
                                <p className="text-xs text-sidebar-foreground/80">Redadair Intelligent Staff Assistant</p>
                            </div>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)} className="text-sidebar-foreground hover:bg-white/20 rounded-full h-8 w-8">
                            <X className="h-5 w-5" />
                        </Button>
                    </CardHeader>

                    <CardContent className="flex-1 p-0 overflow-hidden bg-slate-50 relative">
                        <div ref={scrollRef} className="h-full overflow-y-auto p-4 space-y-4">
                            {messages.map((msg, index) => (
                                <div
                                    key={index}
                                    className={cn(
                                        "flex w-full",
                                        msg.role === 'user' ? "justify-end" : "justify-start"
                                    )}
                                >
                                    <div
                                        className={cn(
                                            "max-w-[80%] rounded-2xl px-4 py-2 text-sm shadow-sm",
                                            msg.role === 'user'
                                                ? "bg-sidebar text-sidebar-foreground rounded-br-none"
                                                : "bg-white text-slate-800 border border-slate-200 rounded-bl-none"
                                        )}
                                    >
                                        {msg.content}
                                    </div>
                                </div>
                            ))}
                            {isLoading && (
                                <div className="flex justify-start">
                                    <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-none px-4 py-2 shadow-sm flex items-center gap-2">
                                        <Loader2 className="h-4 w-4 animate-spin text-sidebar" />
                                        <span className="text-xs text-slate-500">Thinking...</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </CardContent>

                    <CardFooter className="p-3 bg-white border-t border-slate-100">
                        <div className="flex w-full gap-2">
                            <Input
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="Ask about your attendance..."
                                className="flex-1 border-slate-200 focus-visible:ring-sidebar"
                            />
                            <Button
                                onClick={handleSend}
                                disabled={isLoading || !input.trim()}
                                size="icon"
                                className="bg-sidebar hover:bg-sidebar-accent text-sidebar-foreground"
                            >
                                <Send className="h-4 w-4" />
                            </Button>
                        </div>
                    </CardFooter>
                </Card>
            )}
        </>
    )
}
