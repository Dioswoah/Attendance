"use client"

import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import { driver } from "driver.js"
import "driver.js/dist/driver.css"
import { Button } from "@/components/ui/button"
import { HelpCircle, PlayCircle, XCircle } from "lucide-react"
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog"

export function UserOnboardingTour({ mode = 'full' }: { mode?: 'full' | 'trigger' | 'logic' }) {
    const [mounted, setMounted] = useState(false)
    const [showWelcomeDialog, setShowWelcomeDialog] = useState(false)
    const pathname = usePathname()

    useEffect(() => {
        setMounted(true)
    }, [])

    // Define steps for each route
    const tourConfig: Record<string, { title: string, description: string, steps: any[] }> = {
        '/user': {
            title: "Daily Command Center",
            description: "Your unified workspace for attendance and team tracking",
            steps: [
                {
                    element: '#tour-header',
                    popover: {
                        title: 'Daily Command Center',
                        description: 'Welcome to your new unified dashboard! View your greeting, date, and live status at a glance.',
                        side: "bottom", align: 'start'
                    }
                },
                {
                    element: '#tour-status-badge',
                    popover: {
                        title: 'Live Status Indicator',
                        description: 'Always know your current state. This badge remains in sync with your clocking actions in real-time.',
                        side: "bottom", align: 'start'
                    }
                },
                {
                    element: '#tour-time-tracker',
                    popover: {
                        title: 'Precision Time Tracker',
                        description: 'The heart of your dashboard. Track your session time, view your schedule, and monitor your current status visualization.',
                        side: "right", align: 'start'
                    }
                },
                {
                    element: '#tour-action-buttons',
                    popover: {
                        title: 'Interactive Controls',
                        description: 'One-click actions to Clock In, Start Break, or Clock Out. Use the dropdown on Clock In to request manual time adjustments.',
                        side: "top", align: 'center'
                    }
                },
                {
                    element: '#tour-stats-worked',
                    popover: {
                        title: 'Worked Time',
                        description: 'Your total logged work hours for the current day, calculated to the minute.',
                        side: "top"
                    }
                },
                {
                    element: '#tour-stats-break',
                    popover: {
                        title: 'Break Usage',
                        description: 'Monitor your total break time here. Remember to keep it within the 1-hour daily limit!',
                        side: "top"
                    }
                },
                {
                    element: '#tour-stats-pending',
                    popover: {
                        title: 'Task Queue',
                        description: 'Quickly see how many of your Leave or Attendance requests are currently awaiting manager approval.',
                        side: "top"
                    }
                },
                {
                    element: '#tour-activity-feed',
                    popover: {
                        title: 'Session Timeline',
                        description: 'A beautiful chronological feed of everything you\'ve done today, including locations and timestamps.',
                        side: "left", align: 'start'
                    }
                },
                {
                    element: '#tour-staff-status',
                    popover: {
                        title: 'Team Intelligence',
                        description: 'Switch between Staff Overview and the Leave Calendar to stay informed about your colleagues\' availability.',
                        side: "top", align: 'start'
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
                        title: 'Leave Portal',
                        description: 'Everything related to your time off is managed right here.',
                        side: "bottom", align: 'start'
                    }
                },
                {
                    element: '#tour-leaves-request-btn',
                    popover: {
                        title: 'Request Leave',
                        description: 'Start a new application for Sick Leave, VL, or other categories.',
                        side: "bottom", align: 'start'
                    }
                },
                {
                    element: '#tour-leaves-filter',
                    popover: {
                        title: 'Smart Filters',
                        description: 'Toggle between Active and Archived requests to keep your workspace clean.',
                        side: "bottom", align: 'start'
                    }
                },
                {
                    element: '#tour-leaves-grid',
                    popover: {
                        title: 'Application History',
                        description: 'Detailed cards for every request. You can edit pending ones or see reasons for declines.',
                        side: "top", align: 'center'
                    }
                }
            ]
        },
        '/user/amend-records': {
            title: "Record Amendments",
            description: "Correct your attendance logs with precision",
            steps: [
                {
                    element: '#tour-amend-header',
                    popover: {
                        title: 'Amend Records',
                        description: 'Fixing mistakes is easy. Request corrections for missed logs or incorrect timestamps here.',
                        side: "bottom", align: 'start'
                    }
                },
                {
                    element: '#tour-amend-new-btn',
                    popover: {
                        title: 'Smart Amending',
                        description: 'Click "Amend" on any record row to open our new precision correction tool.',
                        side: "bottom", align: 'start'
                    }
                },
                {
                    element: '#tour-amend-log',
                    popover: {
                        title: 'Amendment Status',
                        description: 'Track the progress of your correction requests. Approved changes update your logs instantly.',
                        side: "top", align: 'start'
                    }
                },
                {
                    element: '#tour-amend-grid',
                    popover: {
                        title: 'Historical Log',
                        description: 'A dedicated audit trail of all your submitted adjustments.',
                        side: "top", align: 'center'
                    }
                }
            ]
        },
        '/user/activity': {
            title: "Detailed Activity",
            description: "Your full attendance audit trail",
            steps: [
                {
                    element: '#tour-activity-header',
                    popover: {
                        title: 'Full Audit Log',
                        description: 'View every single timestamp across your entire employment history.',
                        side: "bottom", align: 'start'
                    }
                },
                {
                    element: '#tour-activity-filters',
                    popover: {
                        title: 'Deep Search',
                        description: 'Filter by date range, specific events, or keywords to find past records.',
                        side: "bottom", align: 'start'
                    }
                },
                {
                    element: '#tour-activity-list',
                    popover: {
                        title: 'Master Timeline',
                        description: 'The definitive record of your attendance history.',
                        side: "top", align: 'center'
                    }
                }
            ]
        },
        '/user/manager': {
            title: "Manager Control",
            description: "Command center for team leadership",
            steps: [
                {
                    element: '#tour-manager-header',
                    popover: {
                        title: 'Management Suite',
                        description: 'Your central hub for overseeing team performance and requests.',
                        side: "bottom", align: 'start'
                    }
                },
                {
                    element: '#tour-manager-tab-requests',
                    popover: {
                        title: 'Approval Center',
                        description: 'Process pending team requests with bulk-action support.',
                        side: "bottom", align: 'center'
                    }
                },
                {
                    element: '#tour-manager-tab-history',
                    popover: {
                        title: 'Approval History',
                        description: 'Review your past management decisions and audit trails.',
                        side: "bottom", align: 'center'
                    }
                },
                {
                    element: '#tour-manager-tab-calendar',
                    popover: {
                        title: 'Strategic Calendar',
                        description: 'Visualize team availability across the month for better planning.',
                        side: "bottom", align: 'center'
                    }
                },
                {
                    element: '#tour-manager-tab-performance',
                    popover: {
                        title: 'Performance Analytics',
                        description: 'Track punctuality, variance, and work-hour trends for your team.',
                        side: "bottom", align: 'center'
                    }
                },
                {
                    element: '#tour-manager-tab-reports',
                    popover: {
                        title: 'Exports & Reports',
                        description: 'Generate and download professional Excel reports for payroll or review.',
                        side: "bottom", align: 'center'
                    }
                },
                {
                    element: '#tour-manager-pending',
                    popover: {
                        title: 'Urgent Actions',
                        description: 'A summary of items requiring your immediate attention is grouped here.',
                        side: "top", align: 'center'
                    }
                }
            ]
        }
    }

    const currentTour = tourConfig[pathname || '']
    const storageKey = `has_seen_tour_${pathname}`

    useEffect(() => {
        if (!mounted || !currentTour || mode === 'trigger') return

        const hasSeenTour = localStorage.getItem(storageKey)
        if (!hasSeenTour) {
            // Check if user profile setup is in progress
            // Wait longer to allow profile setup dialog to show first
            const checkProfileSetup = () => {
                // Look for the onboarding dialog in the DOM
                const onboardingDialog = document.querySelector('[role="dialog"]')
                const hasOnboardingDialog = onboardingDialog?.textContent?.includes('Set Up Your Profile')

                if (hasOnboardingDialog) {
                    // Profile setup is showing, check again later
                    setTimeout(checkProfileSetup, 2000)
                } else {
                    // Profile setup is complete or not needed, show tour
                    setShowWelcomeDialog(true)
                }
            }

            // Delay to ensure hydration and layout stability, then check
            const timer = setTimeout(() => {
                checkProfileSetup()
            }, 2000)
            return () => clearTimeout(timer)
        }
    }, [mounted, pathname, storageKey, mode])

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
            {(mode === 'full' || mode === 'trigger') && (
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={startTour}
                    className="h-9 w-9 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-full transition-all"
                    title="Page Guide"
                >
                    <HelpCircle className="h-5 w-5" />
                </Button>
            )}

            {/* Welcome Dialog */}
            {(mode === 'full' || mode === 'logic') && (
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
            )}

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
