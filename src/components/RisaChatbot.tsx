"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Bot, Send, X, MessageSquare, Loader2, User, Maximize2, Minimize2, RotateCcw } from "lucide-react"
import { cn } from "@/lib/utils"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

export function RisaChatbot() {
    const [isOpen, setIsOpen] = useState(false)
    const [isExpanded, setIsExpanded] = useState(false)
    const [messages, setMessages] = useState<{ role: 'user' | 'model', content: string }[]>([])
    const [input, setInput] = useState("")
    const [isLoading, setIsLoading] = useState(false)
    const scrollRef = useRef<HTMLDivElement>(null)

    // Load history on mount
    useEffect(() => {
        const fetchHistory = async () => {
            try {
                const res = await fetch('/api/chat')
                if (res.ok) {
                    const data = await res.json()
                    if (data.messages && data.messages.length > 0) {
                        setMessages(data.messages)
                    } else {
                        // Initial greeting if no history
                        setMessages([{
                            role: 'model',
                            content: "Hi! I'm RISA, your personal assistant. How can I help you with your attendance or leave data today?"
                        }])
                    }
                }
            } catch (error) {
                console.error("Failed to fetch chat history", error)
            }
        }
        fetchHistory()
    }, [])

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight
        }
    }, [messages, isOpen])

    const handleSend = async () => {
        if (!input.trim()) return

        const userMessage = input.trim()
        setInput("")
        const newMessages = [...messages, { role: 'user' as const, content: userMessage }]
        setMessages(newMessages)
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
            setMessages(prev => [...prev, { role: 'model', content: "I'm sorry, I'm having trouble connecting to my engine right now. Please try again later." }])
        } finally {
            setIsLoading(false)
        }
    }

    const handleReset = async () => {
        setIsLoading(true)
        try {
            await fetch('/api/chat', { method: 'DELETE' })
            setMessages([{
                role: 'model',
                content: "Hi! I'm RISA, your personal assistant. How can I help you with your attendance or leave data today?"
            }])
        } catch (error) {
            console.error("Failed to reset chat", error)
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
                <Card className={cn(
                    "fixed shadow-2xl flex flex-col z-50 animate-in slide-in-from-bottom-10 duration-300 border-red-100 overflow-hidden rounded-2xl p-0 bg-white",
                    isExpanded
                        ? "inset-4 w-auto h-auto m-auto max-w-5xl"
                        : "bottom-6 right-6 w-[350px] sm:w-[400px] h-[500px]"
                )}>
                    <CardHeader className="bg-sidebar text-sidebar-foreground p-4 flex flex-row items-center justify-between space-y-0 rounded-none border-b border-white/10">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
                                <Bot className="h-6 w-6 text-sidebar-foreground" />
                            </div>
                            <div className="flex flex-col">
                                <CardTitle className="text-lg font-bold leading-none">RISA</CardTitle>
                                <span className="text-[10px] text-sidebar-foreground/70 mt-1 uppercase tracking-wider font-semibold">Intelligence Engine Active</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-1">
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={handleReset}
                                title="Reset Session"
                                className="text-sidebar-foreground hover:bg-white/20 rounded-full h-8 w-8"
                            >
                                <RotateCcw className="h-4 w-4" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setIsExpanded(!isExpanded)}
                                className="text-sidebar-foreground hover:bg-white/20 rounded-full h-8 w-8"
                            >
                                {isExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)} className="text-sidebar-foreground hover:bg-white/20 rounded-full h-8 w-8">
                                <X className="h-5 w-5" />
                            </Button>
                        </div>
                    </CardHeader >

                    <CardContent className="flex-1 p-0 overflow-hidden bg-[#FDFCFB] relative">
                        <div ref={scrollRef} className="h-full overflow-y-auto p-4 space-y-4 scroll-smooth">
                            {messages.map((msg, index) => (
                                <div
                                    key={index}
                                    className={cn(
                                        "flex w-full animate-in fade-in slide-in-from-bottom-2 duration-300",
                                        msg.role === 'user' ? "justify-end" : "justify-start"
                                    )}
                                >
                                    <div
                                        className={cn(
                                            "max-w-[85%] rounded-[1.25rem] px-4 py-2.5 text-sm shadow-sm",
                                            msg.role === 'user'
                                                ? "bg-sidebar text-sidebar-foreground rounded-br-none"
                                                : "bg-white text-slate-800 border border-slate-100 rounded-bl-none"
                                        )}
                                    >
                                        {msg.role === 'user' ? msg.content : (
                                            <ReactMarkdown
                                                remarkPlugins={[remarkGfm]}
                                                components={{
                                                    p: ({ children }) => <p className="mb-1.5 last:mb-0 leading-relaxed">{children}</p>,
                                                    ul: ({ children }) => <ul className="list-disc pl-4 mb-1.5 space-y-0.5">{children}</ul>,
                                                    ol: ({ children }) => <ol className="list-decimal pl-4 mb-1.5 space-y-0.5">{children}</ol>,
                                                    li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                                                    strong: ({ children }) => <strong className="font-semibold text-slate-900">{children}</strong>,
                                                    em: ({ children }) => <em className="italic">{children}</em>,
                                                    h1: ({ children }) => <p className="font-bold text-base mb-1">{children}</p>,
                                                    h2: ({ children }) => <p className="font-bold text-sm mb-1">{children}</p>,
                                                    h3: ({ children }) => <p className="font-semibold text-sm mb-0.5">{children}</p>,
                                                    code: ({ children }) => <code className="bg-slate-100 text-slate-700 rounded px-1 py-0.5 text-[11px] font-mono">{children}</code>,
                                                    blockquote: ({ children }) => <blockquote className="border-l-2 border-slate-300 pl-3 text-slate-600 italic my-1">{children}</blockquote>,
                                                }}
                                            >
                                                {msg.content}
                                            </ReactMarkdown>
                                        )}
                                    </div>
                                </div>
                            ))}
                            {isLoading && (
                                <div className="flex justify-start animate-in fade-in duration-300">
                                    <div className="bg-white border border-slate-100 rounded-[1.25rem] rounded-bl-none px-4 py-2.5 shadow-sm flex items-center gap-2">
                                        <div className="flex gap-1">
                                            <span className="w-1.5 h-1.5 bg-sidebar/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                            <span className="w-1.5 h-1.5 bg-sidebar/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                            <span className="w-1.5 h-1.5 bg-sidebar/80 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </CardContent>

                    <CardFooter className="p-4 bg-white border-t border-slate-50">
                        <div className="flex w-full gap-2 bg-slate-50 p-1.5 rounded-xl border border-slate-100 focus-within:ring-1 focus-within:ring-sidebar/20 transition-all">
                            <Input
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="Message RISA..."
                                className="flex-1 border-none bg-transparent shadow-none focus-visible:ring-0 text-sm placeholder:text-slate-400"
                            />
                            <Button
                                onClick={handleSend}
                                disabled={isLoading || !input.trim()}
                                size="icon"
                                className="bg-sidebar hover:bg-sidebar-accent text-sidebar-foreground h-8 w-8 rounded-lg"
                            >
                                <Send className="h-4 w-4" />
                            </Button>
                        </div>
                    </CardFooter>
                </Card >
            )
            }
        </>
    )
}
