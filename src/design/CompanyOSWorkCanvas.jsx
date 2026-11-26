import React from 'react';
import { ArrowRight, FileInput, FileOutput, Bot, UserRound, Maximize2 } from 'lucide-react';

function Connection() {
  return <div className="cos-information-connector" aria-hidden="true"><i/><ArrowRight size={16}/></div>;
}

export default function CompanyOSWorkCanvas({ flow, node, tasks, selectedTask, selectedJob, owner, onSelectTask, onProcess, onOverview }) {
  const neighbours = direction => (flow.edges || []).filter(edge => String(edge[direction === 'in' ? 'to' : 'from']) === String(node.id))
    .map(edge => flow.nodes?.find(row => String(row.id) === String(edge[direction === 'in' ? 'from' : 'to'])))
    .filter(Boolean);
  const incoming = neighbours('in'), outgoing = neighbours('out');
  const Worker = node.ai_persona || node.kind === 'ai_step' ? Bot : UserRound;
  return <section className="cos-information-map" aria-label="Work information flow">
    <header className="cos-diagram-title"><span>WORK DIAGRAM</span><h1>How {selectedJob?.title || node.label} gets done</h1></header>
    <div className="cos-information-route">
      <article className="cos-information-end"><FileInput size={20}/><small>INFORMATION IN</small>
        <h2>{selectedTask.input || 'Input to define'}</h2>
        <span className="cos-information-caption">{incoming.length ? 'From' : 'Start of this Flow'}</span>
        {incoming.map(row => <button key={row.id} onClick={() => onProcess(row)}>{row.label}<ArrowRight size={13}/></button>)}
      </article>
      <Connection/>
      <article className="cos-information-worker"><div className="cos-information-person"><Worker size={24}/><span><small>RESPONSIBLE ROLE</small><strong>{owner}</strong></span></div>
        <div className="cos-inline-tasks">{tasks.map((task,index) => <article key={task.id} data-selected={task.id === selectedTask.id}><button className="cos-inline-task-main" type="button" aria-pressed={task.id === selectedTask.id} onClick={() => onSelectTask(task.id)}><span>{index + 1}</span><strong>{task.title}</strong></button><button className="cos-inline-task-overview" type="button" aria-label={`Open ${task.title} task overview`} onClick={() => onOverview?.(task)}><Maximize2 size={13}/></button></article>)}</div>
      </article>
      <Connection/>
      <article className="cos-information-end cos-information-output"><FileOutput size={20}/><small>INFORMATION OUT</small>
        <h2>{selectedTask.output || 'Expected output to define'}</h2>
        <span className="cos-information-caption">{outgoing.length ? 'Passes to' : 'End of this Flow'}</span>
        {outgoing.map(row => <button key={row.id} onClick={() => onProcess(row)}>{row.label}<ArrowRight size={13}/></button>)}
      </article>
    </div>
  </section>;
}
