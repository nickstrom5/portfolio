/** 02 · Reorder supplies: a low count becomes one purchase order and one vendor email, never two. */
import type { Automation, Ctx } from '@/lib/airtable/types';
import { fx } from '@/lib/airtable/engine';

const T = (c: Ctx) => c.trigger!;
const po = (c: Ctx) => c.record('Purchase orders', c.out('create-po').record as string);

export const reorder: Automation = {
  id: 'reorder',
  number: '02',
  name: 'Reorder supplies',
  kicker: 'Low count → PO and vendor email',
  tagline: 'The count that crosses the reorder point raises a purchase order and emails the vendor. An item already on order is left alone.',
  problem: 'Supplies were reordered when someone noticed the shelf was empty, usually mid-week with three trucks going out. Twice the same order was placed by two people, and gel ran out the day before a big lighting job.',
  solution: 'The crew count supplies twice a week in the Warehouse interface. When an item’s count drops to its reorder point and nothing is on order for it, the automation creates a purchase order for the standard quantity and emails it to the item’s vendor. If the count hit zero, the warehouse Slack channel hears about it too.',
  trigger: {
    type: 'When a record matches conditions',
    table: 'Supplies',
    summary: 'Fires when a supply starts to match: at or below its reorder point with no open purchase order. The new order makes it stop matching, so it cannot fire twice.',
    params: [
      { k: 'Table', v: 'Supplies' },
      { k: 'Conditions', v: 'Below reorder point = 1 · and Open POs = 0' },
    ],
    test: (g) => g('Below reorder point') === 1 && g('Open POs') === 0,
  },
  steps: [
    {
      kind: 'action',
      id: 'create-po',
      type: 'Create record',
      title: 'Raise the purchase order',
      summary: 'Linked to the supply, so its Open POs count goes to 1 at once.',
      params: [
        { k: 'Table', v: 'Purchase orders' },
        { k: 'Supply', v: '{Trigger › Airtable record ID}' },
        { k: 'Qty', v: '{Trigger › Reorder qty}' },
        { k: 'Status', v: 'Ordered' },
      ],
      run: (c) => ({ create: [{ table: 'Purchase orders', fields: { Supply: [T(c).id], Qty: T(c).get('Reorder qty'), Status: 'Ordered' } }] }),
    },
    {
      kind: 'action',
      id: 'po-email',
      type: 'Send email',
      title: 'Email the order to the vendor',
      summary: 'Quotes the PO number and total from the new record’s own fields.',
      params: [
        { k: 'To', v: '{Trigger › Vendor email}' },
        { k: 'CC', v: 'jordan@kestrelgrip.example' },
        { k: 'From name', v: 'Kestrel Grip & Lighting' },
        { k: 'Subject', v: '{Create record › PO}: {Trigger › Reorder qty} × {Trigger › Item}' },
      ],
      run: (c) => {
        const p = po(c);
        return {
          messages: [
            {
              channel: 'email',
              to: fx.str(T(c).get('Vendor email')),
              subject: `${p.name}: ${T(c).text('Reorder qty')} × ${T(c).text('Item')}`,
              body: `Hello,\n\nPlease supply:\n\n${T(c).text('Reorder qty')} × ${T(c).text('Item')} at ${p.text('Unit cost')} each\nTotal: ${p.text('Total')}\nPurchase order: ${p.name}\n\nDeliver to Kestrel Grip & Lighting, dock door 2, weekdays 8 AM to 5 PM. Please reply with a delivery date.\n\nThanks,\nJordan Price`,
            },
          ],
        };
      },
    },
    {
      kind: 'if',
      id: 'g-zero',
      branches: [
        {
          name: 'Out of stock',
          when: 'Trigger › On hand = 0',
          test: (c) => fx.num(T(c).get('On hand')) === 0,
          steps: [
            {
              kind: 'action',
              id: 'slack-zero',
              type: 'Send a Slack message',
              title: 'Tell the warehouse it is gone',
              summary: 'Only when the shelf is actually empty.',
              params: [
                { k: 'Channel', v: '#warehouse' },
                { k: 'Message', v: 'Out of {Trigger › Item}. {Create record › PO} is with the vendor.' },
              ],
              run: (c) => ({ messages: [{ channel: 'slack', to: '#warehouse', body: `Out of ${T(c).text('Item')}. ${po(c).name} for ${T(c).text('Reorder qty')} is with ${T(c).text('Vendor')}; check with Andre before promising any on a job.` }] }),
            },
          ],
        },
      ]
    },
  ],
  notify: 'Jordan Price',
  scenarios: [
    {
      id: 'gaff',
      label: 'Gaffer tape drops below its point',
      summary: 'Monday’s count: 14 rolls down to 9. One PO for 48, one email.',
      start: 465,
      setup: { by: 'Kim enters Monday’s count in Count supplies', update: [{ table: 'Supplies', id: 'recSupGaff', fields: { 'On hand': 9 } }] },
      record: 'recSupGaff',
      expect: { status: 'success', visits: ['create-po', 'po-email', 'g-zero:none'], skips: ['slack-zero'], emails: 1 },
    },
    {
      id: 'batteries',
      label: 'The last V-mount battery goes out',
      summary: 'Thursday’s count is zero: the order, and a Slack warning.',
      start: 3 * 1440 + 470,
      setup: { by: 'Kim enters Thursday’s count in Count supplies', update: [{ table: 'Supplies', id: 'recSupBatt', fields: { 'On hand': 0 } }] },
      record: 'recSupBatt',
      expect: { status: 'success', visits: ['create-po', 'po-email', 'g-zero:0', 'slack-zero'], emails: 1 },
    },
    {
      id: 'no-vendor',
      label: 'An item with no vendor',
      summary: 'Sandbags have no vendor linked: the PO is made, the email has nowhere to go, and the run fails.',
      start: 3 * 1440 + 475,
      setup: { by: 'Kim enters Thursday’s count in Count supplies', update: [{ table: 'Supplies', id: 'recSupSand', fields: { 'On hand': 18 } }] },
      record: 'recSupSand',
      failures: { 'po-email': 'The “To” field is empty: this supply has no vendor linked, so Vendor email has no value.' },
      expect: { status: 'failed', visits: ['create-po'], skips: ['po-email', 'slack-zero'], emails: 0 },
    },
  ],
  fields: [
    { table: 'Supplies', field: 'Below reorder point', use: 'Formula that compares two fields, since trigger conditions compare a field with a fixed value.' },
    { table: 'Supplies', field: 'Open POs', use: 'Count of linked purchase orders with Status Ordered; part of the conditions.' },
    { table: 'Supplies', field: 'Vendor email', use: 'Lookup into the synced Vendors table.' },
    { table: 'Purchase orders', field: 'PO, Unit cost, Total', use: 'Computed on the new record and quoted in the email.' },
  ],
  build: [
    { title: 'The formula does the comparing', body: 'Trigger conditions compare a field with a value you type, so “On hand ≤ Reorder point” lives in a formula field that returns 1 or 0, and the trigger checks for 1.' },
    { title: 'Open POs stops the repeat', body: 'Creating the purchase order links it to the supply, its Open POs count becomes 1, and the record stops matching. A recount on Thursday that is still low cannot order again. When the order is marked Received and the count is updated, the item can match again next time.' },
    { title: 'Numbers come from the new record', body: 'The email quotes the PO number, unit cost and total from Create record’s output, which includes the new record’s formula and rollup fields. The email and the record can never disagree.' },
    { title: 'Vendor details stay with finance', body: 'Vendor email is a lookup into the synced Vendors table. Finance owns the vendor list; this base never stores a second copy of an address.' },
  ],
  edgeCases: [
    { title: 'No vendor linked', body: 'The PO is created, then the email fails with an empty To, and the run shows Failed. Because the PO exists, Open POs is 1 and the item will not trigger again; Jordan gets the failure email and places that order by hand.' },
    { title: 'The count is fixed after a typo', body: 'If Kim types 0 instead of 9, the order is already placed. Fixing the count does not undo it; Jordan cancels the PO with the vendor and sets its Status by hand.' },
    { title: 'Already on order', body: 'Gel is below its point but has an open PO, so it does not match. The Reorder view groups it under Open POs = 1 so nobody orders it again by hand.' },
    { title: 'A vendor changes address in finance', body: 'The sync brings the new address in within minutes, and the lookup reads it on the next run.' },
  ],
  qa: [
    'A count at or below the reorder point creates exactly one PO for the reorder quantity.',
    'A second low count with the PO still open creates nothing.',
    'The email shows the same PO number and total as the record.',
    'A zero count also posts to #warehouse.',
    'An item with no vendor fails at the email, with the PO already created.',
  ],
  features: ['When a record matches conditions', 'Create record', 'Send email', 'Conditional groups', 'Send a Slack message', 'Formula as a trigger condition', 'Count field with conditions', 'Rollup', 'Synced table', 'Autonumber'],
};
