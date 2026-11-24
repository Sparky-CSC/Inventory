import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Fingerprint, Loader2, CheckCircle, AlertTriangle, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BorrowedItem, InventoryItem } from '@/api/entities';
import { findDuplicates, generateItemUid } from '@/lib/itemCodes';
import { updateBorrowedItem } from '@/lib/borrowed';
import { createPageUrl } from '@/utils';

/**
 * Finds inventory items with no UID or a UID another item also uses, and
 * borrowed items with no or a repeated tag number, and fixes them. The oldest
 * item keeps a shared code (its label is the one most likely already printed).
 */
export default function IdCheck() {
  const navigate = useNavigate();
  const [report, setReport] = useState(null);
  const [busy, setBusy] = useState(false);
  const [fixed, setFixed] = useState([]);

  const check = async () => {
    setBusy(true);
    setFixed([]);
    try {
      const [items, loans] = await Promise.all([InventoryItem.list('created_date'), BorrowedItem.list('created_date')]);
      const missing = items.filter((i) => !String(i.uid || '').trim());
      const dupGroups = [...findDuplicates(items, 'uid').values()];
      const toRenumber = dupGroups.flatMap((group) => group.slice(1)); // keep the oldest
      const loansMissing = loans.filter((l) => !l.tag_number);
      const loanDups = [...findDuplicates(loans, 'tag_number').values()].flatMap((g) => g.slice(1));
      setReport({ total: items.length, missing, dupGroups, toRenumber, loansMissing, loanDups });
    } finally {
      setBusy(false);
    }
  };

  const fix = async () => {
    setBusy(true);
    const changed = [];
    try {
      for (const item of [...report.missing, ...report.toRenumber]) {
        const uid = generateItemUid(item.categories?.[0] || item.category);
        await InventoryItem.update(item.id, { uid }, {
          activity: { action: 'id_assigned', summary: item.uid ? `UID ${item.uid} was shared with another item; new UID ${uid}` : `UID ${uid} assigned` },
        });
        changed.push(item.id);
      }
      for (const loan of [...report.loansMissing, ...report.loanDups]) {
        await updateBorrowedItem(loan.id, { tag_number: null });
      }
      setFixed(changed);
      await check();
      setFixed(changed);
    } finally {
      setBusy(false);
    }
  };

  const problems = report
    ? report.missing.length + report.toRenumber.length + report.loansMissing.length + report.loanDups.length
    : 0;

  return (
    <Card className="bg-base-200/50 backdrop-blur-sm shadow-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Fingerprint className="w-5 h-5 text-primary" /> Check item IDs</CardTitle>
        <CardDescription>
          Every item needs one UID that no other item uses, so each printed label opens the right item. Borrowed items need their own tag numbers.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <Button variant="outline" onClick={check} disabled={busy}>
          {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null} Check now
        </Button>
        {report && problems === 0 && (
          <p className="text-success flex items-center gap-2"><CheckCircle className="w-4 h-4" /> All {report.total} items have their own UID, and every borrowed item has its own tag number.</p>
        )}
        {report && problems > 0 && (
          <div className="space-y-2">
            <ul className="list-disc pl-5">
              {report.missing.length > 0 && <li>{report.missing.length} item{report.missing.length === 1 ? ' has' : 's have'} no UID.</li>}
              {report.dupGroups.map((group) => (
                <li key={group[0].uid}>
                  UID <span className="font-mono">{group[0].uid}</span> is used by {group.length} items: {group.map((i) => i.name).join(', ')}. “{group[0].name}” (the oldest) keeps it.
                </li>
              ))}
              {report.loansMissing.length > 0 && <li>{report.loansMissing.length} borrowed item{report.loansMissing.length === 1 ? ' has' : 's have'} no tag number.</li>}
              {report.loanDups.length > 0 && <li>{report.loanDups.length} borrowed item{report.loanDups.length === 1 ? ' shares' : 's share'} a tag number with another.</li>}
            </ul>
            <Button onClick={fix} disabled={busy}>
              <AlertTriangle className="w-4 h-4 mr-2" /> Give these their own IDs
            </Button>
          </div>
        )}
        {fixed.length > 0 && (
          <div className="rounded-lg border border-warning/50 bg-warning/10 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <span>{fixed.length} item{fixed.length === 1 ? '' : 's'} got a new UID. Print new labels for them so the old ones are not scanned.</span>
            <Button size="sm" variant="outline" onClick={() => navigate(createPageUrl(`PrintHangTags?ids=${fixed.join(',')}`))}>
              <Printer className="w-4 h-4 mr-2" /> Print new labels
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
