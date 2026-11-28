import React, { useEffect, useState } from 'react';
import { Bot, UserRound, ArrowRight, PanelLeftClose, PanelRightClose, PanelLeftOpen, PanelRightOpen, Clock3, FileInput, FileOutput, Maximize2 } from 'lucide-react';
import Logo from '../components/shared/Logo';
import CompanyOSDrillCard from './CompanyOSDrillCard';
import CompanyOSWorkCheckpoint from './CompanyOSWorkCheckpoint';
import CompanyOSWorkCanvas from './CompanyOSWorkCanvas';
import CompanyOSCanvas from './CompanyOSCanvas';
import CompanyOSProcessOverview from './CompanyOSProcessOverview';
import { nodeOperatingCard, eventVerb } from './companyOSNavigation.mjs';
import { processTasks } from './companyOSWorkDetails.mjs';
import { workSetupIssues } from './companyOSReadiness.mjs';

export default function CompanyOSProcessWork({ flow, node, items, events, onBack, onCompany, onHire, onProcess, onTask, onStudio, onProfile, businessName = 'Your company', departmentName = '', initialTaskId = null }) {
  const [left, setLeft] = useState(() => window.innerWidth > 1024);
  const [right, setRight] = useState(() => window.innerWidth > 1024);
  useEffect(() => {
    const narrow = window.matchMedia('(max-width: 1024px)');
    const resize = () => { setLeft(!narrow.matches); setRight(!narrow.matches); };
    narrow.addEventListener('change', resize);
    return () => narrow.removeEventListener('change', resize);
  }, []);
  const card = nodeOperatingCard(node, events);
  const tasks = processTasks(node);
  const [taskId, setTaskId] = useState(initialTaskId);
  const [jobId, setJobId] = useState(null);
  const [overview, setOverview] = useState(null);
  const selectedTask = tasks.find(task => task.id === taskId) || tasks[0];
  const selectedJob = items.find(item => (item.requestId || item.dealId || item.id) === jobId);
  const setupIssues = workSetupIssues({ node, task: selectedTask, hasRecordedWork: Boolean(selectedJob) });
  const isAI = Boolean(node.ai_persona || node.kind === 'ai_step');
  const Icon = node.ai_persona || node.kind === 'ai_step' ? Bot : UserRound;
  useEffect(() => {
    const hire = () => onHire({ flowId: flow.id, flowName: flow.name, stepId: node.id, stepName: node.label, taskId, workId: jobId });
    const contextTask = processTasks(node).find(task => task.id === taskId) || processTasks(node)[0];
    window.dispatchEvent(new CustomEvent('company-os-selection', { detail: { title: selectedJob?.title || contextTask.title, shell: 'work', flowId: flow.id, processId: node.id, taskId: contextTask.id, workId: jobId } }));
    window.dispatchEvent(new CustomEvent('company-os-actions', { detail: [
      { id: 'work-overview', group: 'Next step', label: 'Review this task', consequenceLabel: contextTask.title, primary: true, run: () => { const options = processTasks(node); setOverview(options.find(task => task.id === taskId) || options[0]); } },
      { id: 'work-edit', group: 'Design & assignment', label: 'Edit work in Create Studio', consequenceLabel: 'Inputs, output and task instructions · draft', run: () => onStudio({ ...flow, processId: node.id, taskId: contextTask.id, returnShell: 'work' }) },
      { id: 'work-assign', group: 'Design & assignment', label: 'Configure Human / AI', consequenceLabel: 'Review the responsible role in Create Studio', run: () => onStudio({ ...flow, processId: node.id, taskId: contextTask.id, inspector: 'runtime', returnShell: 'work' }) },
      { id: 'work-person', group: 'Work', label: 'Who is doing this?', consequenceLabel: card.owner, run: () => { setLeft(true); if (window.innerWidth <= 1024) setRight(false); } },
      { id: 'work-activity', group: 'Work', label: 'Explore tasks & details', consequenceLabel: node.label, run: () => { setRight(true); if (window.innerWidth <= 1024) setLeft(false); } },
      { id: 'work-hire', group: 'Capacity', label: 'Hire AI', dock: true, consequenceLabel: 'Review Agents, cost and Flow assignment', run: hire },
    ] }));
    return () => window.dispatchEvent(new CustomEvent('company-os-actions', { detail: [] }));
  }, [flow, node, card.owner, onHire, onStudio, taskId, jobId, selectedJob?.title]);
  return <section className="cos-runtime cos-process-work">
    <header className="cos-header">
      <div className="cos-brand"><Logo variant="mark-only" showText={false} linkTo={null}/><div><b>BIXSO Service OS</b><span>Local workspace</span></div></div>
      <nav className="cos-shell-navigation" aria-label="Work navigation"><button onClick={onCompany}>Company</button><ArrowRight size={14}/>{departmentName && <><span>{departmentName}</span><ArrowRight size={14}/></>}<button onClick={onBack}>{flow.name}</button><ArrowRight size={14}/><strong>{node.label}</strong></nav>
      <div className="cos-company-identity"><div><b>{businessName}</b><span>{departmentName || flow.name} · Work</span></div><button className="cos-avatar" aria-label="Open profile and account" title="Profile & settings" onClick={onProfile}>{businessName.trim().slice(0, 1).toUpperCase()}</button></div>
    </header>
    <div className="cos-workstation" data-left={left} data-right={right}>
      {left ? <aside className="cos-rail cos-rail--left" aria-label="Information panel"><header><small>INFORMATION</small><h2>{card.owner}</h2><button className="cos-rail-toggle" aria-label="Collapse information panel" onClick={() => setLeft(false)}><PanelLeftClose size={16}/></button></header>
        <div className="cos-rail-body"><section className="cos-operating-card cos-work-information">
          <div className="cos-worker-identity"><span className="cos-context-label">{isAI ? 'AI in charge' : 'Human in charge'}</span><Icon size={28}/><strong>{card.owner}</strong><span>{isAI ? 'AI prepares this work within its configured authority.' : 'Human owns the decision and customer-facing result.'}</span></div>
          <dl><div><dt>Works in</dt><dd>{flow.name}</dd></div><div><dt>Responsibility</dt><dd>{node.label}</dd></div>
          <div><dt>Assigned jobs at this step</dt><dd>{items.length}</dd></div>
          <div><dt>Authority</dt><dd>{isAI ? 'Prepares work. Human approval is required for external actions.' : 'Reviews and approves the work within the configured process.'}</dd></div>
          <div><dt>Energy</dt><dd>{card.energy}</dd></div></dl>
          {selectedJob && <section className="cos-selected-context" aria-live="polite"><span className="cos-context-label">Selected job</span><strong>{selectedJob.title || 'Assigned job'}</strong><dl><div><dt>Customer</dt><dd>{selectedJob.customer || 'Not recorded'}</dd></div><div><dt>Status</dt><dd>{selectedJob.status || selectedJob.state || 'Assigned'}</dd></div><div><dt>Next step</dt><dd>{selectedJob.wait || 'Review the task requirements'}</dd></div></dl></section>}
          <div className="cos-selected-context" aria-live="polite"><span className="cos-context-label">Selected task</span><strong>{selectedTask.title}</strong><p>{selectedTask.description || `The task currently selected inside ${node.label}.`}</p>
            <dl><div><dt><FileInput size={14}/>Information in</dt><dd>{selectedTask.input || 'Not defined'}</dd></div><div><dt><FileOutput size={14}/>Information out</dt><dd>{selectedTask.output || 'Not defined'}</dd></div><div><dt><Clock3 size={14}/>Time</dt><dd>{selectedTask.sla || 'Not defined'}</dd></div></dl>
            <button type="button" onClick={() => setOverview(selectedTask)}><Maximize2 size={14}/>Open task overview</button>
          </div>
          {!node.assignee?.name && !node.owner?.name && !node.assignee_name && <p className="cos-empty-note">This is the responsible role. A named worker has not been assigned to this process.</p>}
        </section></div></aside> : <button className="cos-rail-tab left" aria-label="Expand information panel" onClick={() => { setLeft(true); if (window.innerWidth <= 1024) setRight(false); }}><PanelLeftOpen/></button>}
      <CompanyOSCanvas key={node.id} className="cos-work-content"><CompanyOSWorkCanvas flow={flow} node={node} tasks={tasks} selectedTask={selectedTask} selectedJob={selectedJob} owner={card.owner} onSelectTask={id => { setTaskId(id); setJobId(null); setRight(true); setLeft(window.innerWidth > 1024); }} onOverview={task => { setTaskId(task.id); setJobId(null); setOverview(task); }} onProcess={onProcess}/></CompanyOSCanvas>
      {right ? <aside className="cos-rail cos-rail--right" aria-label="Activity panel"><header><small>ACTIVITY</small><h2>{isAI ? 'AI work' : 'Human work'}</h2><button className="cos-rail-toggle" aria-label="Collapse activity panel" onClick={() => setRight(false)}><PanelRightClose size={16}/></button></header><div className="cos-rail-body">
        <div className="cos-drill-context cos-activity-context cos-work-owner-context"><span>Worker focus</span><strong>{card.owner}</strong><p>{node.label} · {tasks.length} task{tasks.length === 1 ? '' : 's'} · {items.length} assigned Work item{items.length === 1 ? '' : 's'}</p></div>
        <CompanyOSWorkCheckpoint title={selectedJob?.title || selectedTask.title} owner={card.owner}
          assignment={node.assignee?.name || node.owner?.name || node.assignee_name ? 'Named worker recorded on this process' : 'Responsible role only · worker assignment still needs confirmation'}
          status={selectedJob?.status || selectedJob?.state || card.status} energy={card.energy} output={selectedTask.output}/>
        <header className="cos-activity-group cos-activity-group--primary"><span>Assigned Work items</span><b>{items.length}</b></header>
        <section className="cos-drill-list" aria-label="Assigned task navigation">
          {items.map(item => <CompanyOSDrillCard key={item.requestId || item.dealId || item.id} icon={Icon} variant="work" title={item.title || 'Assigned job'} description={item.customer}
            owner={card.owner} status={item.status || item.state || 'Assigned'} meta={item.wait || item.source} action="View assigned job" selected={(item.requestId || item.dealId || item.id) === jobId}
            onOpen={() => { setJobId(item.requestId || item.dealId || item.id); onTask?.(flow.id, node.id, item); }}/>) }
          {!items.length && <div className="cos-empty-note"><strong>No assigned work yet</strong><p>The task route is ready. A live job will appear here when it is assigned.</p></div>}
        </section>
        <header className="cos-activity-group"><span>{card.owner} task route</span><b>{tasks.length}</b></header>
        <div className="cos-task-list" aria-label="Process task details">{tasks.map((task,index) => <article key={task.id} className="cos-task-entry" data-selected={selectedTask.id === task.id && !selectedJob}><button className="cos-task-entry-main" type="button" aria-pressed={selectedTask.id === task.id && !selectedJob} onClick={() => { setTaskId(task.id); setJobId(null); if (window.innerWidth <= 1024) setRight(false); }}><span>{index + 1}</span><div><strong>{task.title}</strong><small>{task.kind} · {task.sla || 'Time not set'}</small></div></button><button className="cos-task-entry-overview" type="button" aria-label={`Open ${task.title} task overview`} onClick={() => { setTaskId(task.id); setJobId(null); setOverview(task); }}><Maximize2 size={14}/></button></article>)}</div>
        <section className="cos-work-activity-detail" aria-label="Selected task details">
          <span className="cos-context-label">Selected task details</span><strong>{selectedTask.title}</strong>
          <dl><div><dt>Person in charge</dt><dd>{card.owner}</dd></div><div><dt>Input</dt><dd>{selectedTask.input || 'Not defined'}</dd></div><div><dt>Output</dt><dd>{selectedTask.output || 'Not defined'}</dd></div><div><dt>Time</dt><dd>{selectedTask.sla || 'Not set'}</dd></div><div><dt>Completion</dt><dd>{selectedTask.evidence || 'Evidence not set'}</dd></div></dl>
        </section>
        <section className="cos-work-checkpoint cos-work-setup-compact" aria-label="Work setup checklist"><small>BEFORE EXECUTION</small><h3>{setupIssues.length ? `${setupIssues.length} items to confirm` : 'Design information supplied'}</h3>{setupIssues.length ? <ul>{setupIssues.map(issue => <li key={issue.id}><strong>{issue.area}</strong> · {issue.label}</li>)}</ul> : <p>Server permission, current assignment and live Energy checks are still required before running.</p>}<p>Use Sela’s Design & assignment actions to review the process. A template is not a running job.</p></section>
        <details className="cos-rail-history"><summary>Activity · {events.length}</summary>{events.length ? events.map((event,i) => <article className="cos-event" key={event.id || i}><time><Clock3 size={13}/>{event.at ? new Date(event.at).toLocaleString('en-AU') : 'Time not recorded'}</time><strong>{eventVerb(event)}</strong></article>) : <p>No activity recorded for this process.</p>}</details>
      </div></aside> : <button className="cos-rail-tab right" aria-label="Expand activity panel" onClick={() => { setRight(true); if (window.innerWidth <= 1024) setLeft(false); }}><PanelRightOpen/></button>}
    </div>
    {overview && <CompanyOSProcessOverview node={node} task={overview} flow={flow} onClose={() => setOverview(null)} onOpenTask={task => { setTaskId(task.id); setJobId(null); setOverview(null); setRight(true); if (window.innerWidth <= 1024) setLeft(false); }} onShowWork={() => { setOverview(null); setRight(true); if (window.innerWidth <= 1024) setLeft(false); }}/ >}
  </section>;
}
