"use client"

import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import { driver } from "driver.js"
import "driver.js/dist/driver.css"
import { Button } from "@/components/ui/button"
import { HelpCircle, PlayCircle, XCircle } from "lucide-react"
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog"

export function UserOnboardingTour() {
    const [mounted, setMounted] = useState(false)
    const [showWelcomeDialog, setShowWelcomeDialog] = useState(false)
    const pathname = usePathname()

    useEffect(() => {
        setMounted(true)
    }, [])

    // Define steps for each route
    const tourConfig: Record<string, { title: string, description: string, steps: any[] }> = {
        '/user': {
            title: "Dashboard Overview",
            description: "Your personal attendance command center",
            steps: [
                {
                    element: '#tour-header',
                    popover: {
                        title: 'Dashboard Overview',
                        description: 'Your personal command center. View your daily greeting, today\'s date, and your current work status at a glance.',
                        side: "bottom", align: 'start'
                    }
                },
                {
                    element: '#tour-status-badge',
                    popover: {
                        title: 'Live Status Indicator',
                        description: 'Always know your state. This badge updates in real-time to show if you are Clocked In, On Break, or Offline.',
                        side: "bottom", align: 'start'
                    }
                },
                {
                    element: '#tour-time-tracker',
                    popover: {
                        title: 'Smart Time Tracker',
                        description: 'The core of your attendance. Use the large buttons here to Clock In, Switch to Break, or Clock Out for the day.',
                        side: "right", align: 'start'
                    }
                },
                {
                    element: '#tour-action-buttons',
                    popover: {
                        title: 'Action Controls',
                        description: 'Interactive buttons appear here based on your status.',
                        side: "top", align: 'center'
                    }
                },
                {
                    element: '#tour-stats-worked',
                    popover: {
                        title: 'Performance Metrics',
                        description: 'This card sums up your total productive hours for the current session.',
                        side: "top"
                    }
                },
                {
                    element: '#tour-stats-break',
                    popover: {
                        title: 'Break Monitor',
                        description: 'Keeps track of your break usage to help you stay within the 1-hour daily limit.',
                        side: "top"
                    }
                },
                {
                    element: '#tour-stats-pending',
                    popover: {
                        title: 'Request Tracker',
                        description: 'Status updates on your Leave or Attendance Amendment requests appear here instantly.',
                        side: "top"
                    }
                },
                {
                    element: '#tour-staff-status',
                    popover: {
                        title: 'Team Pulse',
                        description: 'See which of your colleagues are online, on break, or out of office in real-time.',
                        side: "left", align: 'start'
                    }
                },
                {
                    element: '#tour-activity-feed',
                    popover: {
                        title: 'Daily Timeline',
                        description: 'A chronological log of all your actions today.',
                        side: "left", align: 'start'
                    }
                }
            ]
        },
        '/user/leaves': {
            title: "Leave Management",
            description: "Submit and track your time off",
            steps: [
                {
                    element: '#tour-leaves-header',
                    popover: {
                        title: 'Leave Requests',
                        description: 'Manage all your leave applications from this dedicated dashboard.',
                        side: "bottom", align: 'start'
                    }
                },
                {
                    element: '#tour-leaves-request-btn',
                    popover: {
                        title: 'New Request',
                        description: 'Click here to open the form and submit a new leave application.',
                        side: "bottom", align: 'start'
                    }
                },
                {
                    element: '#tour-leaves-filter',
                    popover: {
                        title: 'Filters',
                        description: 'Use these controls to view Past (Archived), Pending, Approved, or Declined requests.',
                        side: "bottom", align: 'start'
                    }
                },
                {
                    element: '#tour-leaves-grid',
                    popover: {
                        title: 'Request History',
                        description: 'Your requests appear here as cards. You can edit pending requests or view details of past ones.',
                        side: "top", align: 'center'
                    }
                }
            ]
        },
        '/user/amend-records': {
            title: "Amend Records",
            description: "Correct your attendance logs",
            steps: [
                {
                    element: '#tour-amend-header',
                    popover: {
                        title: 'Amend Records',
                        description: 'Need to fix a mistake? Use this page to request corrections for missed clock-ins or wrong times.',
                        side: "bottom", align: 'start'
                    }
                },
                {
                    element: '#tour-amend-new-btn',
                    popover: {
                        title: 'Submit Correction',
                        description: 'Start a new correction request for clock-in/out or break times.',
                        side: "bottom", align: 'start'
                    }
                },
                {
                    element: '#tour-amend-log',
                    popover: {
                        title: 'Request Log',
                        description: 'Keep track of all your amendment requests and their approval status.',
                        side: "top", align: 'start'
                    }
                },
                {
                    element: '#tour-amend-grid',
                    popover: {
                        title: 'History',
                        description: 'Your recent correction requests are listed here.',
                        side: "top", align: 'center'
                    }
                }
            ]
        },
        '/user/activity': {
            title: "Activity Logs",
            description: "Your comprehensive history",
            steps: [
                {
                    element: '#tour-activity-header',
                    popover: {
                        title: 'Activity Logs',
                        description: 'A complete audit trail of your attendance and activity timestamps.',
                        side: "bottom", align: 'start'
                    }
                },
                {
                    element: '#tour-activity-filters',
                    popover: {
                        title: 'Search & Filter',
                        description: 'Find exactly what you need by searching text, filtering by type (Attendance/Leave), or selecting a date range.',
                        side: "bottom", align: 'start'
                    }
                },
                {
                    element: '#tour-activity-list',
                    popover: {
                        title: 'Timeline',
                        description: 'A detailed chronological list of all your recorded activities.',
                        side: "top", align: 'center'
                    }
                }
            ]
        },
        '/user/manager': {
            title: "Manager Control",
            description: "Oversee your team's performance",
            steps: [
                {
                    element: '#tour-manager-header',
                    popover: {
                        title: 'Manager Dashboard',
                        description: 'Your central hub for managing team requests and availability.',
                        side: "bottom", align: 'start'
                    }
                },
                {
                    element: '#tour-manager-tab-requests',
                    popover: {
                        title: 'Pending Approvals',
                        description: 'Review and action pending leave and attendance amendment requests here.',
                        side: "bottom", align: 'center'
                    }
                },
                {
                    element: '#tour-manager-tab-history',
                    popover: {
                        title: 'History',
                        description: 'View a log of your past approvals and denials.',
                        side: "bottom", align: 'center'
                    }
                },
                {
                    element: '#tour-manager-tab-calendar',
                    popover: {
                        title: 'Team Calendar',
                        description: 'Check who is working, on leave, or off-duty for the entire month.',
                        side: "bottom", align: 'center'
                    }
                },
                {
                    element: '#tour-manager-pending',
                    popover: {
                        title: 'Action Queue',
                        description: 'Items requiring your immediate attention will be listed here.',
                        side: "top", align: 'center'
                    }
                }
            ]
        }
    }

    const currentTour = tourConfig[pathname || '']
    const storageKey = `has_seen_tour_${pathname}`

    useEffect(() => {
        if (!mounted || !currentTour) return

        const hasSeenTour = localStorage.getItem(storageKey)
        if (!hasSeenTour) {
            // Delay to ensure hydration and layout stability
            const timer = setTimeout(() => {
                setShowWelcomeDialog(true)
            }, 1500)
            return () => clearTimeout(timer)
        }
    }, [mounted, pathname, storageKey])

    const initiateDriver = () => {
        const driverObj = driver({
            showProgress: true,
            animate: true,
            allowClose: true,
            doneBtnText: "Finish",
            nextBtnText: "Next",
            prevBtnText: "Back",
            progressText: "{{current}} of {{total}}",
            steps: currentTour.steps,
            onDestroyStarted: () => {
                if (!localStorage.getItem(storageKey)) {
                    localStorage.setItem(storageKey, 'true')
                }
                driverObj.destroy()
            }
        })

        driverObj.drive()
    }

    const startTour = () => {
        if (!currentTour) return

        if (showWelcomeDialog) {
            setShowWelcomeDialog(false)
            // If dialog was open, wait for it to close before starting
            setTimeout(() => {
                initiateDriver()
            }, 800)
        } else {
            initiateDriver()
        }
    }

    const handleStartTour = () => {
        localStorage.setItem(storageKey, 'true')
        startTour()
    }

    const handleSkipTour = () => {
        setShowWelcomeDialog(false)
        localStorage.setItem(storageKey, 'true')
    }



    if (!mounted || !currentTour) return null

    return (
        <>
            {/* Header Trigger Button */}
            <Button
                variant="ghost"
                size="icon"
                onClick={startTour}
                className="h-9 w-9 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-full transition-all"
                title="Page Guide"
            >
                <HelpCircle className="h-5 w-5" />
            </Button>

            {/* Welcome Dialog */}
            <Dialog open={showWelcomeDialog} onOpenChange={setShowWelcomeDialog}>
                <DialogContent className="max-w-sm rounded-[2rem] p-0 overflow-hidden border-none shadow-2xl">
                    <div className="bg-sidebar p-8 text-center relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-white/10 to-transparent" />
                        <div className="h-16 w-16 bg-white/10 rounded-2xl flex items-center justify-center mx-auto mb-4 backdrop-blur-sm shadow-inner border border-white/5">
                            <PlayCircle className="h-8 w-8 text-sidebar-foreground" />
                        </div>
                        <DialogTitle className="text-xl font-bold text-sidebar-foreground uppercase tracking-tight relative z-10">
                            {currentTour.title}
                        </DialogTitle>
                        <DialogDescription className="text-sidebar-foreground/70 font-medium text-[10px] uppercase tracking-widest mt-2 relative z-10">
                            {currentTour.description}
                        </DialogDescription>
                    </div>

                    <div className="p-6 bg-white space-y-6">
                        <div className="space-y-4">
                            <div className="flex items-start gap-4">
                                <div className="h-2 w-2 mt-2 rounded-full bg-sidebar shrink-0" />
                                <p className="text-sm text-slate-600 leading-relaxed">
                                    <span className="font-bold text-slate-900 block text-xs uppercase tracking-wide mb-1">Quick Guide</span>
                                    Get familiarity with the features on this page.
                                </p>
                            </div>
                        </div>

                        <div className="flex flex-col gap-3 pt-2">
                            <Button
                                onClick={handleStartTour}
                                className="w-full h-12 bg-sidebar hover:bg-sidebar/90 text-sidebar-foreground font-bold rounded-xl shadow-lg shadow-slate-200 transition-all active:scale-95 uppercase tracking-widest text-[10px]"
                            >
                                Start Interactive Tour
                            </Button>
                            <Button
                                variant="ghost"
                                onClick={handleSkipTour}
                                className="w-full text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:text-slate-900"
                            >
                                Skip Guide
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Driver.js Custom Styles Injection */}
            <style jsx global>{`
                .driver-popover.driverjs-theme {
                    background-color: #ffffff;
                    color: #1e293b;
                    border-radius: 1rem;
                    box-shadow: 0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1);
                    padding: 0;
                    border: 1px solid #e2e8f0;
                    font-family: inherit;
                    min-width: 250px;
                    max-width: 320px;
                    z-index: 100000 !important;
                }
                .driver-popover.driverjs-theme .driver-popover-title {
                    font-size: 1rem;
                    font-weight: 800;
                    color: #0f172a;
                    margin-bottom: 0.5rem;
                    letter-spacing: -0.025em;
                }
                .driver-popover.driverjs-theme .driver-popover-description {
                    font-size: 0.875rem;
                    line-height: 1.5;
                    color: #64748b;
                    font-weight: 400;
                }
                .driver-popover.driverjs-theme .driver-popover-footer {
                    margin-top: 1rem;
                    padding-top: 0.75rem;
                    border-top: 1px solid #f1f5f9;
                }
                .driver-popover.driverjs-theme button {
                    flex: 1;
                    text-align: center;
                    background-color: oklch(0.32 0.08 25);
                    color: #ffffff;
                    border: none;
                    text-shadow: none;
                    font-size: 0.75rem;
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    padding: 0.5rem 1rem;
                    border-radius: 0.5rem;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .driver-popover.driverjs-theme button:hover {
                    background-color: oklch(0.42 0.1 25);
                }
                .driver-popover.driverjs-theme button.driver-close-btn {
                    background-color: transparent;
                    color: #94a3b8;
                    border: 1px solid #e2e8f0;
                }
                .driver-popover.driverjs-theme button.driver-close-btn:hover {
                    color: #ef4444;
                    border-color: #fee2e2;
                    background-color: #fef2f2;
                }
                .driver-popover.driverjs-theme .driver-popover-navigation-btns {
                    justify-content: space-between;
                    gap: 0.5rem;
                }
            `}</style>
        </>
    )
}
