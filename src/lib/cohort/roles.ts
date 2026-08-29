/**
 * DCWF work-role catalog + survey↔role mapping for the Cohort Builder.
 *
 * The 16 in-scope work roles this capstone targets, with plain-English
 * definitions (sourced from DCWF v5.2). Used by:
 *   - the survey's role-aspiration dropdown (Q4) and its definitions popover
 *   - the solver, to translate the 8 survey skill axes into DCWF role coverage
 *
 * Keeping this in one file means the survey, the solver, and the semester
 * alignment reports all speak the same vocabulary.
 */

export interface RoleDef {
  code: string
  title: string
  element: string
  definition: string
}

export const IN_SCOPE_ROLES: RoleDef[] = [
  { code: '212', title: 'Cyber Defense Forensics Analyst', element: 'Cybersecurity', definition: 'Analyzes digital evidence and investigates computer security incidents to support vulnerability mitigation.' },
  { code: '411', title: 'Technical Support Specialist', element: 'IT (Cyberspace)', definition: 'Provides technical support to users of client hardware and software (help desk, troubleshooting).' },
  { code: '421', title: 'Database Administrator', element: 'IT (Cyberspace)', definition: 'Administers databases and data-management systems for storage, query, and use of data.' },
  { code: '422', title: 'Data Analyst', element: 'Data/AI', definition: 'Analyzes and interprets data from multiple sources and builds visualizations and dashboards.' },
  { code: '431', title: 'Knowledge Manager', element: 'IT (Cyberspace)', definition: 'Manages the processes and tools that let an organization document and access intellectual capital.' },
  { code: '441', title: 'Network Operations Specialist', element: 'IT (Cyberspace)', definition: 'Plans, implements, and operates network services and systems (physical and virtual).' },
  { code: '451', title: 'System Administrator', element: 'IT (Cyberspace)', definition: 'Installs, configures, troubleshoots, and maintains hardware/software and administers system accounts.' },
  { code: '452', title: 'Secure Configuration Specialist', element: 'IT (Cyberspace)', definition: 'Applies and monitors secure configuration baselines for platforms, applications, and networks (hardening).' },
  { code: '511', title: 'Cyber Defense Analyst', element: 'Cybersecurity', definition: 'Uses IDS/firewall/log data to analyze security events and detect threats in the environment.' },
  { code: '521', title: 'Cyber Defense Infrastructure Support Specialist', element: 'Cybersecurity', definition: 'Tests, deploys, and maintains the security infrastructure hardware and software.' },
  { code: '531', title: 'Cyber Defense Incident Responder', element: 'Cybersecurity', definition: 'Investigates, analyzes, and responds to cyber incidents within the network.' },
  { code: '541', title: 'Vulnerability Assessment Analyst', element: 'Cybersecurity', definition: 'Assesses systems and networks to identify deviations from acceptable secure configurations (scanning, CSET).' },
  { code: '612', title: 'Security Control Assessor', element: 'Cybersecurity', definition: 'Conducts independent assessments of security controls (SSP, compliance).' },
  { code: '621', title: 'Software Developer', element: 'Software Engineering', definition: 'Designs, develops, and maintains secure software across the development lifecycle.' },
  { code: '632', title: 'Systems Developer', element: 'IT (Cyberspace)', definition: 'Designs, develops, tests, and evaluates information systems across their lifecycle.' },
  { code: '722', title: 'Information Systems Security Manager', element: 'Cybersecurity', definition: 'Responsible for the cybersecurity of a program, organization, system, or enclave.' },
]

export const ROLE_BY_CODE: Record<string, RoleDef> = Object.fromEntries(
  IN_SCOPE_ROLES.map((r) => [r.code, r])
)

/**
 * The 8 capability axes the survey rates (Q2 grid), each mapped to the DCWF
 * work roles that capability contributes to. This is how a student's 1–5
 * self-ratings become a role-coverage vector for the solver.
 */
export interface SkillAxis {
  key: string
  label: string
  hint: string
  roles: string[]
}

export const SKILL_AXES: SkillAxis[] = [
  { key: 'network', label: 'Network infrastructure', hint: 'routers, firewalls, VLANs, DNS', roles: ['441', '451'] },
  { key: 'windowsAd', label: 'Windows Server & Active Directory', hint: 'identity, GPO', roles: ['451', '452'] },
  { key: 'linux', label: 'Linux / Red Hat administration', hint: 'RHEL, services', roles: ['451', '521'] },
  { key: 'database', label: 'Databases', hint: 'SQL, schema, backups', roles: ['421', '422'] },
  { key: 'web', label: 'Web & e-commerce', hint: 'server setup, storefront', roles: ['621', '632'] },
  { key: 'programming', label: 'Programming & automation', hint: 'Python, scripting, agents', roles: ['621', '632'] },
  { key: 'security', label: 'Security & hardening', hint: 'CSET, scanning, STIGs', roles: ['452', '541', '612'] },
  { key: 'incident', label: 'Incident response & forensics', hint: 'week-13 red team', roles: ['511', '531', '212'] },
]

export const SKILL_KEYS = SKILL_AXES.map((a) => a.key)

/** Capability "pillars" used for coverage scoring — the axis labels double as pillars. */
export const PILLARS = SKILL_AXES.map((a) => a.key)

export type LeadershipPref = 'prefer' | 'willing' | 'no'
export type WorkStyle = 'deep' | 'generalist' | 'coordination' | 'flexible'
export type TimePref = 'morning' | 'afternoon' | 'evening' | 'none'
export const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
