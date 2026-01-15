import { Flame } from "lucide-react"

export default function UserLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <div className="min-h-screen bg-slate-50 flex flex-col font-sans selection:bg-red-100 selection:text-red-900">
            {/* Soft background glow */}
            <div className="fixed top-0 left-0 h-[500px] w-[500px] bg-red-100/30 rounded-full blur-[120px] -translate-x-1/2 -translate-y-1/2 pointer-events-none" />

            <header className="bg-white/60 backdrop-blur-xl border-b border-white/40 px-10 py-6 flex items-center justify-between sticky top-0 z-50 shadow-sm shadow-slate-200/20">
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 bg-red-600 rounded-xl flex items-center justify-center shadow-lg shadow-red-100">
                        <Flame className="h-5 w-5 text-white fill-white" />
                    </div>
                    <div className="flex flex-col">
                        <span className="text-sm font-black italic uppercase tracking-tighter text-slate-900 leading-none">Redadair</span>
                        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-red-600 mt-0.5">Staff Portal</span>
                    </div>
                </div>
            </header>

            <main className="flex-1 flex flex-col items-center relative z-10">
                {children}
            </main>

            <footer className="py-10 text-center relative z-10">
                <p className="text-[9px] font-black text-slate-300 uppercase tracking-[0.5em] italic">© 2024 Redadair • Performance Excellence • Safety First</p>
            </footer>
        </div>
    )
}
