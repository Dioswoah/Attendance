// In-scope field technicians for the simPRO-driven attendance feature.
// Scope rule (Marc, 2026-07-15): everyone on the AU EMPLOYEES sheet whose
// DESIGNATION is FIELD, regardless of position. simPRO employee IDs are
// build-wide (identical across companies 1 and 10).
//
// rsaEmail is the Google Workspace primary address — the canonical identity
// used to link a simPRO employee to an RSA User. Several techs have wrong or
// placeholder emails inside simPRO itself, which is why this explicit map
// exists instead of matching on simPRO's PrimaryContact.Email.

export interface SimproRosterEntry {
    simproEmployeeId: number
    simproName: string
    rsaEmail: string
    displayName: string
}

export const SIMPRO_FIELD_ROSTER: SimproRosterEntry[] = [
    { simproEmployeeId: 1799, simproName: 'Michael Lowe', rsaEmail: 'michael.lowe@redadair.com.au', displayName: 'Michael Lowe' },
    { simproEmployeeId: 1834, simproName: 'Stefan Engsall', rsaEmail: 'stefane@redadair.com.au', displayName: 'Stefan Engsall' },
    { simproEmployeeId: 965, simproName: 'Peter Cross', rsaEmail: 'peterc@redadair.com.au', displayName: 'Peter Cross' },
    { simproEmployeeId: 1298, simproName: 'Clint Parkes', rsaEmail: 'clintp@redadair.com.au', displayName: 'Clint Parkes' },
    { simproEmployeeId: 1581, simproName: 'Muhammad Soban', rsaEmail: 'muhammads@redadair.com.au', displayName: 'Muhammad Soban' },
    { simproEmployeeId: 150, simproName: 'Brett Roberts', rsaEmail: 'brettr@redadair.com.au', displayName: 'Brett Roberts' },
    { simproEmployeeId: 1753, simproName: 'Josh Roger', rsaEmail: 'joshr@redadair.com.au', displayName: 'Josh Roger' },
    { simproEmployeeId: 1836, simproName: 'Shayan Kharaghani', rsaEmail: 'shayank@redadair.com.au', displayName: 'Shayan Kharaghani' },
    { simproEmployeeId: 1838, simproName: 'Simon Sleiman', rsaEmail: 'simons@redadair.com.au', displayName: 'Simon Sleiman' },
    { simproEmployeeId: 1243, simproName: 'Rumira Gluszko-Hardes', rsaEmail: 'rumirag@redadair.com.au', displayName: 'Rumira Gluszko-Hardes' },
    { simproEmployeeId: 911, simproName: 'Adam Swindail', rsaEmail: 'adams@redadair.com.au', displayName: 'Adam Swindail' },
    { simproEmployeeId: 883, simproName: 'Benjamin Warner', rsaEmail: 'benjaminw@redadair.com.au', displayName: 'Benjamin Warner' },
    { simproEmployeeId: 1751, simproName: 'Brendan Jones', rsaEmail: 'brendanj@redadair.com.au', displayName: 'Brendan Jones' },
    { simproEmployeeId: 915, simproName: 'Brian Attard', rsaEmail: 'briana@redadair.com.au', displayName: 'Brian Attard' },
    { simproEmployeeId: 1395, simproName: 'Micheal Keough', rsaEmail: 'michealk@redadair.com.au', displayName: 'Micheal Keough' },
    { simproEmployeeId: 1080, simproName: 'Paul Lloyd', rsaEmail: 'paull@redadair.com.au', displayName: 'Paul Lloyd' },
    { simproEmployeeId: 1616, simproName: 'Rob Searle', rsaEmail: 'robs@redadair.com.au', displayName: 'Rob Searle' },
    { simproEmployeeId: 1870, simproName: 'Dechlan McGarrity', rsaEmail: 'dechlanm@redadair.com.au', displayName: 'Dechlan McGarrity' },
    { simproEmployeeId: 1897, simproName: 'Dylan Jackson', rsaEmail: 'dylanj@redadair.com.au', displayName: 'Dylan Jackson' },
    { simproEmployeeId: 1901, simproName: 'Harvey Layden', rsaEmail: 'harveyl@redadair.com.au', displayName: 'Harvey Leyden' },
    { simproEmployeeId: 1910, simproName: 'Mitchell Dawson', rsaEmail: 'mitchelld@redadair.com.au', displayName: 'Mitchell Dawson' },
    { simproEmployeeId: 1916, simproName: 'Nick Agoratsios', rsaEmail: 'nicholasa@redadair.com.au', displayName: 'Nick Agoratsios' },
    { simproEmployeeId: 1914, simproName: 'Salesh Chand', rsaEmail: 'saleshc@redadair.com.au', displayName: 'Salesh Chand' },
    { simproEmployeeId: 1919, simproName: 'Jordan Price', rsaEmail: 'jordanp@redadair.com.au', displayName: 'Jordan Price' },
    { simproEmployeeId: 15, simproName: 'Ryan Gordon', rsaEmail: 'ryang@redadair.com.au', displayName: 'Ryan Gordon' },
    { simproEmployeeId: 1873, simproName: 'Hayden White', rsaEmail: 'haydenw@redadair.com.au', displayName: 'Hayden White' },
    { simproEmployeeId: 1875, simproName: 'Mitchell Pearce', rsaEmail: 'mitchellp@redadair.com.au', displayName: 'Mitchell Pearce' },
]

// On the sheet but currently unmappable — kept here so it's visible, not silently lost:
//  - Jason McAlpine (jasonm@redadair.com.au): no simPRO account in any company
//  - Yasith Iranga: starts 27/07/2026, not yet in Workspace or simPRO
//  - Mick Zammit: excluded — Workspace account never logged in

export const SIMPRO_ROSTER_BY_EMPLOYEE_ID = new Map(
    SIMPRO_FIELD_ROSTER.map((e) => [e.simproEmployeeId, e]),
)
