import React from 'react';
import { UserRound, ClipboardCheck, Zap, ShieldCheck } from 'lucide-react';

// A decision summary, not an execution button or a payment estimate.
export default function CompanyOSWorkCheckpoint({ title, owner, assignment, status, energy, output }) {
  return <section className="cos-work-checkpoint" aria-label="Work decision summary" aria-live="polite">
    <small>WORK TO COMPLETE</small><h3>{title}</h3>
    <dl>
      <div><dt><UserRound size={15}/>Responsible</dt><dd>{owner}<small>{assignment}</small></dd></div>
      <div><dt><ClipboardCheck size={15}/>Current state</dt><dd>{status}</dd></div>
      <div><dt><Zap size={15}/>Energy</dt><dd>{energy}<small>No paid execution is connected in this preview.</small></dd></div>
      <div><dt><ShieldCheck size={15}/>Result to review</dt><dd>{output || 'Define the expected result before completing this work.'}</dd></div>
    </dl><p>Use Sela to prepare, review or configure this work. Assignment alone does not run it.</p>
  </section>;
}
