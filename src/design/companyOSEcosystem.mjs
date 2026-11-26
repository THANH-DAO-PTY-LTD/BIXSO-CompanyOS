export const companyAreas = [
  { id: 'care', title: 'Customer care', description: 'Receive enquiries, understand needs and keep customers informed.', match: /care|customer records|enquir|intake/i },
  { id: 'delivery', title: 'Delivery', description: 'Plan the job, coordinate resources and deliver the agreed result.', match: /deliver|fit.out|job|visit|repair|project/i },
  { id: 'finance', title: 'Finance', description: 'Prepare quotes, issue invoices and follow up on payments.', match: /invoice|payment|finance|billing|quote/i },
  { id: 'growth', title: 'Customer growth', description: 'Show your services, find customers and build repeat business.', match: /find new|market|listing|growth|referral|advert/i },
  { id: 'assurance', title: 'Business assurance', description: 'Keep agreements, records, insurance and checks in order.', match: /compliance|insurance|trust|contract|assurance/i },
];
export const companyPartners = [
  { id: 'customers', title: 'Customers', description: 'Requests come in; updates and service results go back.', area: 'care' },
  { id: 'platform', title: 'Company OS', description: 'Your services, customer discovery and AI support connect here.', area: 'growth' },
  { id: 'suppliers', title: 'Suppliers', description: 'Materials and resources support service delivery.', area: 'delivery' },
  { id: 'partners', title: 'Partners & community', description: 'Referrals and specialist support connect to your business.', area: 'growth' },
  { id: 'authorities', title: 'Authorities & insurance', description: 'Requirements and evidence connect to business assurance.', area: 'assurance' },
  { id: 'accountant', title: 'Accountant', description: 'Invoices and financial records support reconciliation.', area: 'finance' },
];
export function groupCompanyFlows(flows) {
  const groups = companyAreas.map(area => ({ ...area, flows: [] }));
  const other = { id: 'operations', title: 'Other operations', description: 'Saved routes awaiting a business-area assignment.', flows: [] };
  for (const flow of flows) {
    const explicit = groups.find(area => area.id === flow.companyArea);
    // Names are presentation, never ownership. Legacy routes remain visible
    // until their department is explicitly recorded.
    (explicit || other).flows.push(flow);
  }
  return other.flows.length ? [...groups, other] : groups;
}
