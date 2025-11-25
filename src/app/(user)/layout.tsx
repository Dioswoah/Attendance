export default function UserLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <div className="min-h-screen bg-slate-50 flex flex-col">
            <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
                <div className="font-bold text-xl text-blue-600">Redadair Attendance</div>
                <div className="text-sm text-muted-foreground">Employee Portal</div>
            </header>
            <main className="flex-1 flex items-center justify-center p-4">
                {children}
            </main>
        </div>
    )
}
