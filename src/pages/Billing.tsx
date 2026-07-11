import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DollarSign, AlertCircle, Shield, ExternalLink, RotateCcw, XCircle, CheckCircle, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  getMyMembership,
  startMembership,
  resendInvoiceLink,
  cancelMembership,
  formatAmount,
  getMembershipStatusLabel,
  type MyMembershipResponse,
  type RenewalInvoice,
} from "@/features/billing/billingService";

export default function Billing() {
  const navigate = useNavigate();
  const [data, setData] = useState<MyMembershipResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  async function loadData() {
    try {
      setError(null);
      const result = await getMyMembership();
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load billing data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, []);

  async function handleStartRenewal(membershipId: string) {
    setActionLoading("renew");
    try {
      const { payment_link } = await startMembership(membershipId);
      window.open(payment_link, "_blank", "noopener,noreferrer");
      await loadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create payment link");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleResendLink(invoiceId: string) {
    setActionLoading("resend-" + invoiceId);
    try {
      const { payment_link } = await resendInvoiceLink(invoiceId);
      window.open(payment_link, "_blank", "noopener,noreferrer");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to resend link");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleCancel(membershipId: string) {
    if (!window.confirm("Are you sure you want to cancel your membership? Your access will remain active until the current period ends.")) return;
    setActionLoading("cancel");
    try {
      await cancelMembership(membershipId);
      await loadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to cancel");
    } finally {
      setActionLoading(null);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] text-[#e4e4e7]">
        <div className="max-w-4xl mx-auto px-4 py-8 space-y-4">
          <div className="h-6 w-24 bg-[#12121a] rounded animate-pulse" />
          <div className="h-8 w-48 bg-[#12121a] rounded animate-pulse" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-[#12121a] border border-[#1e1e2e] rounded-lg animate-pulse" />
            ))}
          </div>
          <div className="h-40 bg-[#12121a] border border-[#1e1e2e] rounded-lg animate-pulse" />
        </div>
      </div>
    );
  }

  const membership = data?.membership;
  const invoices = data?.invoices || [];

  const unpaidInvoices = invoices.filter((i) => i.status === "pending");
  const latestPendingInvoice = unpaidInvoices[0];

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-[#e4e4e7]">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-[#71717a] hover:text-[#e4e4e7] mb-6 transition-colors text-sm">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white mb-1">Billing</h1>
            <p className="text-[#71717a] text-sm">Manage your membership and payment history</p>
          </div>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-6 bg-red-500/10 border-red-500/20 text-red-400">
            <AlertCircle className="w-4 h-4" />
            <AlertTitle>We couldn't load your billing details</AlertTitle>
            <AlertDescription className="space-y-3">
              <p className="text-red-300/90">{error}</p>
              <div className="flex flex-wrap gap-2 pt-1">
                <Button
                  size="sm"
                  onClick={() => { setLoading(true); loadData(); }}
                  className="bg-red-500/20 text-red-200 hover:bg-red-500/30 border border-red-500/30"
                >
                  <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> Retry
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => navigate("/upgrade")}
                  className="border-[#1e1e2e] text-[#e4e4e7] hover:bg-[#1e1e2e]"
                >
                  View plans
                </Button>
                <a
                  href="mailto:support@luminaai.study?subject=Billing%20page%20error"
                  className="inline-flex items-center px-3 py-1.5 rounded-md text-xs border border-[#1e1e2e] text-[#a1a1aa] hover:text-white hover:bg-[#1e1e2e]"
                >
                  Contact support
                </a>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {!membership && !error && (
          <Card className="bg-[#12121a] border-[#1e1e2e]">
            <CardHeader>
              <CardTitle className="text-white text-lg">No Active Membership</CardTitle>
              <CardDescription className="text-[#71717a]">You don't have a paid membership yet. Visit the Upgrade page to get started.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => navigate("/upgrade")} className="bg-[#a78bfa] text-[#0a0a0f] hover:bg-[#c4b5fd]">
                View Plans
              </Button>
            </CardContent>
          </Card>
        )}

        {membership && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
              <Card className="bg-[#12121a] border-[#1e1e2e]">
                <CardHeader className="flex flex-row items-center gap-3 p-4">
                  <Badge variant={getMembershipStatusLabel(membership.status).variant} className="capitalize">{membership.status}</Badge>
                  <span className="text-sm text-[#71717a]">Status</span>
                </CardHeader>
              </Card>

              <Card className="bg-[#12121a] border-[#1e1e2e]">
                <CardHeader className="p-4">
                  <div className="flex items-center gap-2 text-sm text-[#71717a] mb-1">Plan</div>
                  <div className="text-lg font-semibold text-white">{membership.billing_plans?.name || "Unknown Plan"}</div>
                </CardHeader>
              </Card>

              <Card className="bg-[#12121a] border-[#1e1e2e]">
                <CardHeader className="p-4">
                  <div className="flex items-center gap-2 text-sm text-[#71717a] mb-1">Next Invoice</div>
                  <div className="text-lg font-semibold text-white">
                    {membership.next_invoice_at ? new Date(membership.next_invoice_at).toLocaleDateString("en-IN") : "—"}
                  </div>
                </CardHeader>
              </Card>

              <Card className="bg-[#12121a] border-[#1e1e2e]">
                <CardHeader className="p-4">
                  <div className="flex items-center gap-2 text-sm text-[#71717a] mb-1">Period End</div>
                  <div className="text-lg font-semibold text-white">
                    {membership.current_period_end ? new Date(membership.current_period_end).toLocaleDateString("en-IN") : "—"}
                  </div>
                </CardHeader>
              </Card>
            </div>

            {latestPendingInvoice && membership.status !== "cancelled" && (
              <Card className="bg-[#1a1a2e] border-[#a78bfa] border mb-6">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="p-2 bg-[#a78bfa]/10 rounded-lg">
                      <DollarSign className="w-5 h-5 text-[#a78bfa]" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-white font-semibold mb-1">Payment Due</h3>
                      <p className="text-sm text-[#71717a] mb-4">
                        {formatAmount(latestPendingInvoice.amount_minor, latestPendingInvoice.currency)} renewal payment for{" "}
                        {membership.billing_plans?.name || "your plan"}. Your access will be paused if not paid within the grace period.
                      </p>
                      <div className="flex gap-3">
                        <Button
                          onClick={() => { if (latestPendingInvoice.dodo_payment_link) window.open(latestPendingInvoice.dodo_payment_link, "_blank", "noopener,noreferrer"); }}
                          className="bg-[#a78bfa] text-[#0a0a0f] hover:bg-[#c4b5fd]"
                          disabled={!latestPendingInvoice.dodo_payment_link}
                        >
                          <ExternalLink className="w-4 h-4 mr-2" /> Pay Now
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => handleResendLink(latestPendingInvoice.id)}
                          disabled={actionLoading === "resend-" + latestPendingInvoice.id}
                          className="border-[#1e1e2e] text-[#e4e4e7] hover:bg-[#1e1e2e]"
                        >
                          <RotateCcw className="w-4 h-4 mr-2" /> Resend Link
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {membership.status !== "cancelled" && !latestPendingInvoice && (
              <Card className="bg-[#12121a] border-[#1e1e2e] mb-6">
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-[#4ade80]/10 rounded-lg">
                      <CheckCircle className="w-5 h-5 text-[#4ade80]" />
                    </div>
                    <div className="flex-1">
                      <p className="text-white text-sm">All payments are up to date. Your next invoice will be generated on{" "}
                        <span className="font-semibold">{membership.next_invoice_at ? new Date(membership.next_invoice_at).toLocaleDateString("en-IN") : "—"}</span>.</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {membership.status === "paused" && !latestPendingInvoice && (
              <Card className="bg-[#1a1a2e] border-[#f59e0b] border mb-6">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="p-2 bg-[#f59e0b]/10 rounded-lg">
                      <AlertCircle className="w-5 h-5 text-[#f59e0b]" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-white font-semibold mb-1">Membership Paused</h3>
                      <p className="text-sm text-[#71717a] mb-4">Your access has been paused due to non-payment. Reactivate by making a renewal payment.</p>
                      <Button
                        onClick={() => handleStartRenewal(membership.id)}
                        disabled={actionLoading === "renew"}
                        className="bg-[#a78bfa] text-[#0a0a0f] hover:bg-[#c4b5fd]"
                      >
                        <RotateCcw className="w-4 h-4 mr-2" /> Renew Now
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {membership && membership.status !== "cancelled" && (
          <Card className="bg-[#12121a] border-[#1e1e2e] mb-6">
            <CardContent className="p-4">
              <Button
                variant="outline"
                onClick={() => handleCancel(membership.id)}
                disabled={actionLoading === "cancel"}
                className="text-[#f87171] border-[#f87171]/30 hover:bg-[#f87171]/10"
              >
                <XCircle className="w-4 h-4 mr-2" /> Cancel Membership
              </Button>
            </CardContent>
          </Card>
        )}

        <Card className="bg-[#12121a] border-[#1e1e2e]">
          <CardHeader>
            <CardTitle className="text-white text-lg">Invoice History</CardTitle>
            <CardDescription className="text-[#71717a]">All renewal payments for your membership</CardDescription>
          </CardHeader>
          <CardContent>
            {invoices.length === 0 ? (
              <p className="text-[#71717a] text-sm text-center py-8">No invoices yet</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-[#1e1e2e]">
                    <TableHead className="text-[#71717a]">Date</TableHead>
                    <TableHead className="text-[#71717a]">Amount</TableHead>
                    <TableHead className="text-[#71717a]">Status</TableHead>
                    <TableHead className="text-[#71717a] text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((inv) => (
                    <TableRow key={inv.id} className="border-[#1e1e2e]">
                      <TableCell className="text-[#e4e4e7]">{new Date(inv.created_at).toLocaleDateString("en-IN")}</TableCell>
                      <TableCell className="text-[#e4e4e7]">{formatAmount(inv.amount_minor, inv.currency)}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            inv.status === "paid" ? "success" :
                            inv.status === "pending" ? "secondary" :
                            inv.status === "failed" ? "destructive" : "outline"
                          }
                          className="capitalize"
                        >
                          {inv.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {inv.status === "pending" && inv.dodo_payment_link && (
                          <div className="flex gap-2 justify-end">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => window.open(inv.dodo_payment_link!, "_blank", "noopener,noreferrer")}
                              className="text-[#a78bfa] hover:text-[#c4b5fd]"
                            >
                              Pay
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleResendLink(inv.id)}
                              disabled={actionLoading === "resend-" + inv.id}
                              className="text-[#71717a] hover:text-[#e4e4e7]"
                            >
                              Resend
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <div className="mt-6 p-4 rounded-lg bg-[#12121a] border border-[#1e1e2e]">
          <div className="flex items-start gap-3">
            <Shield className="w-5 h-5 text-[#71717a] mt-0.5" />
            <div className="text-xs text-[#71717a] leading-relaxed">
              <p className="font-medium text-[#a1a1aa] mb-1">Secure Billing</p>
              <p>Payments are processed securely through Dodo Payments. We never store your card details. Every payment is a one-time transaction — no automatic renewals or stored payment methods.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
