import React, { useEffect, useRef } from 'react';
import { ArrowRight } from 'lucide-react';

// The same read -> open pattern at every depth of Service OS.
export default function CompanyOSDrillCard({ icon: Icon, title, description, owner, status, meta, tasks = [], facts = [], action, onOpen, onTaskOpen, selected = false, index, eyebrow, taskActionLabel = 'Open Work shell', variant = 'flow', personFirst = false }) {
  const ref = useRef(null);
  useEffect(() => { if (selected) ref.current?.scrollIntoView({ block: 'nearest' }); }, [selected]);
  const singleTask = !action && onTaskOpen && tasks.length === 1 && tasks[0].title === title;
  const primary = singleTask ? () => onTaskOpen(tasks[0]) : action ? onOpen : null;
  const heading = <><span className="cos-drill-icon"><Icon size={18}/>{index !== undefined && <b className="cos-drill-number">{index + 1}</b>}</span><span>{eyebrow && <em>{eyebrow}</em>}<strong>{personFirst && owner ? owner : title}</strong>{personFirst && <span className="cos-drill-responsibility">{title}</span>}{primary && <small>{singleTask ? taskActionLabel : action}</small>}</span>{primary && <ArrowRight size={15}/>}</>;
  return <article ref={ref} className={`cos-drill-card cos-drill-card--${variant}`} data-selected={selected}>
    {primary ? <button className="cos-drill-heading cos-drill-entry" aria-label={`${singleTask ? 'Open work' : action}: ${title}`} onClick={primary}>{heading}</button> : <div className="cos-drill-heading">{heading}</div>}
    {selected && <span className="cos-drill-resume">Selected</span>}
    {description && <p>{description}</p>}
    {owner && !personFirst && <span className="cos-drill-owner">{owner}</span>}
    {facts.length > 0 && <dl className="cos-drill-facts" aria-label={`${title} key facts`}>{facts.map(([label,value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>}
    {!singleTask && tasks.length > 0 && <ul className="cos-drill-tasks">{tasks.map(task => <li key={task.id}>{onTaskOpen ? <button onClick={() => onTaskOpen(task)}><span>{task.title}<small>{task.meta || task.owner || taskActionLabel}</small></span><em>{task.actionLabel || taskActionLabel}</em><ArrowRight size={14}/></button> : <span>{task.title}<small>{task.meta || task.owner}</small></span>}</li>)}</ul>}
    <div className="cos-drill-meta">{status && <span>{status}</span>}{meta && <span>{meta}</span>}</div>
  </article>;
}
