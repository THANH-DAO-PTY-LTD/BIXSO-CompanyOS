import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Link, Route, Routes } from 'react-router-dom';
import CompanyOSRuntime from './design/CompanyOSRuntime';
import StudioEditorPage from './pages/studio/StudioEditorPage';
import { read, write } from './local';
import './host.css';

function Workspace() {
  const [data, setData] = useState(read);
  const [dialog, setDialog] = useState(null);

  function studioPath(context = {}) {
    const params = new URLSearchParams({ type: 'flow' });
    if (context.id) params.set('id', context.id);
    if (context.companyArea) params.set('companyArea', context.companyArea);
    return `/workspace/create/editor?${params}`;
  }

  function recordHandover(event) {
    event.preventDefault();
    const note = new FormData(event.currentTarget).get('result').trim();
    if (!note) return;
    write(state => {
      const work = state.work.find(row => row.id === dialog.id);
      work.handover = note;
      work.status = 'Handed over';
    });
    setData(read());
    setDialog(null);
  }

  function createWork(event) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    const title = fields.get('title').trim();
    const customer = fields.get('customer').trim();
    if (!title || !customer) return;
    write(state => {
      const flow = state.flows.find(row => row.id === fields.get('flowId') && row.state === 'active');
      if (!flow?.nodes.length) return;
      const id = crypto.randomUUID();
      const incoming = new Set(flow.edges.map(edge => edge.to));
      const start = flow.nodes.find(node => !incoming.has(node.id)) || flow.nodes[0];
      state.work.push({ id, requestId: id, flowId: flow.id, flowRevision: flow.revision, nodeId: start.id,
        customer, title, status: 'Assigned', mapping: 'recorded' });
    });
    setData(read());
    setDialog(null);
  }

  return <div className="extract-host">
    <div className="extract-toolbar">
      <strong>Local preview · fictional sample data</strong>
      <Link to={studioPath()}>Create Studio</Link>
      <button onClick={() => setDialog({ create: true, title: 'New local Work' })}>New Work</button>
      {data.flows.map(flow => <Link key={flow.id} to={studioPath(flow)}>Edit {flow.name}</Link>)}
    </div>
    <div className="extract-surface"><CompanyOSRuntime
      flows={data.flows} businessName={data.company} workItems={data.work}
      companyTemplateKey="general-service-company" onStudio={context => window.location.assign(studioPath(context))}
      onSetupTemplate={() => {}} onTask={(_flow, _node, item) => setDialog(item)}
      onModule={() => setDialog({ notice: 'Company settings are outside this extract.' })}
      onLibrary={() => setDialog({ notice: 'The marketplace library is outside this extract.' })}
      onHire={() => setDialog({ notice: 'Agent hiring and execution are outside this extract.' })}
    /></div>
    {dialog && <dialog className="extract-dialog" ref={node => { if (node && !node.open) node.showModal(); }} onCancel={() => setDialog(null)}>
      <h2>{dialog.title || 'Local extract'}</h2>
      {dialog.create ? <form onSubmit={createWork}>
        <label>Flow<select name="flowId" required>{data.flows.filter(flow => flow.state === 'active').map(flow =>
          <option key={flow.id} value={flow.id}>{flow.name}</option>)}</select></label>
        <label>Client alias<input name="customer" required maxLength={200}/></label>
        <label>Work title<input name="title" required maxLength={200}/></label>
        <button>Save local Work</button>
      </form> : dialog.notice ? <p>{dialog.notice}</p> : <>
        <p>{dialog.customer} · {dialog.status}</p>
        {dialog.handover ? <p>{dialog.handover}</p> : <form onSubmit={recordHandover}>
          <label>Handover result <textarea name="result" required maxLength={2000}/></label>
          <button>Save local handover</button>
        </form>}
      </>}
      <button onClick={() => setDialog(null)}>Close</button>
    </dialog>}
  </div>;
}

createRoot(document.querySelector('#root')).render(<BrowserRouter><Routes>
  <Route path="/workspace/create/editor" element={<StudioEditorPage providerMode/>}/>
  <Route path="*" element={<Workspace/>}/>
</Routes></BrowserRouter>);
