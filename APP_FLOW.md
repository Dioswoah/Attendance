# Application Process Flow

This document visualizes the user journey and operational logic of the Attendance Application.

## 1. Authentication & Onboarding Flow
This is the entry point for all users.

```mermaid
flowchart TD
    Start[User Opens App] --> Login{Login Page}
    Login -->|Sign in with Google| AuthCheck[Google Authentication]
    
    AuthCheck -->|Success| DomainCheck{Email Domain Verified?}
    AuthCheck -->|Fail| LoginError[Show Error]
    
    DomainCheck -->|No| AccessDenied[Access Denied Page]
    DomainCheck -->|Yes| DBCheck{User Exists in DB?}
    
    DBCheck -->|No| CreateUser[Create User Account]
    CreateUser --> Onboarding[Onboarding Flow\n(Select Location, Manager)]
    Onboarding --> UserDash
    
    DBCheck -->|Yes| RoleCheck{Check User Role}
    
    RoleCheck -->|USER| UserDash[User Dashboard]
    RoleCheck -->|MANAGER| MgrDash[Manager Dashboard]
    RoleCheck -->|ADMIN| AdminDash[Admin Portal]
```

## 2. User Daily Workflow (Attendance)
The core loop for a regular employee.

```mermaid
flowchart TD
    UserDash[User Dashboard] --> StatusCheck{Current Status?}
    
    StatusCheck -->|Clocked Out| ActionIn[Click 'Clock In']
    ActionIn --> ModeSel{Select Mode}
    ModeSel -->|Office| StateWorking[State: WORKING\n(Timer Running)]
    ModeSel -->|WFH| StateWorking
    
    StateWorking --> ActionBreak[Click 'Start Break']
    ActionBreak --> StateBreak[State: ON BREAK\n(Break Timer)]
    
    StateBreak --> ActionEndBreak[Click 'End Break']
    ActionEndBreak --> StateWorking
    
    StateWorking --> ActionOut[Click 'Clock Out']
    ActionOut --> Summary[View Day Summary]
    Summary --> StateOut[State: CLOCKED OUT]
```

## 3. Request & Approval Cycle
How data changes move from User to Admin.

```mermaid
flowchart LR
    subgraph User Portal
    U1[User Issues] -->|Mistake in Time?| ReqAmend[Request Amendment]
    U2[Vacation?] -->|Submit Form| ReqLeave[Request Leave]
    end
    
    ReqAmend --> StatusPending[Status: PENDING]
    ReqLeave --> StatusPending
    
    subgraph Admin/Manager Portal
    StatusPending --> Review[Manager Reviews Request]
    Review -->|Approve| DBUpdate[Update Database]
    Review -->|Decline| Reject[Mark Rejected]
    end
    
    DBUpdate --> NotifyUser[Notify User: Approved]
    Reject --> NotifyUser2[Notify User: Declined]
```

## 4. Admin Management Flow

```mermaid
flowchart TD
    AdminDash[Admin Dashboard] --> Section1[Staff Management]
    AdminDash --> Section2[Approvals]
    AdminDash --> Section3[Reports]
    
    Section1 --> AddStaff[Add/Edit User]
    Section1 --> AssignDept[Assign Department/Team]
    
    Section2 --> ViewReq[View Pending Requests]
    ViewReq --> BatchAction[Bulk Approve/Reject]
    
    Section3 --> Payroll[Generate Payroll Report]
    Section3 --> Audit[View Activity Logs]
```
