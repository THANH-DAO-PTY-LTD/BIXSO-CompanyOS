import React, { useEffect, useRef } from 'react';
import { X, UserRound, Bot, ArrowRight, Workflow, ListChecks, Clock3 } from 'lucide-react';
import { nodeOperatingCard } from './companyOSNavigation.mjs';
import { processTasks } from './companyOSWorkDetails.mjs';
export default function CompanyOSProcessOverview({ node, task, flow, onClose, onShowWork, onOpenTask, relatedFlow, onOpenFlow, onOpenRelatedTask }) {
  const ref = useRef(null);
  useEffect(() => { ref.current?.showModal(); }, []);
  const card = nodeOperatingCard(node, []);
  const OwnerIcon = node.ai_persona || node.kind === 'ai_step' ? Bot : UserRound;
  const tasks = task ? [task] : processTasks(node);
  return <dialog ref={ref} className="cos-department-modal cos-process-overview" aria-labelledby="process-overview-title" onCancel={onClose} onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section><button className="cos-close" aria-label="Close process overview" onClick={onClose}><X size={18}/></button>
      <header><small>{relatedFlow ? 'FLOW' : task ? 'WORK' : 'PROCESS'} OVERVIEW · {flow.name}</small><h2 id="process-overview-title">{task?.title || node.label}</h2><p>{task?.description || relatedFlow?.description || node.description || node.operation?.purpose || node.detail?.description || `This responsibility sits inside ${flow.name}. Review the owner, requirements and tasks before starting work.`}</p></header>
      <div className="cos-overview-summary"><span><ListChecks size={16}/><strong>{relatedFlow ? relatedFlow.nodes?.length || 0 : tasks.length}</strong>{relatedFlow ? 'Processes' : 'Tasks'}</span><span><Clock3 size={16}/><strong>{task?.sla || node.operation?.sla || 'Not scheduled'}</strong>Timing</span></div>
      <div className="cos-overview-owner"><OwnerIcon size={20}/><span><small>PERSON IN CHARGE</small><strong>{card.owner}</strong></span></div>
      <dl className="cos-drill-facts"><div><dt>Input</dt><dd>{task?.input || node.operation?.input || 'Not configured yet'}</dd></div><div><dt>Output</dt><dd>{task?.output || node.operation?.output || 'Not configured yet'}</dd></div><div><dt>Time</dt><dd>{task?.sla || node.operation?.sla || 'Not configured yet'}</dd></div><div><dt>Completion</dt><dd>{task?.evidence || node.operation?.completion_evidence || 'Not configured yet'}</dd></div></dl>
      <h3>{relatedFlow ? 'People & responsibilities' : 'Tasks & shortcuts'}</h3>
      <div className="cos-overview-shortcuts">{relatedFlow ? (relatedFlow.nodes || []).map(item => <button type="button" key={item.id} onClick={() => onOpenRelatedTask ? onOpenRelatedTask(item) : onOpenFlow()}><span className="cos-overview-shortcut-icon">{item.ai_persona ? <Bot size={18}/> : <UserRound size={18}/>}</span><span><strong>{nodeOperatingCard(item).owner}</strong><small>{item.label}</small></span><ArrowRight size={16}/></button>) : tasks.map(item => <button type="button" key={item.id} onClick={() => onOpenTask ? onOpenTask(item) : onShowWork()}><ListChecks size={18}/><span><strong>{item.title}</strong><small>{card.owner} · {item.sla || 'Time not set'}</small></span><ArrowRight size={16}/></button>)}</div>
      <footer><button onClick={onClose}>{task ? 'Back to Work' : 'Back to Flow'}</button>{relatedFlow && onOpenFlow ? <button onClick={onOpenFlow}><Workflow size={16}/>Open Flow<ArrowRight size={15}/></button> : <button onClick={onShowWork}>View work & activity<ArrowRight size={15}/></button>}</footer>
    </section>
  </dialog>;
}
