"use client";

import type { Session } from "@supabase/supabase-js";
import {
  ArrowLeft,
  ChevronRight,
  CirclePlus,
  ClipboardList,
  IndianRupee,
  Eye,
  EyeOff,
  Languages,
  LayoutDashboard,
  LogOut,
  MessageCircle,
  Pencil,
  Phone,
  Plus,
  Search,
  Settings,
  Tractor,
  Users,
  WalletCards,
  X,
} from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { IconButton } from "@/components/icon-button";
import {
  friendlyError,
  LanguageProvider,
  useLanguage,
  type MessageKey,
} from "@/components/language-provider";
import { getSupabase, hasSupabaseConfig } from "@/lib/supabase";
import type { ChargeBasis, Customer, Payment, WorkRecord, WorkType } from "@/lib/types";

type View = "dashboard" | "customers" | "settings";
type Notice = { tone: "success" | "error"; text: string } | null;
type ContactPickerContact = { name?: string[]; tel?: string[] };
declare global {
  interface Navigator {
    contacts?: {
      select: (
        properties: ("name" | "tel")[],
        options: { multiple: boolean },
      ) => Promise<ContactPickerContact[]>;
    };
  }
}

const subscribeToContactPickerSupport = () => () => undefined;
const getContactPickerSupport = () => typeof navigator !== "undefined" && typeof navigator.contacts?.select === "function";
const getServerContactPickerSupport = () => false;

const DEFAULT_WORK_TYPES = [
  "Ploughing / దుక్కి",
  "Cultivator / కల్టివేటర్",
  "Rotavator / రోటావేటర్",
  "Transport / రవాణా",
];

const today = () => new Date().toLocaleDateString("en-CA");
const money = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
const paidFor = (work: WorkRecord) =>
  (work.payments ?? []).reduce((sum, payment) => sum + Number(payment.amount), 0);
const balanceFor = (work: WorkRecord) => Math.max(0, Number(work.total) - paidFor(work));
const displayWorkType = (name: string, language: "te" | "en") => {
  if (language !== "te") return name;
  const parts = name.split("/").map((part) => part.trim());
  if (parts.length === 2 && /[A-Za-z]/.test(parts[0]) && /[\u0C00-\u0C7F]/.test(parts[1])) {
    return `${parts[1]} / ${parts[0]}`;
  }
  return name;
};
const paymentStatus = (balance: number) => balance > 0
  ? `చెల్లించాల్సిన బాకీ: ${money(balance)}\n\nPhonePe / Google Pay ద్వారా\n9704200894 నంబర్‌కు చెల్లించండి.\nచెల్లించే ముందు పేరు సరిచూసుకోండి.`
  : "బాకీ లేదు — మొత్తం చెల్లించారు.";

function FieldLabel({ label }: { label: string }) {
  return <span className="field-label"><b>{label}</b></span>;
}

function LanguageToggle({ compact = false }: { compact?: boolean }) {
  const { language, setLanguage, t } = useLanguage();
  return (
    <button
      type="button"
      className={`language-toggle${compact ? " compact" : ""}`}
      onClick={() => setLanguage(language === "te" ? "en" : "te")}
      aria-label={t("languageLabel")}
      title={t("languageLabel")}
    >
      <Languages size={20} />
      <span>{t("language")}</span>
    </button>
  );
}

function EmptyState({ icon: Icon, title, text }: {
  icon: typeof ClipboardList;
  title: string;
  text: string;
}) {
  return (
    <div className="empty-state">
      <Icon size={36} />
      <strong>{title}</strong>
      <p>{text}</p>
    </div>
  );
}

export default function TractorApp() {
  return <LanguageProvider><TractorAppContent /></LanguageProvider>;
}

function TractorAppContent() {
  const { t } = useLanguage();
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(hasSupabaseConfig);
  const [view, setView] = useState<View>("dashboard");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [workTypes, setWorkTypes] = useState<WorkType[]>([]);
  const [works, setWorks] = useState<WorkRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [workOpen, setWorkOpen] = useState(false);
  const [editingWork, setEditingWork] = useState<WorkRecord | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [shareWork, setShareWork] = useState<WorkRecord | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    const supabase = getSupabase();
    const [customerResult, typeResult, workResult] = await Promise.all([
      supabase.from("customers").select("*").order("name"),
      supabase.from("work_types").select("*").order("name"),
      supabase
        .from("work_records")
        .select("*, customer:customers(*), payments(*)")
        .order("work_date", { ascending: false }),
    ]);
    const error = customerResult.error ?? typeResult.error ?? workResult.error;

    if (error) {
      setNotice({ tone: "error", text: friendlyError(error.message, t) });
    } else {
      let availableWorkTypes = (typeResult.data ?? []) as WorkType[];
      if (availableWorkTypes.length === 0) {
        const { data: userData } = await supabase.auth.getUser();
        if (userData.user) {
          const userId = userData.user.id;
          const { data: seededTypes, error: seedError } = await supabase
            .from("work_types")
            .insert(DEFAULT_WORK_TYPES.map((name) => ({ user_id: userId, name })))
            .select();
          if (seedError) {
            setNotice({ tone: "error", text: friendlyError(seedError.message, t) });
          } else {
            availableWorkTypes = (seededTypes ?? []) as WorkType[];
          }
        }
      }
      setCustomers((customerResult.data ?? []) as Customer[]);
      setWorkTypes(availableWorkTypes);
      setWorks((workResult.data ?? []) as unknown as WorkRecord[]);
    }
    setLoading(false);
  }, [t]);

  useEffect(() => {
    if (!hasSupabaseConfig) return;
    const supabase = getSupabase();
    let active = true;
    let initialCheckComplete = false;

    const { data } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!active || !initialCheckComplete || event === "INITIAL_SESSION") return;
      setSession(nextSession);
      setAuthLoading(false);
    });

    const checkExistingSession = async () => {
      let validSession: Session | null = null;
      try {
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        validSession = sessionError ? null : sessionData.session;

        if (validSession) {
          const { data: userData, error: userError } = await supabase.auth.getUser();
          if (userError || !userData.user) {
            validSession = null;
            await supabase.auth.signOut({ scope: "local" });
          }
        }
      } catch {
        validSession = null;
      }

      initialCheckComplete = true;
      if (active) {
        setSession(validSession);
        setAuthLoading(false);
      }
    };

    void checkExistingSession();
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session) return;
    const timer = window.setTimeout(() => void loadData(), 0);
    return () => window.clearTimeout(timer);
  }, [session, loadData]);

  const totals = useMemo(() => works.reduce((acc, work) => {
    acc.total += Number(work.total);
    acc.received += paidFor(work);
    return acc;
  }, { total: 0, received: 0 }), [works]);

  if (!hasSupabaseConfig) return <SetupRequired />;
  if (authLoading) return <div className="center-screen" role="status" aria-live="polite"><div className="spinner" /><p>{t("checkingSession")}</p></div>;
  if (!session) return <Login />;

  const openNewWork = () => {
    setEditingWork(null);
    setWorkOpen(true);
  };
  const openEditWork = (work: WorkRecord) => {
    setEditingWork(work);
    setWorkOpen(true);
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark"><Tractor size={25} /></span>
          <span><strong>{t("appName")}</strong><small>{t("appSubtitle")}</small></span>
        </div>
        {!selectedCustomer && (
          <nav className="desktop-nav" aria-label={t("appSubtitle")}>
            <button className={view === "dashboard" ? "active" : ""} onClick={() => setView("dashboard")}><LayoutDashboard size={20} /> {t("home")}</button>
            <button className={view === "customers" ? "active" : ""} onClick={() => setView("customers")}><Users size={20} /> {t("customers")}</button>
            <button className={view === "settings" ? "active" : ""} onClick={() => setView("settings")}><Settings size={20} /> {t("workTypes")}</button>
          </nav>
        )}
        <div className="topbar-actions">
          <LanguageToggle compact />
          <IconButton icon={LogOut} label={t("signOut")} onClick={() => void getSupabase().auth.signOut({ scope: "local" })} />
        </div>
      </header>

      {notice && (
        <button className={`notice ${notice.tone}`} onClick={() => setNotice(null)}>
          <span>{notice.text}</span><X size={19} />
        </button>
      )}

      <main className="main-content">
        {selectedCustomer ? (
          <CustomerDetail
            customer={selectedCustomer}
            works={works.filter((work) => work.customer_id === selectedCustomer.id)}
            onBack={() => setSelectedCustomer(null)}
            onRefresh={loadData}
            onEdit={openEditWork}
            onShare={setShareWork}
            setNotice={setNotice}
          />
        ) : view === "dashboard" ? (
          <Dashboard
            works={works}
            total={totals.total}
            received={totals.received}
            loading={loading}
            onAdd={openNewWork}
            onEdit={openEditWork}
            onShare={setShareWork}
          />
        ) : view === "customers" ? (
          <Customers customers={customers} works={works} onSelect={setSelectedCustomer} />
        ) : (
          <WorkTypeSettings workTypes={workTypes} onRefresh={loadData} setNotice={setNotice} />
        )}
      </main>

      {!selectedCustomer && (
        <button className="fab" onClick={openNewWork}>
          <Plus size={27} /><span>{t("addWork")}</span>
        </button>
      )}

      {!selectedCustomer && (
        <nav className="bottom-nav" aria-label={t("appSubtitle")}>
          <button className={view === "dashboard" ? "active" : ""} onClick={() => setView("dashboard")}>
            <LayoutDashboard /><span>{t("home")}</span>
          </button>
          <button className={view === "customers" ? "active" : ""} onClick={() => setView("customers")}>
            <Users /><span>{t("customers")}</span>
          </button>
          <button className={view === "settings" ? "active" : ""} onClick={() => setView("settings")}>
            <Settings /><span>{t("workTypes")}</span>
          </button>
        </nav>
      )}

      {workOpen && (
        <WorkModal
          customers={customers}
          workTypes={workTypes}
          work={editingWork}
          userId={session.user.id}
          onClose={() => setWorkOpen(false)}
          onSaved={(saved) => {
            setWorkOpen(false);
            setShareWork(saved);
            void loadData();
          }}
          setNotice={setNotice}
        />
      )}
      {shareWork && <ShareSheet work={shareWork} onClose={() => setShareWork(null)} />}
    </div>
  );
}

function SetupRequired() {
  const { t } = useLanguage();
  return (
    <div className="setup-screen">
      <div className="setup-toolbar"><LanguageToggle /></div>
      <div className="setup-icon"><Tractor size={38} /></div>
      <p className="eyebrow">{t("setupOnce")}</p>
      <h1>{t("setupTitle")}</h1>
      <p>{t("setupHelp")}</p>
      <pre>NEXT_PUBLIC_SUPABASE_URL=...{"\n"}NEXT_PUBLIC_SUPABASE_ANON_KEY=...</pre>
      <p className="muted">{t("setupDocs")}</p>
    </div>
  );
}

function Login() {
  const { t } = useLanguage();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    const { error: authError } = await getSupabase().auth.signInWithPassword({ email, password });
    if (authError) setError(friendlyError(authError.message, t));
    setBusy(false);
  };

  return (
    <main className="login-screen">
      <section className="login-panel">
        <div className="login-language"><LanguageToggle /></div>
        <div className="login-brand">
          <span className="brand-mark large"><Tractor size={34} /></span>
          <div><h1>{t("loginTitle")}</h1><p>{t("appSubtitle")}</p></div>
        </div>
        <form onSubmit={submit}>
          <label><FieldLabel label={t("email")} /><input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" /></label>
          <label>
            <FieldLabel label={t("password")} />
            <div className="password-input">
              <input type={passwordVisible ? "text" : "password"} required value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" />
              <button type="button" onClick={() => setPasswordVisible((visible) => !visible)} aria-label={passwordVisible ? t("hidePassword") : t("showPassword")} title={passwordVisible ? t("hidePassword") : t("showPassword")}>
                {passwordVisible ? <EyeOff size={21} /> : <Eye size={21} />}
              </button>
            </div>
          </label>
          {error && <p className="form-error">{error}</p>}
          <button className="primary-button" disabled={busy}>{busy ? t("signingIn") : t("signIn")}</button>
        </form>
        <p className="login-help">{t("privateRecords")}</p>
      </section>
    </main>
  );
}

function Dashboard({ works, total, received, loading, onAdd, onEdit, onShare }: {
  works: WorkRecord[];
  total: number;
  received: number;
  loading: boolean;
  onAdd: () => void;
  onEdit: (work: WorkRecord) => void;
  onShare: (work: WorkRecord) => void;
}) {
  const { t } = useLanguage();
  const recent = works.slice(0, 6);
  return (
    <>
      <section className="page-heading">
        <div><h1>{t("todayRecords")}</h1><p>{t("overviewHelp")}</p></div>
        <button className="desktop-add primary-button" onClick={onAdd}><Plus size={21} /> {t("addWork")}</button>
      </section>
      <section className="stats-grid">
        <article className="stat total"><span><IndianRupee /></span><p>{t("totalWork")}</p><strong>{money(total)}</strong></article>
        <article className="stat received"><span><WalletCards /></span><p>{t("received")}</p><strong>{money(received)}</strong></article>
        <article className="stat pending"><span><ClipboardList /></span><p>{t("pending")}</p><strong>{money(Math.max(0, total - received))}</strong></article>
      </section>
      <section className="section-block">
        <div className="section-title"><h2>{t("recentWork")}</h2><span>{t("recordCount", { count: works.length })}</span></div>
        {loading ? <div className="loading-line">{t("loading")}</div> : recent.length ? (
          <div className="record-list">{recent.map((work) => <WorkRow key={work.id} work={work} onEdit={() => onEdit(work)} onShare={() => onShare(work)} />)}</div>
        ) : <EmptyState icon={ClipboardList} title={t("noWork")} text={t("noWorkHelp")} />}
      </section>
    </>
  );
}

function WorkRow({ work, onEdit, onShare }: { work: WorkRecord; onEdit: () => void; onShare: () => void }) {
  const { language, t } = useLanguage();
  const balance = balanceFor(work);
  const received = paidFor(work);
  const workDate = new Date(`${work.work_date}T00:00:00`);
  const unit = work.charge_basis === "hour" ? t("hoursWorked") : t("acres");
  const status = balance === 0 ? "paid" : received > 0 ? "partial" : "due";
  const statusLabel = status === "paid" ? t("paid") : status === "partial" ? t("partiallyPaid") : t("paymentDue");
  const fullDate = workDate.toLocaleDateString(language === "te" ? "te-IN-u-nu-latn" : "en-IN", { day: "numeric", month: "short", year: "numeric" });
  return (
    <article className="work-row">
      <div className="work-date"><strong>{workDate.getDate()}</strong><span>{workDate.toLocaleDateString(language === "te" ? "te-IN-u-nu-latn" : "en-IN", { month: "short" })}</span></div>
      <div className="work-main">
        <h3>{work.customer?.name ?? t("farmer")}</h3>
        <p className="work-type-name">{displayWorkType(work.work_type_name, language)}</p>
        <div className="work-details-grid"><span><b>{t("workDate")}:</b> {fullDate}</span><span><b>{t("sharedQuantity")}:</b> {work.quantity} {unit}</span><span><b>{t("receiptRate")}:</b> {money(work.rate)}</span><span><b>{t("balanceDue")}:</b> {money(balance)}</span></div>
        <span className={`payment-status ${status}`}>{statusLabel}</span>
      </div>
      <div className="row-actions"><button className="row-action-button" onClick={onEdit}><Pencil size={18} /> {t("editWork")}</button><button className="row-action-button" onClick={onShare}><MessageCircle size={18} /> {t("shareReceipt")}</button></div>
    </article>
  );
}

function Customers({ customers, works, onSelect }: { customers: Customer[]; works: WorkRecord[]; onSelect: (customer: Customer) => void }) {
  const { t } = useLanguage();
  const [query, setQuery] = useState("");
  const filtered = customers.filter((customer) => `${customer.name} ${customer.phone ?? ""}`.toLowerCase().includes(query.toLowerCase()));
  return (
    <>
      <section className="page-heading"><div><h1>{t("customerList")}</h1><p>{t("customerHelp")}</p></div></section>
      <label className="search-box"><Search size={21} /><span className="sr-only">{t("search")}</span><input placeholder={t("searchPlaceholder")} value={query} onChange={(event) => setQuery(event.target.value)} /></label>
      <section className="customer-list">
        {filtered.map((customer) => {
          const customerWorks = works.filter((work) => work.customer_id === customer.id);
          const due = customerWorks.reduce((sum, work) => sum + balanceFor(work), 0);
          return (
            <button key={customer.id} className="customer-row" onClick={() => onSelect(customer)}>
              <span className="avatar">{customer.name.slice(0, 1).toUpperCase()}</span>
              <span className="customer-name"><strong>{customer.name}</strong><small>{customer.phone || t("noPhone")}</small></span>
              <span className="customer-due"><small>{t("customerBalance")}</small>{due > 0 ? <strong className="due-text">{money(due)}</strong> : <strong className="no-balance-badge">{t("noBalance")}</strong>}</span>
              <ChevronRight size={21} />
            </button>
          );
        })}
        {!filtered.length && <EmptyState icon={Users} title={t("noFarmers")} text={t("noFarmersHelp")} />}
      </section>
    </>
  );
}

function CustomerDetail({ customer, works, onBack, onRefresh, onEdit, onShare, setNotice }: {
  customer: Customer;
  works: WorkRecord[];
  onBack: () => void;
  onRefresh: () => Promise<void>;
  onEdit: (work: WorkRecord) => void;
  onShare: (work: WorkRecord) => void;
  setNotice: (notice: Notice) => void;
}) {
  const { language, t } = useLanguage();
  const total = works.reduce((sum, work) => sum + Number(work.total), 0);
  const received = works.reduce((sum, work) => sum + paidFor(work), 0);
  const [paymentWork, setPaymentWork] = useState<WorkRecord | null>(null);
  const [shareAllOpen, setShareAllOpen] = useState(false);
  const dateLabel = (value: string) => new Date(`${value}T00:00:00`).toLocaleDateString(language === "te" ? "te-IN-u-nu-latn" : "en-IN", { day: "numeric", month: "short", year: "numeric" });
  const methodLabel = (method: string) => t(({ Cash: "cash", UPI: "upi", "Bank transfer": "bankTransfer", Other: "other" }[method] ?? "other") as MessageKey);

  return (
    <>
      <button className="back-button" onClick={onBack}><ArrowLeft size={21} /> {t("allFarmers")}</button>
      <section className="customer-hero"><div className="avatar large-avatar">{customer.name.slice(0, 1).toUpperCase()}</div><div className="customer-identity"><h1>{customer.name}</h1><p>{customer.phone || t("noPhone")}</p></div><button className="primary-button share-customer-button" onClick={() => setShareAllOpen(true)}><MessageCircle size={20} /> {t("shareAllDetails")}</button></section>
      <section className="mini-stats">
        <div><span>{t("totalAmount")}</span><strong>{money(total)}</strong></div>
        <div><span>{t("received")}</span><strong>{money(received)}</strong></div>
        <div><span>{t("balanceDue")}</span><strong className="due-text">{money(total - received)}</strong></div>
      </section>
      <section className="section-block">
        <div className="section-title"><h2>{t("workPaymentHistory")}</h2></div>
        {works.length ? (
          <div className="history-list">{works.map((work) => (
            <article className="history-item" key={work.id}>
              <div className="history-head"><div><strong>{displayWorkType(work.work_type_name, language)}</strong><span>{dateLabel(work.work_date)}</span></div><strong>{money(work.total)}</strong></div>
              <p>{work.quantity} {work.charge_basis === "hour" ? t("hoursWorked") : t("acres")} × {money(work.rate)}</p>
              {(work.payments ?? []).length > 0 && <h4 className="payment-title">{t("payments")}</h4>}
              <div className="payment-lines">{(work.payments ?? []).map((payment) => <div key={payment.id}><span>{dateLabel(payment.payment_date)} · {methodLabel(payment.method)}</span><strong>+{money(payment.amount)}</strong></div>)}</div>
              <div className="history-footer">
                <span>{t("balanceDue")} <b>{money(balanceFor(work))}</b></span>
                <div><button className="row-action-button" onClick={() => onEdit(work)}><Pencil size={18} /> {t("editWork")}</button><button className="row-action-button" onClick={() => onShare(work)}><MessageCircle size={18} /> {t("shareReceipt")}</button>{balanceFor(work) > 0 && <button className="small-action" onClick={() => setPaymentWork(work)}><CirclePlus size={18} /> {t("addPayment")}</button>}</div>
              </div>
            </article>
          ))}</div>
        ) : <EmptyState icon={ClipboardList} title={t("noFarmerWork")} text={t("noFarmerWorkHelp")} />}
      </section>
      {paymentWork && <PaymentModal work={paymentWork} onClose={() => setPaymentWork(null)} onSaved={() => { setPaymentWork(null); void onRefresh(); }} setNotice={setNotice} />}
      {shareAllOpen && <CustomerShareSheet customer={customer} works={works} onClose={() => setShareAllOpen(false)} />}
    </>
  );
}

function WorkTypeSettings({ workTypes, onRefresh, setNotice }: { workTypes: WorkType[]; onRefresh: () => Promise<void>; setNotice: (notice: Notice) => void }) {
  const { language, t } = useLanguage();
  const [name, setName] = useState("");
  const add = async (event: FormEvent) => {
    event.preventDefault();
    const value = name.trim();
    if (!value) return;
    const { data: userData } = await getSupabase().auth.getUser();
    const { error } = await getSupabase().from("work_types").insert({ name: value, user_id: userData.user?.id });
    if (error) setNotice({ tone: "error", text: friendlyError(error.message, t) });
    else {
      setName("");
      setNotice({ tone: "success", text: t("workTypeAdded") });
      await onRefresh();
    }
  };
  const toggle = async (workType: WorkType) => {
    const { error } = await getSupabase().from("work_types").update({ active: !workType.active }).eq("id", workType.id);
    if (error) setNotice({ tone: "error", text: friendlyError(error.message, t) });
    else await onRefresh();
  };
  return (
    <>
      <section className="page-heading"><div><h1>{t("workTypes")}</h1><p>{t("workTypesHelp")}</p></div></section>
      <section className="settings-panel">
        <form className="inline-form" onSubmit={add}><label><FieldLabel label={t("newWorkType")} /><input value={name} onChange={(event) => setName(event.target.value)} placeholder={t("workTypeExample")} /></label><button className="primary-button"><Plus size={20} /> {t("add")}</button></form>
        <div className="type-list">{workTypes.map((type) => <div key={type.id}><strong>{displayWorkType(type.name, language)}</strong><div className="type-control"><span className={`type-status ${type.active ? "active" : "inactive"}`}>{type.active ? t("availableInForm") : t("hiddenFromForm")}</span><label className="switch"><input type="checkbox" checked={type.active} onChange={() => void toggle(type)} aria-label={`${type.name}: ${type.active ? t("availableInForm") : t("hiddenFromForm")}`} /><span /></label></div></div>)}</div>
      </section>
    </>
  );
}

function WorkModal({ customers, workTypes, work, userId, onClose, onSaved, setNotice }: {
  customers: Customer[];
  workTypes: WorkType[];
  work: WorkRecord | null;
  userId: string;
  onClose: () => void;
  onSaved: (work: WorkRecord) => void;
  setNotice: (notice: Notice) => void;
}) {
  const { language, t } = useLanguage();
  const [customerMode, setCustomerMode] = useState<"existing" | "new">(work ? "existing" : customers.length ? "existing" : "new");
  const [customerId, setCustomerId] = useState(work?.customer_id ?? customers[0]?.id ?? "");
  const [farmerName, setFarmerName] = useState("");
  const [phone, setPhone] = useState("");
  const contactPickerSupported = useSyncExternalStore(
    subscribeToContactPickerSupport,
    getContactPickerSupport,
    getServerContactPickerSupport,
  );
  const [contactNumbers, setContactNumbers] = useState<string[]>([]);
  const [selectedContactNumber, setSelectedContactNumber] = useState("");
  const [workDate, setWorkDate] = useState(work?.work_date ?? today());
  const [workTypeId, setWorkTypeId] = useState(work?.work_type_id ?? workTypes.find((type) => type.active)?.id ?? "");
  const [basis, setBasis] = useState<ChargeBasis>(work?.charge_basis ?? "hour");
  const [quantity, setQuantity] = useState(work ? String(work.quantity) : "");
  const [rate, setRate] = useState(work ? String(work.rate) : "");
  const [received, setReceived] = useState("0");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const total = Math.max(0, Number(quantity) || 0) * Math.max(0, Number(rate) || 0);
  const alreadyPaid = work ? paidFor(work) : 0;
  const activeTypes = workTypes.filter((type) => type.active || type.id === workTypeId);

  const selectContact = async () => {
    const contacts = navigator.contacts;
    if (!contacts) return;

    try {
      const selected = await contacts.select(["name", "tel"], { multiple: false });
      const contact = selected[0];
      if (!contact) return;

      const selectedName = contact.name?.find((name) => name.trim())?.trim();
      const numbers = [...new Set((contact.tel ?? []).map((number) => number.trim()).filter(Boolean))];

      if (selectedName) setFarmerName(selectedName);
      if (numbers.length > 0) {
        setPhone(numbers[0]);
        setSelectedContactNumber(numbers[0]);
      }
      setContactNumbers(numbers.length > 1 ? numbers : []);
    } catch (pickerError) {
      if (pickerError instanceof DOMException && pickerError.name === "AbortError") return;
      setError(t("contactPickerError"));
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    const qty = Number(quantity);
    const unitRate = Number(rate);
    const initialPayment = Number(received || 0);
    if (qty <= 0 || unitRate < 0 || initialPayment < 0) return setError(t("invalidAmounts"));
    if (work && total < alreadyPaid) return setError(t("totalBelowPaid", { amount: money(alreadyPaid) }));
    if (!work && initialPayment > total) return setError(t("receivedTooHigh"));
    if (!workTypeId) return setError(t("chooseWorkType"));
    setBusy(true);
    const supabase = getSupabase();
    let finalCustomerId = customerId;
    if (!work && customerMode === "new") {
      if (!farmerName.trim()) {
        setBusy(false);
        return setError(t("enterFarmerName"));
      }
      const { data, error: customerError } = await supabase.from("customers").insert({ user_id: userId, name: farmerName.trim(), phone: phone.trim() || null }).select().single();
      if (customerError) {
        setBusy(false);
        return setError(friendlyError(customerError.message, t));
      }
      finalCustomerId = data.id;
    }
    if (!finalCustomerId) {
      setBusy(false);
      return setError(t("chooseFarmer"));
    }
    const selectedType = workTypes.find((type) => type.id === workTypeId);
    const values = {
      user_id: userId,
      customer_id: finalCustomerId,
      work_type_id: workTypeId,
      work_type_name: selectedType?.name ?? work?.work_type_name ?? "Work",
      work_date: workDate,
      charge_basis: basis,
      quantity: qty,
      rate: unitRate,
    };
    const result = work
      ? await supabase.from("work_records").update(values).eq("id", work.id).select("*, customer:customers(*), payments(*)").single()
      : await supabase.from("work_records").insert(values).select("*, customer:customers(*), payments(*)").single();
    if (result.error) {
      setBusy(false);
      return setError(friendlyError(result.error.message, t));
    }
    let saved = result.data as unknown as WorkRecord;
    if (!work && initialPayment > 0) {
      const { data: payment, error: paymentError } = await supabase.from("payments").insert({ user_id: userId, work_record_id: saved.id, payment_date: workDate, amount: initialPayment, method: "Cash" }).select().single();
      if (paymentError) {
        setBusy(false);
        setNotice({ tone: "error", text: t("workSavedPaymentFailed", { error: paymentError.message }) });
      } else {
        saved = { ...saved, payments: [payment as Payment] };
      }
    }
    setBusy(false);
    setNotice({ tone: "success", text: work ? t("workUpdated") : t("savedSuccessfully") });
    onSaved(saved);
  };

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="modal work-modal" role="dialog" aria-modal="true" aria-labelledby="work-title">
        <div className="modal-head"><div><p className="eyebrow">{work ? t("editRecord") : t("newRecord")}</p><h2 id="work-title">{work ? t("editWork") : t("addWork")}</h2></div><IconButton icon={X} label={t("close")} onClick={onClose} /></div>
        <form onSubmit={submit} className="form-grid">
          {!work && <div className="full"><FieldLabel label={t("farmerName")} /><div className="segmented"><button type="button" className={customerMode === "existing" ? "active" : ""} onClick={() => setCustomerMode("existing")}>{t("existingFarmer")}</button><button type="button" className={customerMode === "new" ? "active" : ""} onClick={() => setCustomerMode("new")}>{t("newFarmer")}</button></div></div>}
          {(work || customerMode === "existing") ? (
            <label className="full"><FieldLabel label={t("farmerName")} /><select value={customerId} onChange={(event) => setCustomerId(event.target.value)} required><option value="">{t("selectFarmer")}</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}{customer.phone ? ` · ${customer.phone}` : ""}</option>)}</select></label>
          ) : <>
            {contactPickerSupported && <button type="button" className="secondary-button contact-picker-button full" onClick={() => void selectContact()}><Phone size={20} />{t("selectContact")}</button>}
            <label><FieldLabel label={t("farmerName")} /><input value={farmerName} onChange={(event) => setFarmerName(event.target.value)} required /></label>
            <label><FieldLabel label={t("phoneNumber")} /><input type="tel" inputMode="tel" value={phone} onChange={(event) => { setPhone(event.target.value); setSelectedContactNumber(contactNumbers.includes(event.target.value) ? event.target.value : ""); }} placeholder={t("optional")} /></label>
            {contactNumbers.length > 1 && <label className="full"><FieldLabel label={t("chooseContactNumber")} /><select value={selectedContactNumber} onChange={(event) => { setSelectedContactNumber(event.target.value); setPhone(event.target.value); }}>{contactNumbers.map((number) => <option key={number} value={number}>{number}</option>)}</select></label>}
          </>}
          <label><FieldLabel label={t("workDate")} /><input type="date" value={workDate} onChange={(event) => setWorkDate(event.target.value)} required /></label>
          <label><FieldLabel label={t("workType")} /><select value={workTypeId} onChange={(event) => setWorkTypeId(event.target.value)} required><option value="">{activeTypes.length ? t("selectWorkType") : t("noWorkTypes")}</option>{activeTypes.map((type) => <option key={type.id} value={type.id}>{displayWorkType(type.name, language)}</option>)}</select></label>
          <label className="full"><FieldLabel label={t("chargeBasis")} /><select value={basis} onChange={(event) => setBasis(event.target.value as ChargeBasis)}><option value="hour">{t("perHour")}</option><option value="acre">{t("perAcre")}</option></select></label>
          <label><FieldLabel label={basis === "hour" ? t("hoursWorked") : t("acres")} /><input type="number" min="0.01" step="0.01" inputMode="decimal" value={quantity} onChange={(event) => setQuantity(event.target.value)} required /></label>
          <label><FieldLabel label={basis === "hour" ? t("ratePerHour") : t("ratePerAcre")} /><div className="money-input"><span>₹</span><input type="number" min="0" step="0.01" inputMode="decimal" value={rate} onChange={(event) => setRate(event.target.value)} required /></div></label>
          {!work && <label className="full"><FieldLabel label={t("amountReceived")} /><div className="money-input"><span>₹</span><input type="number" min="0" max={total} step="0.01" inputMode="decimal" value={received} onChange={(event) => setReceived(event.target.value)} /></div></label>}
          <div className="calculation full"><div><span>{t("totalAmount")}</span><strong>{money(total)}</strong></div><div><span>{work ? t("balanceAfterPayments") : t("balanceDue")}</span><strong>{money(Math.max(0, total - (work ? alreadyPaid : Number(received) || 0)))}</strong></div></div>
          {error && <p className="form-error full">{error}</p>}
          <div className="modal-actions full"><button type="button" className="secondary-button" onClick={onClose}>{t("cancel")}</button><button className="primary-button" disabled={busy}>{busy ? t("saving") : work ? t("saveChanges") : t("save")}</button></div>
        </form>
      </section>
    </div>
  );
}

function PaymentModal({ work, onClose, onSaved, setNotice }: { work: WorkRecord; onClose: () => void; onSaved: () => void; setNotice: (notice: Notice) => void }) {
  const { t } = useLanguage();
  const balance = balanceFor(work);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(today());
  const [method, setMethod] = useState("Cash");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const value = Number(amount);
    if (value <= 0) return setError(t("paymentPositive"));
    if (value > balance) return setError(t("paymentTooHigh", { amount: money(balance) }));
    setBusy(true);
    const { data: userData } = await getSupabase().auth.getUser();
    const { error: saveError } = await getSupabase().from("payments").insert({ user_id: userData.user?.id, work_record_id: work.id, payment_date: date, amount: value, method });
    setBusy(false);
    if (saveError) setError(friendlyError(saveError.message, t));
    else {
      setNotice({ tone: "success", text: t("paymentSaved") });
      onSaved();
    }
  };
  return (
    <div className="modal-backdrop top-layer">
      <section className="modal compact-modal" role="dialog" aria-modal="true">
        <div className="modal-head"><div><p className="eyebrow">{t("balanceDue")}: {money(balance)}</p><h2>{t("addPayment")}</h2></div><IconButton icon={X} label={t("close")} onClick={onClose} /></div>
        <form onSubmit={submit} className="stack-form">
          <label><FieldLabel label={t("paymentDate")} /><input type="date" value={date} onChange={(event) => setDate(event.target.value)} required /></label>
          <label><FieldLabel label={t("amount")} /><div className="money-input"><span>₹</span><input type="number" min="0.01" max={balance} step="0.01" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} required /></div></label>
          <label><FieldLabel label={t("paymentMethod")} /><select value={method} onChange={(event) => setMethod(event.target.value)}><option value="Cash">{t("cash")}</option><option value="UPI">{t("upi")}</option><option value="Bank transfer">{t("bankTransfer")}</option><option value="Other">{t("other")}</option></select></label>
          {error && <p className="form-error">{error}</p>}
          <button className="primary-button" disabled={busy}>{busy ? t("saving") : t("savePayment")}</button>
        </form>
      </section>
    </div>
  );
}

function ShareSheet({ work, onClose }: { work: WorkRecord; onClose: () => void }) {
  const { language, t } = useLanguage();
  const customer = work.customer;
  const balance = balanceFor(work);
  const date = new Date(`${work.work_date}T00:00:00`).toLocaleDateString(language === "te" ? "te-IN-u-nu-latn" : "en-IN", { day: "numeric", month: "short", year: "numeric" });
  const unit = work.charge_basis === "hour" ? t("hoursWorked") : t("acres");
  const receipt = `${t("receiptTitle")}\n\n${t("receiptFarmer")}: ${customer?.name ?? "-"}\n${t("receiptDate")}: ${date}\n${t("receiptWork")}: ${displayWorkType(work.work_type_name, language)}\n${t("sharedWorkDetails")}: ${work.quantity} ${unit} × ${money(work.rate)}\n${t("receiptTotal")}: ${money(work.total)}\n\n${paymentStatus(balance)}\n\n${t("thankYou")}`;
  const phone = customer?.phone?.replace(/[^\d+]/g, "") ?? "";
  return (
    <div className="modal-backdrop">
      <section className="modal share-modal" role="dialog" aria-modal="true">
        <div className="modal-head"><div><p className="eyebrow">{t("savedSuccessfully")}</p><h2>{t("shareReceiptTitle")}</h2></div><IconButton icon={X} label={t("close")} onClick={onClose} /></div>
        <pre className="receipt">{receipt}</pre>
        <div className="share-actions"><a className="whatsapp-button" href={`https://wa.me/${phone}?text=${encodeURIComponent(receipt)}`} target="_blank" rel="noreferrer"><MessageCircle size={22} /> {t("sendWhatsApp")}</a><a className="sms-button" href={`sms:${phone}?&body=${encodeURIComponent(receipt)}`}><Phone size={22} /> {t("sendSms")}</a></div>
        <button className="text-button" onClick={onClose}>{t("done")}</button>
      </section>
    </div>
  );
}

function CustomerShareSheet({ customer, works, onClose }: { customer: Customer; works: WorkRecord[]; onClose: () => void }) {
  const { language, t } = useLanguage();
  const dateLabel = (value: string) => new Date(`${value}T00:00:00`).toLocaleDateString(language === "te" ? "te-IN-u-nu-latn" : "en-IN", { day: "numeric", month: "short", year: "numeric" });
  const pendingWorks = works.map((work) => ({ work, balance: balanceFor(work) })).filter(({ balance }) => balance > 0);
  const totalPending = pendingWorks.reduce((sum, { balance }) => sum + balance, 0);
  const labelLine = (label: string, value: string, bold: boolean) => bold ? `*${label}:* ${value}` : `${label}: ${value}`;
  const buildStatement = (bold: boolean) => {
    const title = bold ? `*${t("customerStatementTitle")}*` : t("customerStatementTitle");
    const details = pendingWorks.map(({ work, balance }, index) => {
      const unit = work.charge_basis === "hour" ? t("hoursWorked") : t("acres");
      return `${index + 1}.\n${labelLine(t("receiptWork"), displayWorkType(work.work_type_name, language), bold)}\n${labelLine(t("receiptDate"), dateLabel(work.work_date), bold)}\n${labelLine(t("sharedQuantity"), `${work.quantity} ${unit}`, bold)}\n${labelLine(t("receiptRate"), money(work.rate), bold)}\n${labelLine(t("remainingBalance"), money(balance), bold)}`;
    }).join("\n\n");
    const pendingSection = pendingWorks.length
      ? `${bold ? `*${t("sharedWorkDetails")}*` : t("sharedWorkDetails")}\n\n${details}\n\n${labelLine(t("totalPendingBalance"), money(totalPending), bold)}\n\nPhonePe / Google Pay ద్వారా\n${bold ? "*9704200894*" : "9704200894"} నంబర్‌కు చెల్లించండి.\nచెల్లించే ముందు పేరు సరిచూసుకోండి.`
      : bold ? `*${t("noPendingBalance")}*` : t("noPendingBalance");
    return `${title}\n\n${labelLine(t("receiptFarmer"), customer.name, bold)}\n\n${pendingSection}\n\n${t("thankYou")}`;
  };
  const whatsappStatement = buildStatement(true);
  const smsStatement = buildStatement(false);
  const phone = customer.phone?.replace(/[^\d+]/g, "") ?? "";

  return (
    <div className="modal-backdrop top-layer">
      <section className="modal share-modal" role="dialog" aria-modal="true" aria-labelledby="customer-share-title">
        <div className="modal-head"><div><p className="eyebrow">{customer.name}</p><h2 id="customer-share-title">{t("shareAllDetails")}</h2></div><IconButton icon={X} label={t("close")} onClick={onClose} /></div>
        <div className="receipt statement-preview">
          <h3>{t("customerStatementTitle")}</h3>
          <p><strong>{t("receiptFarmer")}:</strong> {customer.name}</p>
          {pendingWorks.length ? <>
            <h4>{t("sharedWorkDetails")}</h4>
            {pendingWorks.map(({ work, balance }, index) => {
              const unit = work.charge_basis === "hour" ? t("hoursWorked") : t("acres");
              return <section className="statement-work" key={work.id}><b>{index + 1}.</b><p><strong>{t("receiptWork")}:</strong> {displayWorkType(work.work_type_name, language)}</p><p><strong>{t("receiptDate")}:</strong> {dateLabel(work.work_date)}</p><p><strong>{t("sharedQuantity")}:</strong> {work.quantity} {unit}</p><p><strong>{t("receiptRate")}:</strong> {money(work.rate)}</p><p className="statement-balance"><strong>{t("remainingBalance")}:</strong> {money(balance)}</p></section>;
            })}
            <p className="statement-total"><strong>{t("totalPendingBalance")}:</strong> {money(totalPending)}</p>
            <div className="statement-payment"><p>PhonePe / Google Pay ద్వారా</p><p><strong>9704200894</strong> నంబర్‌కు చెల్లించండి.</p><p>చెల్లించే ముందు పేరు సరిచూసుకోండి.</p></div>
          </> : <p className="statement-clear"><strong>{t("noPendingBalance")}</strong></p>}
          <p className="statement-thanks">{t("thankYou")}</p>
        </div>
        <div className="share-actions"><a className="whatsapp-button" href={`https://wa.me/${phone}?text=${encodeURIComponent(whatsappStatement)}`} target="_blank" rel="noreferrer"><MessageCircle size={22} /> {t("sendWhatsApp")}</a><a className="sms-button" href={`sms:${phone}?&body=${encodeURIComponent(smsStatement)}`}><Phone size={22} /> {t("sendSms")}</a></div>
        <button className="text-button" onClick={onClose}>{t("done")}</button>
      </section>
    </div>
  );
}
