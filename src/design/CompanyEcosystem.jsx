import React, { useLayoutEffect, useRef, useState } from 'react';
import {
  Building2, UsersRound, Sparkles, PackageCheck, Workflow, ShieldCheck, CircleDollarSign,
  Maximize2, UserRound, Bot, BriefcaseBusiness,
} from 'lucide-react';
import { companyPartners } from './companyOSEcosystem.mjs';
import { flowScope } from './companyOSNavigation.mjs';
import './company-ecosystem.css';

const icons = [UsersRound, Sparkles, PackageCheck, Building2, ShieldCheck, CircleDollarSign];
const AREA_ORDER = ['growth', 'care', 'delivery', 'finance', 'assurance', 'operations'];
const DEPARTMENT_FLOW_LINKS = [
  { id: 'growth-delivery', path: 'M 32 27 H 38 V 43 H 41', delay: '0s' },
  { id: 'care-delivery', path: 'M 32 73 H 38 V 57 H 41', delay: '.7s' },
  { id: 'delivery-finance', path: 'M 59 43 H 62 V 27 H 68', delay: '.35s' },
  { id: 'delivery-assurance', path: 'M 59 57 H 62 V 73 H 68', delay: '1.05s' },
];
export default function CompanyEcosystem({ name, areas, selectedId, onSelect, onOpenDepartment, workItems = [], flows = [] }) {
  const mapRef = useRef(null);
  const [routes, setRoutes] = useState([]);
  const selectedPartner = companyPartners.find(item => item.id === selectedId);
  const focusArea = selectedPartner?.area || selectedId;
  useLayoutEffect(() => {
    const root = mapRef.current;
    const measure = () => {
      const bounds = root.getBoundingClientRect();
      const rect = id => {
        const node = root.querySelector(`[data-map-node="${id}"]`);
        if (!node) return null;
        const r = node.getBoundingClientRect();
        return { x: r.left - bounds.left, y: r.top - bounds.top, w: r.width, h: r.height };
      };
      const next = DEPARTMENT_FLOW_LINKS.flatMap(link => {
        const [from, to] = link.id.split('-');
        const a = rect(from), b = rect(to);
        if (!a || !b || b.x <= a.x) return [];
        const x1 = a.x + a.w, x2 = b.x, y1 = a.y + a.h / 2, y2 = b.y + b.h / 2;
        const mid = (x1 + x2) / 2;
        return [{ ...link, from, to, path: `M ${x1} ${y1} H ${mid} V ${y2} H ${x2}` }];
      });
      for (const partner of companyPartners.filter(item => item.id === selectedId || item.area === selectedId)) {
        const a = rect(partner.id), b = rect(partner.area);
        if (a && b) {
          const right = partner.id === 'suppliers' || partner.id === 'accountant' || partner.id === 'authorities';
          const lane = right ? bounds.width - 3 : 3;
          const top = ['customers', 'platform', 'suppliers'].includes(partner.id);
          const startY = top ? a.y + a.h : a.y;
          const gapY = startY + (top ? 12 : -12);
          const endX = right ? b.x + b.w : b.x;
          const endY = b.y + b.h / 2;
          next.push({ id: partner.id, from: partner.id, to: partner.area, delay: '0s', path: `M ${a.x + a.w / 2} ${startY} V ${gapY} H ${lane} V ${endY} H ${endX}` });
        }
      }
      setRoutes(next);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    root.querySelectorAll('[data-map-node]').forEach(node => observer.observe(node));
    measure();
    return () => observer.disconnect();
  }, [areas, selectedId]);
  const areaStats = (area) => {
    const scoped = flowScope(flows, area.flows || []);
    const flowCount = area.flows?.length || 0;
    const cardCount = scoped.reduce((total, flow) => total + (flow.nodes?.filter(node => !node.flow_ref).length || 0), 0);
    const firstFlow = area.flows?.[0]?.name || 'No Flow yet';
    const liveFlowCount = (area.flows || []).filter(flow => !flow.sampleOnly).length;
    const humanCount = scoped.reduce((total, flow) => total + (flow.nodes || []).filter(node => !node.flow_ref && !node.ai_persona && !['ai_step','subflow','gateway','wait'].includes(node.kind)).length, 0);
    const aiCount = scoped.reduce((total, flow) => total + (flow.nodes || []).filter(node => !node.flow_ref && (node.ai_persona || node.kind === 'ai_step')).length, 0);
    const flowIds = new Set(scoped.map(flow => String(flow.id)));
    const workCount = workItems.filter(item => flowIds.has(String(item.flowId))).length;
    const active = flowCount > 0 || workCount > 0;
    const status = workCount
      ? `${workCount} Work item${workCount === 1 ? '' : 's'}`
      : flowCount
        ? `${flowCount} Flow${flowCount === 1 ? '' : 's'} · ${cardCount} cards`
        : 'No work route yet';
    return { flowCount, cardCount, firstFlow, liveFlowCount, humanCount, aiCount, workCount, active, status };
  };
  const partner = (item, index) => {
    const Icon = icons[index];
    return <button key={item.id} data-map-node={item.id} className={`ecosystem-card ecosystem-card--external ${selectedId === item.id ? 'selected' : ''}`} onClick={() => onSelect({ ...item, external: true })} aria-pressed={selectedId === item.id}>
      <span className="ecosystem-icon"><Icon size={18}/></span>
      <strong>{item.title}</strong>
      <span>{index === 1 ? 'Workspace' : 'Outside connection'}</span>
    </button>;
  };
  const orderIndex = (id) => {
    const index = AREA_ORDER.indexOf(id);
    return index === -1 ? AREA_ORDER.length : index;
  };
  const sortedAreas = [...areas].sort((a, b) => orderIndex(a.id) - orderIndex(b.id));
  const renderArea = (area) => {
    const { firstFlow, liveFlowCount, humanCount, aiCount, workCount, active, status } = areaStats(area);
    return <article key={area.id} data-map-node={area.id} data-area-id={area.id} className={`ecosystem-card ecosystem-card--area ${selectedId === area.id ? 'selected' : ''} ${active ? 'is-active' : 'is-empty'}`}>
      <button className="ecosystem-card-main" type="button" aria-pressed={selectedId === area.id} onClick={() => onSelect(area)}>
        <span className="ecosystem-card-top">
          <span className="ecosystem-icon"><Workflow size={17}/></span>
          <span className={`ecosystem-live-dot ${liveFlowCount || workCount ? 'is-live' : ''}`} aria-hidden="true" />
          <span className="ecosystem-card-kicker">{active ? 'Operating' : 'Ready to design'}</span>
        </span>
        <strong>{area.title}</strong>
        <span className="ecosystem-status"><BriefcaseBusiness size={13}/>{status}</span>
        <small>{firstFlow}</small>
        <span className="ecosystem-people" aria-label={`${area.title} working roles`}>
          <i><UserRound size={12}/>{humanCount || '—'} Human steps</i>
          <i><Bot size={12}/>{aiCount || '—'} AI steps</i>
        </span>
      </button>
      <button className="ecosystem-overview-button" type="button" aria-label={`Open ${area.title} department overview`} onClick={() => onOpenDepartment?.(area)}>
        <Maximize2 size={15}/>
      </button>
    </article>;
  };
  return <section className="company-ecosystem" aria-label="Company ecosystem diagram">
    <header className="ecosystem-title">
      <small>COMPANY DIAGRAM</small>
      <h2>How {name} operates</h2>
      <p>See where demand enters, which department owns the next step, and how each Flow becomes real Work.</p>
    </header>
    <div className="ecosystem-network" ref={mapRef}>
    <svg className="ecosystem-network-routes" aria-hidden="true">
      {routes.map(link => {
        const highlighted = Boolean(selectedId) && (link.from === selectedId || link.to === selectedId);
        return <g key={link.id} data-route={link.id} className={highlighted ? 'is-highlighted' : 'is-muted'}>
          <path d={link.path}/>
          {highlighted && <circle r="3"><animateMotion dur="3.4s" begin={link.delay} repeatCount="indefinite" path={link.path}/></circle>}
        </g>;
      })}
    </svg>
    <div className="ecosystem-outer ecosystem-outer--top">{companyPartners.slice(0, 3).map(partner)}</div>
    <div className="ecosystem-connection-gutter" aria-hidden="true" />
    <section className="ecosystem-boundary" aria-label="Departments inside your company">
      <header>
        <span className="ecosystem-icon"><Building2 size={16}/></span>
        <div><strong>Inside {name}</strong><small>Live operating map · select a department to inspect its responsibility and activity.</small></div>
        <em>{sortedAreas.length} departments</em>
      </header>
      <div className="ecosystem-areas ecosystem-flow-map">
        {sortedAreas.map(renderArea)}
      </div>
    </section>
    <div className="ecosystem-connection-gutter" aria-hidden="true" />
    <div className="ecosystem-outer ecosystem-outer--bottom">{companyPartners.slice(3).map((item, index) => partner(item, index + 3))}</div>
    </div>
    <p className="ecosystem-route-caption" role="status">{selectedPartner ? `${selectedPartner.title} → ${areas.find(area => area.id === selectedPartner.area)?.title || selectedPartner.area} · ${selectedPartner.description}` : focusArea ? `Showing information moving through ${areas.find(area => area.id === focusArea)?.title || 'this department'}.` : 'Select a card to follow its information flow.'}</p>
    <footer><strong>One operating path</strong><span>Company</span><i>→</i><span>Department</span><i>→</i><span>Flow</span><i>→</i><span>Work · Human or AI</span></footer>
  </section>;
}
